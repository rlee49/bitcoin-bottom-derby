-- Bitcoin Bottom Derby shared voting backend
-- Run once in the Supabase SQL Editor.

create table if not exists public.derby_votes (
  contest_id text not null,
  voter_hash text not null,
  racer_id text not null check (racer_id in ('tom','tatiana','rodster','bike')),
  created_at timestamptz not null default now(),
  primary key (contest_id, voter_hash)
);

alter table public.derby_votes enable row level security;

-- No direct browser access to raw vote rows. Visitors only use the two
-- security-definer functions below, so voter hashes are not publicly listed.
revoke all on table public.derby_votes from anon, authenticated;

create or replace function public.get_derby_vote_totals(p_contest_id text)
returns table (racer_id text, vote_count bigint)
language sql
security definer
set search_path = public
as $$
  with racers(racer_id) as (
    values ('tom'::text), ('tatiana'::text), ('rodster'::text), ('bike'::text)
  )
  select r.racer_id, count(v.voter_hash)::bigint as vote_count
  from racers r
  left join public.derby_votes v
    on v.contest_id = p_contest_id
   and v.racer_id = r.racer_id
  group by r.racer_id
  order by r.racer_id;
$$;

create or replace function public.cast_derby_vote(
  p_contest_id text,
  p_racer_id text,
  p_voter_hash text
)
returns table (accepted boolean, racer_id text, vote_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_racer text;
  v_selected_racer text;
  v_accepted boolean := false;
  v_vote_count bigint := 0;
begin
  if p_contest_id is null or length(trim(p_contest_id)) < 3 then
    raise exception 'Invalid contest id';
  end if;

  if p_racer_id not in ('tom','tatiana','rodster','bike') then
    raise exception 'Invalid racer';
  end if;

  if p_voter_hash is null or length(p_voter_hash) <> 64 then
    raise exception 'Invalid voter hash';
  end if;

  select dv.racer_id
    into v_existing_racer
  from public.derby_votes dv
  where dv.contest_id = p_contest_id
    and dv.voter_hash = p_voter_hash;

  if v_existing_racer is null then
    insert into public.derby_votes (contest_id, voter_hash, racer_id)
    values (p_contest_id, p_voter_hash, p_racer_id)
    on conflict (contest_id, voter_hash) do nothing;

    if found then
      v_selected_racer := p_racer_id;
      v_accepted := true;
    else
      select dv.racer_id
        into v_selected_racer
      from public.derby_votes dv
      where dv.contest_id = p_contest_id
        and dv.voter_hash = p_voter_hash;
    end if;
  else
    v_selected_racer := v_existing_racer;
  end if;

  select count(*)::bigint
    into v_vote_count
  from public.derby_votes dv
  where dv.contest_id = p_contest_id
    and dv.racer_id = v_selected_racer;

  return query select v_accepted, v_selected_racer, v_vote_count;
end;
$$;

grant execute on function public.get_derby_vote_totals(text) to anon, authenticated;
grant execute on function public.cast_derby_vote(text, text, text) to anon, authenticated;

-- One vote is enforced per stored device token within this contest. Clearing
-- browser storage or using another device can create another token, so this is
-- appropriate for a lighthearted free contest, not identity-grade verification.
