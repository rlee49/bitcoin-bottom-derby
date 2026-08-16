# v45 production community release

v45 branches from the approved v44 photorealistic final build. The locked v32 master remains unchanged.

## Production backend changes

- Connected the static site to the live Supabase project with the browser-safe publishable key.
- Enabled real Discord OAuth sign-in and persistent sessions.
- Connected shared vote totals, public Paddock Picks, and each member's locked-pick lookup.
- Connected vote submission to the deployed `quick-handler` Edge Function.
- Added server-side membership verification through the private Discord bot.
- Removed ten preview member names, preview sign-in prompts, browser-seeded ticket counts, and local fake public entries.
- Added real Discord profile images to the signed-in member panel and Paddock Picks.
- Added a discreet sign-out control and clear connection/vote error messages.

## Visual baseline preserved

- All 60 active photorealistic animation PNGs are unchanged.
- Tom remains the accepted corn-man on the gray donkey with the carrot/stick visible in all twelve frames and no white matte artifacts.
- The approved crowd banner, mountain crop, track, layout, racer positions, Discord racer card images, and other four racers are unchanged.
- The animation timing, frame order, daily-close movement, Bitcoin price logic, race rules, and depth meter are unchanged.

## Production QA

- JavaScript syntax checks pass.
- Public database totals return five zero-count racer rows from the live database.
- Public entries return an empty genuine-members list before launch.
- The Edge Function CORS preflight returns `204` for the GitHub Pages origin.
- An unauthenticated vote is correctly rejected with `401`.
- Supabase OAuth correctly generates a Discord authorization redirect for application `1538589198498533526` and the configured callback/return URL.
- All active frames remain 600×460, unique, padded, unclipped, and visually represented in the preserved running-animation QA preview.
