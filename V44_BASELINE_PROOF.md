# v44 baseline proof

The sole visual/product baseline for v44 is the user-supplied v43 clean-finish ZIP.

- Supplied ZIP SHA-256: `5724f7291c6c785f9114ea645ed97ec33adf3c0a78a0d68c9a804e9d290fd131`
- Preserved crowd asset: `assets/realistic-v43/crowd-banner.png`
- Crowd dimensions: `1820 x 403`
- Crowd SHA-256: `4fec960df85140a6c54d216bc0fa9e7d321949091be044b4b998a611b5df514f`

`V43_RUNTIME_BASELINE.sha256` records the v43 hashes for the complete runtime,
deployment files, and every visual asset except Tom's twelve replaced frames.
`tools/qa-v44.sh` verifies that manifest from inside the release.

The v44 source-to-release directory comparison was also audited before packaging:
the only changed v43 visual files were
`assets/realistic-v43/tom/frame-00.png` through `frame-11.png`; v44 adds only
its release notes, QA evidence, and QA/rebuild tools.
