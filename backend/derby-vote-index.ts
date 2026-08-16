// Bitcoin Bottom Derby v45 — authenticated Discord-member vote writer
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from 'jsr:@supabase/server@^1'

const CONTEST_ID = 'bitcoin-bottom-derby-2026'
const LIVE_ORIGIN = 'https://rlee49.github.io'
const ALLOWED_ORIGINS = new Set([
  LIVE_ORIGIN,
  'http://localhost:8000',
  'http://127.0.0.1:8000',
])
const RACER_IDS = new Set(['bike', 'rodster', 'tatiana', 'tom', 'whitesw0n'])
const DISCORD_ID_PATTERN = /^[0-9]{15,25}$/
const ODDS_PATTERN = /^(?:[1-9][0-9]{0,3})\/(?:[1-9][0-9]{0,3})$/

function reply(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, { status })
}

function firstDiscordId(values: unknown[]): string {
  for (const value of values) {
    const candidate = String(value || '')
    if (DISCORD_ID_PATTERN.test(candidate)) return candidate
  }
  return ''
}

function discordAvatarUrl(
  guildId: string,
  discordUserId: string,
  member: Record<string, any>,
  fallback: unknown,
): string | null {
  if (member.avatar) {
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${discordUserId}/avatars/${member.avatar}.png?size=128`
  }
  if (member.user?.avatar) {
    return `https://cdn.discordapp.com/avatars/${discordUserId}/${member.user.avatar}.png?size=128`
  }
  const fallbackUrl = String(fallback || '')
  return fallbackUrl.startsWith('https://') ? fallbackUrl.slice(0, 500) : null
}

console.info('Bitcoin Bottom Derby vote service started')

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' })

    const origin = req.headers.get('origin') || ''
    if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(403, { error: 'Origin not allowed.' })

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN') || ''
    const guildId = Deno.env.get('DISCORD_GUILD_ID') || ''
    if (!botToken || !DISCORD_ID_PATTERN.test(guildId)) {
      console.error('Missing or invalid Discord Edge Function secrets.')
      return reply(500, { error: 'Derby voting is not fully configured yet.' })
    }

    let payload: Record<string, unknown>
    try {
      payload = await req.json()
    } catch {
      return reply(400, { error: 'Invalid request.' })
    }

    const contestId = String(payload.contestId || '')
    const racerId = String(payload.racerId || '').toLowerCase()
    const rawOdds = String(payload.oddsAtEntry || '')
    const oddsAtEntry = ODDS_PATTERN.test(rawOdds) ? rawOdds : null
    if (contestId !== CONTEST_ID || !RACER_IDS.has(racerId)) {
      return reply(400, { error: 'Invalid contest or racer.' })
    }

    const { data: userData, error: userError } = await ctx.supabase.auth.getUser()
    const user = userData.user
    if (userError || !user) return reply(401, { error: 'Your Discord sign-in expired. Please sign in again.' })

    const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord')
    const identityData = (discordIdentity?.identity_data || {}) as Record<string, any>
    const discordUserId = firstDiscordId([
      (discordIdentity as any)?.provider_id,
      identityData.provider_id,
      identityData.sub,
      identityData.id,
      discordIdentity?.id,
    ])
    if (!discordIdentity || !discordUserId) {
      return reply(403, { error: 'This entry must use a Discord-authenticated account.' })
    }

    const { data: existingVote, error: existingError } = await ctx.supabaseAdmin
      .from('derby_votes')
      .select('racer_id, discord_display_name, discord_avatar_url, odds_at_entry, created_at')
      .eq('contest_id', CONTEST_ID)
      .eq('user_id', user.id)
      .maybeSingle()
    if (existingError) {
      console.error('Existing-vote lookup failed:', existingError.message)
      return reply(500, { error: 'Could not check your existing Derby entry.' })
    }
    if (existingVote) return reply(200, { ok: true, locked: true, vote: existingVote })

    const discordResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
      { headers: { Authorization: `Bot ${botToken}` } },
    )
    if (discordResponse.status === 404) {
      return reply(403, { error: 'Only members of the Discord community can enter the Derby.' })
    }
    if (!discordResponse.ok) {
      console.error('Discord membership check failed:', discordResponse.status, await discordResponse.text())
      return reply(502, { error: 'Discord membership verification is temporarily unavailable.' })
    }

    const member = await discordResponse.json() as Record<string, any>
    if (member.pending === true) {
      return reply(403, { error: 'Complete the Discord server membership screening before entering.' })
    }

    const displayName = String(
      member.nick || member.user?.global_name || identityData.full_name || identityData.name ||
      identityData.user_name || member.user?.username || 'Discord member'
    ).trim().slice(0, 100)
    const avatarUrl = discordAvatarUrl(guildId, discordUserId, member, identityData.avatar_url)

    const { data: insertedVote, error: insertError } = await ctx.supabaseAdmin
      .from('derby_votes')
      .insert({
        contest_id: CONTEST_ID,
        user_id: user.id,
        discord_user_id: discordUserId,
        discord_display_name: displayName,
        discord_avatar_url: avatarUrl,
        racer_id: racerId,
        odds_at_entry: oddsAtEntry,
        verified_guild_member: true,
        guild_member_checked_at: new Date().toISOString(),
      })
      .select('racer_id, discord_display_name, discord_avatar_url, odds_at_entry, created_at')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return reply(409, { error: 'This Discord account already has a locked Derby pick.' })
      }
      console.error('Vote insert failed:', insertError.message)
      return reply(500, { error: 'Your pick could not be saved. Please try again.' })
    }

    return reply(201, { ok: true, locked: true, vote: insertedVote })
  }),
}
