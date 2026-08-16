# Bitcoin Bottom Derby v37 — Photorealistic Full Release

## Release scope

- Built as a separate v37 release; the locked v32 master archive was not edited.
- Preserves the daily-candle race logic, live price display, odds, voting, paddock, export, and setup paths from the prior build.
- Includes all code, assets, setup documents, frame-building tools, and QA outputs required to inspect or deploy the release.

## Racer animation

- Rebuilt Bike, Rodster, Tatiana, Tom, and WhiteSw0n as five independent 12-frame sequences.
- Every rendered frame uses the same 600 x 460 transparent canvas.
- Connected-component extraction isolates the intended racer in each source pose, eliminating neighboring-frame fragments, duplicated heads/legs, and vertical crop seams.
- Frames include generous transparent side and vertical padding so full bodies, wheels, lance, cape, donkey, and carrot remain visible during lane movement.
- A time-based `requestAnimationFrame` loop advances each racer at its own 10–13 fps cadence and preserves its current pose when race data re-renders.
- All 60 frames preload before the animation clock starts.
- Bike includes a continuous full-rotation crank overlay synchronized independently from frame updates.

## Visual and readability changes

- Uses the supplied photorealistic alpine festival crowd with visible front-row faces, frog and Doge fans, and readable crypto flags.
- Enlarges small dashboard, odds, entry, race-information, depth-meter, and paddock typography by approximately 20–25%.
- Gives the track and lanes more vertical room and keeps racer wrappers overflow-visible at desktop and mobile breakpoints.
- Uses the previously supplied Discord profile images on the five left-side lane cards only; photorealistic racer artwork remains in the race and other racer UI.

## QA completed

- JavaScript syntax check passed.
- Verified exactly 12 PNG frames for each of five racers.
- Verified all 60 frame hashes are unique.
- Verified every frame is exactly 600 x 460 with transparent safety margins.
- Inspected five contact sheets, a combined 12-pose cycle, and a dedicated Bike pedal/crank cycle.
- Verified v37 frame preloading, time-based animation wiring, Discord-card avatar mapping, and crowd asset paths.
- Audited desktop and mobile layout overrides for visible overflow, lane height, crowd height, card sizing, and responsive typography.
- Verified the locked v32 archive against its pre-work SHA-256 checksum after completing v37.

## Rebuilding and checking frames

From the release folder:

```bash
./tools/build-v37-frames.sh
./tools/qa-v37.sh
```

Visual QA files are under `qa/`.

## Deployment notes

- Serve the folder through any static HTTP server; opening by `file://` may restrict browser API requests.
- Live market data requires normal browser network access to the configured public endpoints.
- Shared public voting requires the included Supabase/Discord configuration; without it, the local device demonstration mode remains available.
