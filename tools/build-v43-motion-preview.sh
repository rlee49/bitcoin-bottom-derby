#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$project_dir/qa-v43/motion-preview-frames"
mkdir -p "$out_dir"
rm -f "$out_dir"/frame-*.png

racers=(bike rodster tatiana tom whitesw0n)
xs=(510 480 450 420 390)
ys=(215 351 487 623 759)
widths=(288 304 276 300 276)
heights=(202 204 198 204 198)
offsets=(6 0 3 9 2)

for n in $(seq 0 47); do
  frame="$out_dir/frame-$(printf '%03d' "$n").png"
  convert -size 1040x910 xc:'#b86535' \
    -fill '#df9e72' -draw 'rectangle 0,135 1039,138 rectangle 0,271 1039,274 rectangle 0,407 1039,410 rectangle 0,543 1039,546 rectangle 0,679 1039,682 rectangle 0,815 1039,818' \
    \( "$project_dir/assets/realistic-v43/crowd-banner.png" -resize '1040x230!' \) -geometry +0+0 -composite "$frame"

  for i in "${!racers[@]}"; do
    idx=$(((n + offsets[i]) % 12))
    racer_frame="$project_dir/assets/realistic-v43/${racers[i]}/frame-$(printf '%02d' "$idx").png"
    next_frame="$out_dir/.next-${n}-${i}.png"
    convert "$frame" \( "$racer_frame" -resize "${widths[i]}x${heights[i]}" \) \
      -geometry "+${xs[i]}+${ys[i]}" -composite "$next_frame"
    mv "$next_frame" "$frame"
  done
done

ffmpeg -y -hide_banner -loglevel error -framerate 10 -i "$out_dir/frame-%03d.png" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$project_dir/qa-v43/running-track-preview.mp4"

convert "$out_dir/frame-000.png" "$out_dir/frame-006.png" "$out_dir/frame-012.png" "$out_dir/frame-018.png" \
  "$out_dir/frame-024.png" "$out_dir/frame-030.png" "$out_dir/frame-036.png" "$out_dir/frame-042.png" \
  -resize 520x455 -bordercolor '#101820' -border 2x2 -append "$project_dir/qa-v43/runtime-storyboard.png"
