-- Bitcoin Bottom Derby v45 production database
-- Voting writes are intentionally reserved for the server-side Edge Function.

begin;

create table if not exists public.derby_votes (
  id uuid primary key default gen_random_uuid(),
  contest_id text not null check (char_length(contest_id) between 3 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text not null check (discord_user_id ~ '^[0-9]{15,25}$'),
  discord_display_name text not null check (char_length(discord_display_name) between 1 and 100),
  discord_avatar_url text check (discord_avatar_url is null or char_length(discord_avatar_url) <= 500),
  racer_id text not null check (racer_id in ('bike', 'rodster', 'tatiana', 'tom', 'whitesw0n')),
  odds_at_entry text check (odds_at_entry is null or char_length(odds_at_entry) <= 32),
  verified_guild_member boolean not null default true check (verified_guild_member = true),
  guild_member_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (contest_id, user_id),
  unique (contest_id, discord_user_id)
);

create index if not exists derby_votes_contest_racer_idx
  on public.derby_votes (contest_id, racer_id);
create index if not exists derby_votes_contest_created_idx
  on public.derby_votes (contest_id, created_at);

alter table public.derby_votes enable row level security;
revoke all on table public.derby_votes from public, anon, authenticated;
grant all on table public.derby_votes to service_role;

create or replace function public.get_derby_vote_totals(p_contest_id text)
returns table (racer_id text, vote_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with racers(racer_id) as (
    values ('bike'::text), ('rodster'::text), ('tatiana'::text), ('tom'::text), ('whitesw0n'::text)
  )
  select r.racer_id, count(v.id)::bigint as vote_count
  from racers r
  left join public.derby_votes v
    on v.contest_id = p_contest_id
   and v.racer_id = r.racer_id
   and v.verified_guild_member = true
  group by r.racer_id
  order by r.racer_id;
$$;

create or replace function public.get_derby_public_entries(p_contest_id text)
returns table (
  discord_display_name text,
  discord_avatar_url text,
  racer_id text,
  odds_at_entry text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.discord_display_name, v.discord_avatar_url, v.racer_id, v.odds_at_entry, v.created_at
  from public.derby_votes v
  where v.contest_id = p_contest_id
    and v.verified_guild_member = true
  order by v.created_at asc
  limit 5000;
$$;

create or replace function public.get_my_derby_vote(p_contest_id text)
returns table (
  racer_id text,
  discord_display_name text,
  discord_avatar_url text,
  odds_at_entry text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select v.racer_id, v.discord_display_name, v.discord_avatar_url, v.odds_at_entry, v.created_at
  from public.derby_votes v
  where v.contest_id = p_contest_id
    and v.user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_derby_vote_totals(text) from public;
revoke all on function public.get_derby_public_entries(text) from public;
revoke all on function public.get_my_derby_vote(text) from public;

grant execute on function public.get_derby_vote_totals(text) to anon, authenticated;
grant execute on function public.get_derby_public_entries(text) to anon, authenticated;
grant execute on function public.get_my_derby_vote(text) to authenticated;

commit;
