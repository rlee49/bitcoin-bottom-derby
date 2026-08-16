# v40 coherent-motion test release

This complete test build replaces the rejected v38/v39 animation experiment. The locked v32 master remains unchanged.

## Animation

- Uses 12 independent, padded 600×460 PNG frames for every racer.
- Removes dual-layer opacity blending that caused doubled horses and ghost frames.
- Preserves the coherent v37 geometry for Bike, Tom, and WhiteSw0n.
- Tatiana retains her coherent motion geometry with black hair.
- Rodster's cape is removed while retaining the knight, warhorse, and lance.
- Per-racer time-based cadence remains continuous across interface updates.

## Crowd and cards

- Replaces the stretched crowd with a sharp 1820×403 proportional banner.
- Adds a denser crowd, more crypto flags, Doge and frog fans, orange smoke, and opposing black smoke.
- Uses proportional `cover` sizing instead of forced width/height stretching.
- Keeps the supplied Discord portraits on the left racer cards.

## Verification

- JavaScript syntax checks pass.
- All 60 animation frames are unique and have transparent edge padding.
- Bike, Tom, and WhiteSw0n frames are byte-identical to the coherent baseline.
- No ghost-frame opacity transition or synthetic crank overlay is active.
- Locked v32 checksum verified unchanged before packaging.

## Test status

This is a complete runnable test release for visual review. The included motion preview is a track-proportion QA composition; final approval still depends on testing the running site in the user's browser at desktop and mobile widths.
