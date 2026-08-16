# Live Discord verification handoff

The v31 package intentionally ships in visual preview mode. For the live contest, the sign-in action must be replaced with real Discord OAuth and a server-membership check before a vote is accepted.

Recommended production data per entrant:

- contest_id
- discord_user_id (private, unique per contest)
- discord_display_name (public)
- discord_avatar_url (public if available)
- racer_id (public)
- odds_at_entry
- created_at
- verified_guild_member = true

The public Paddock Picks endpoint should expose only display name/avatar/pick. Owner export can include the private Discord user ID for duplicate control and audit.
