# v40 coherent-motion work notes

This folder is a work-in-progress review build, not a released successor to the locked v32 master.

- v38 and v39 were rejected after visual review because regenerated geometry and opacity blending produced choppy or doubled racers; the crowd was also stretched.
- v40 resets Bike, Tom, and WhiteSw0n to the coherent v37 frame pixels.
- Tatiana keeps the same v37 motion geometry; only her hair is recolored black.
- Rodster keeps the same v37 horse, rider, and lance geometry; cape/banner pixels are removed deterministically.
- The crowd is cropped to 1820x403, matching the desktop banner ratio, and displayed with proportional `cover` sizing.
- No full release ZIP should be made until the running preview is accepted and desktop/mobile browser QA is complete.
