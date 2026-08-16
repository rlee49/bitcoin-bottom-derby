# End-user preview — v31

This release shows the public Discord participation experience before live credentials are connected.

## What a visitor sees

- The full Bitcoin Bottom Derby race is public and requires no login to watch.
- The Bookie Board has one central **Sign in with Discord** entry panel instead of asking for a typed Discord name on every racer card.
- After verification, the visitor chooses exactly one racer and confirms the pick is locked.
- Their public display name and pick appear in **Paddock Picks**, grouped by racer so the Discord community can see who backed whom.
- The public page does not expose Discord numeric IDs, email addresses, access tokens, or owner-only records.

## Preview behavior

`community-config.js` has `previewMode: true` so the Discord sign-in button can be demonstrated locally without credentials. It asks for a preview display name and then shows the verified/locked-pick flow.

The sample Paddock Picks are clearly labeled preview data. They are not real contest entries.

## Live launch

Before public launch, connect Discord OAuth + server membership verification + Supabase storage. Then set `previewMode` to `false` and feed authenticated member/entry data into the same UI.
