# Supabase production setup — v45

The production database and Discord authentication are already connected in this release.

## Live project

- Site: `https://rlee49.github.io/bitcoin-bottom-derby/`
- Supabase project: `https://ngkwxkiihovmzwgiwmde.supabase.co`
- Contest: `bitcoin-bottom-derby-2026`
- Edge Function endpoint slug: `quick-handler`

`supabase-config.js` contains only the browser-safe project URL and publishable key. Never place a secret key, service-role key, database password, Discord client secret, or bot token in any website file.

## Database source

The exact production schema is preserved in `backend/supabase-schema-v45-production.sql`. It creates:

- a private `derby_votes` table;
- one locked vote per authenticated user and Discord account;
- public read-only totals and Paddock Picks functions;
- a signed-in member's own locked-pick function;
- RLS and least-privilege grants that prevent browser writes to the private table.

## Edge Function source

The deployed function source is preserved in `backend/derby-vote-index.ts`. The dashboard display name is `derby-vote`, while its permanent endpoint slug is `quick-handler`.

The function requires these encrypted server-side secrets:

- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`

It verifies the Supabase Discord session, checks current membership in the configured Discord server, rejects pending membership screening, and performs the protected vote insert server-side.

## Public launch behavior

- The shared database starts at zero genuine community votes.
- Preview names and seeded browser votes are disabled.
- Discord display names and avatars appear publicly only after a verified member locks a pick.
- The private Discord user ID and Supabase user ID never appear in the public RPC output.
