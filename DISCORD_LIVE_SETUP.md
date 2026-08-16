# Discord production verification — v45

The live Discord OAuth and server-membership verification path is configured.

## Discord application

- Application/client ID: `1538589198498533526`
- Target server ID: `1202093362446864475`
- OAuth callback: `https://ngkwxkiihovmzwgiwmde.supabase.co/auth/v1/callback`
- Site return URL: `https://rlee49.github.io/bitcoin-bottom-derby/`

The bot is private, installed only in the target server, and needs no channel permissions or privileged gateway intents. It is used server-side only to verify whether a signed-in Discord account is currently a member of that server.

## Security boundaries

- The browser receives only the public Supabase publishable key.
- The Discord bot token remains an encrypted Edge Function secret.
- The browser cannot insert directly into `derby_votes`.
- A pick is immutable after acceptance.
- The database also blocks a second entry from the same Supabase user or Discord account.

If the Discord bot token is ever reset, replace only the `DISCORD_BOT_TOKEN` value in Supabase Edge Function Secrets. No website source file should be changed for a token rotation.
