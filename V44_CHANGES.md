# v44 Tom clean photorealistic test release

v44 is a deliberately narrow repair based directly on the user-supplied
`bitcoin-bottom-derby-public-v43-CLEAN-FINISH-FULL-TEST-RELEASE(1).zip`.
The locked v32 master was not opened or modified.

## Changed

- Replaced only Tom's twelve active `600 x 460` animation frames.
- Uses the accepted photorealistic corn-cob cowboy riding the realistic gray donkey.
- Removed enclosed white matte pockets between and beneath the donkey's legs.
- Decontaminated white-matted antialias pixels so Tom composites cleanly over both the orange track and dark backgrounds.
- Enlarged the accepted source poses uniformly while retaining generous transparent padding.
- Preserved the full carrot and thin stick in every frame; neither touches a canvas edge.

## Intentionally unchanged from v43

- The dense mountain crowd and its crop/cover behavior.
- Bike, Rodster, Tatiana, and WhiteSw0n artwork and animation.
- Left card layout and all five Discord avatar images.
- HTML, CSS, JavaScript, race configuration, daily-close scoring, Bookie Board, Bitcoin Depth Meter, Paddock Picks, Race Info, and Discord preview behavior.
- The static-site deployment files and documentation history.

## Visual QA included

- `qa-v44/running-track-preview.mp4`: 48 frames / four complete cycles at the release geometry.
- `qa-v44/runtime-storyboard.png`: eight checkpoints from the running preview.
- `qa-v44/tom-track-contact.png`: all twelve frames on the actual orange track color.
- `qa-v44/tom-blue-contact.png`: all twelve frames on a dark halo-revealing background.
- `tools/qa-v44.sh`: automated frame, padding, alpha, carrot, baseline-integrity, animation, crowd, and Discord-avatar checks.

No remaining white matte pockets, clipped Tom extremities, duplicate Tom frames, missing carrot frames, or frame-order pauses were found in the release audit.
