# Bitcoin Bottom Derby — v44 Tom Clean Photorealistic Test Release

**This is a complete test release for final visual approval. The approved v32 final/master build remains locked and unchanged.**

v44 starts from the user-supplied v43 clean-finish release and changes only Tom's twelve active animation PNGs. Tom is now the accepted photorealistic corn-man on the gray donkey; all enclosed white matte pockets and visible white edge contamination were removed, and the carrot plus stick remain visible throughout the complete cycle.

The v43 crowd, mountains, layout, UI, Discord card portraits, application code, race rules, and the other four racers are byte-for-byte unchanged. See `V44_CHANGES.md` and `V44_BASELINE_PROOF.md` for the exact scope and QA evidence.

Serve the folder rather than opening `index.html` directly:

```bash
python3 -m http.server 8080
```

Run the packaged audit with:

```bash
./tools/qa-v44.sh
```

---

# Bitcoin Bottom Derby v7 — Animated Racers

This is the public-ready build using the four approved illustrated racers rather than hand-drawn SVG horses.

## Animated race characters

- **Tom:** corn humanoid riding the carrot-chasing donkey
- **Tatiana:** female jockey with long black hair riding the sunglasses horse
- **Rodster:** sinister armored knight charging on a black warhorse
- **Bike:** horse cyclist with rotating wheels, a moving crank, and pedaling motion

Each racer uses a compact animated WebP loop plus a static PNG fallback:

- `assets/racers/tom-moving.webp`
- `assets/racers/tatiana-moving.webp`
- `assets/racers/rodster-moving.webp`
- `assets/racers/bike-moving.webp`

The horse and donkey loops use an eight-frame gallop cycle with moving legs, body rise-and-fall, and tail movement. Bike uses a ten-frame cycling loop with pedaling-leg motion, rotating wheel spokes, and a rotating crank.

The animation is cosmetic. Official track position still advances only after a completed daily Bitcoin candle.

## Main files

- `index.html` — page structure
- `styles.css` — layout, track, crowd, and motion effects
- `app.js` — live Bitcoin data, race scoring, odds, voting, and rendering
- `race-config.js` — dates, prices, names, colors, and racer settings
- `track-animation-preview.webp` — short animated preview of the completed track

## Publishing

The site is static and can be published with GitHub Pages. The included deployment workflow is already configured.

1. Upload every file and folder to the root of a public GitHub repository.
2. Include the hidden `.github` folder and `.nojekyll` file.
3. Open **Settings → Pages**.
4. Select **GitHub Actions** as the source.
5. Let the included workflow publish the site.

## Voting limitation

The local demonstration mode stores one pick per browser device and provides a readable TXT export. A truly shared public Discord-member entry pool still requires the supplied Supabase setup or another backend.


## v32 polish
See `V32_CHANGES.md` for the final Tom/WhiteSw0n clipping repair and depth-meter/countdown sign fixes.

## v40 photorealistic release

Open `index.html` through a static web server. The approved v32 master remains separate and unchanged.
