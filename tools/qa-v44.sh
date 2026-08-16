#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
racers=(rodster tatiana bike tom whitesw0n)

node --check "$project_dir/app.js"
node --check "$project_dir/race-config.js"
node --check "$project_dir/community-config.js"

(cd "$project_dir" && sha256sum --quiet -c V43_RUNTIME_BASELINE.sha256)
(cd "$project_dir" && sha256sum --quiet -c V44_TOM_FRAMES.sha256)

for racer in "${racers[@]}"; do
  racer_dir="$project_dir/assets/realistic-v43/$racer"
  mapfile -t frames < <(find "$racer_dir" -maxdepth 1 -type f -name 'frame-*.png' | sort)
  [[ "${#frames[@]}" -eq 12 ]] || { echo "$racer: expected 12 frames, found ${#frames[@]}" >&2; exit 1; }
  unique_count="$(sha256sum "${frames[@]}" | awk '{print $1}' | sort -u | wc -l)"
  [[ "$unique_count" -eq 12 ]] || { echo "$racer: duplicate frame bytes detected" >&2; exit 1; }
  for frame in "${frames[@]}"; do
    read -r width height < <(identify -format '%w %h\n' "$frame")
    [[ "$width" -eq 600 && "$height" -eq 460 ]] || { echo "$frame: expected 600x460" >&2; exit 1; }
  done
done

python3 "$project_dir/tools/qa-tom-v44.py" "$project_dir"

crowd="$project_dir/assets/realistic-v43/crowd-banner.png"
read -r crowd_w crowd_h < <(identify -format '%w %h\n' "$crowd")
[[ "$crowd_w" -eq 1820 && "$crowd_h" -eq 403 ]] || { echo "crowd dimensions changed" >&2; exit 1; }
echo '4fec960df85140a6c54d216bc0fa9e7d321949091be044b4b998a611b5df514f'"  $crowd" | sha256sum --quiet -c -
rg -q "background-image:url\('assets/realistic-v43/crowd-banner.png'\)" "$project_dir/alternate.css"
rg -q 'background-size:cover!important' "$project_dir/alternate.css"
! rg -q "crowd-banner\.png[^}]*background-size:100% 100%" "$project_dir/alternate.css"

rg -q "Array.from\(\{length: 12\}" "$project_dir/app.js"
rg -q 'requestAnimationFrame\(animateRacersInPlace\)' "$project_dir/app.js"
! rg -q 'transition:\s*opacity|v40-racer-frame-back' "$project_dir/app.js" "$project_dir/alternate.css"

for racer in bike rodster tatiana tom whitesw0n; do
  rg -q "discordAvatar: \"assets/avatar-${racer}\.png\"" "$project_dir/race-config.js"
done
rg -q 'r\.discordAvatar \|\| r\.avatar' "$project_dir/app.js"

preview="$project_dir/qa-v44/running-track-preview.mp4"
IFS=, read -r preview_w preview_h preview_frames < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,nb_frames -of csv=p=0 "$preview")
[[ "$preview_w" -eq 1040 && "$preview_h" -eq 910 && "$preview_frames" -eq 48 ]] || {
  echo "running preview audit failed: ${preview_w}x${preview_h}, ${preview_frames} frames" >&2
  exit 1
}

echo 'PASS: v44 preserves the v43 runtime/crowd/Discord portraits, has 60 unique padded frames, and Tom passes all 12-frame alpha, halo, carrot, clipping, and running-preview checks.'
