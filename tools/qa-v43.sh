#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
racers=(rodster tatiana bike tom whitesw0n)

node --check "$project_dir/app.js"
node --check "$project_dir/race-config.js"
node --check "$project_dir/community-config.js"

total_frames=0
for racer in "${racers[@]}"; do
  racer_dir="$project_dir/assets/realistic-v43/$racer"
  mapfile -t frames < <(find "$racer_dir" -maxdepth 1 -type f -name 'frame-*.png' | sort)
  if [[ "${#frames[@]}" -ne 12 ]]; then
    echo "$racer: expected 12 PNG frames, found ${#frames[@]}" >&2
    exit 1
  fi

  unique_count="$(sha256sum "${frames[@]}" | awk '{print $1}' | sort -u | wc -l)"
  if [[ "$unique_count" -ne 12 ]]; then
    echo "$racer: duplicate frame bytes detected" >&2
    exit 1
  fi

  for frame in "${frames[@]}"; do
    read -r width height < <(identify -format '%w %h\n' "$frame")
    if [[ "$width" -ne 600 || "$height" -ne 460 ]]; then
      echo "$frame: expected 600x460, found ${width}x${height}" >&2
      exit 1
    fi

    geometry="$(identify -format '%@' "$frame")"
    if [[ ! "$geometry" =~ ^([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+)$ ]]; then
      echo "$frame: could not determine transparent margins" >&2
      exit 1
    fi
    content_w="${BASH_REMATCH[1]}"
    content_h="${BASH_REMATCH[2]}"
    left="${BASH_REMATCH[3]}"
    top="${BASH_REMATCH[4]}"
    right=$((600 - left - content_w))
    bottom=$((460 - top - content_h))
    if (( left < 40 || right < 40 || top < 10 || bottom < 10 )); then
      echo "$frame: insufficient padding L/T/R/B ${left}/${top}/${right}/${bottom}" >&2
      exit 1
    fi
  done

  total_frames=$((total_frames + 12))
done

if rg -q 'v35FrameUrls|animateFixedRacersInPlace|v35-racer-frame' "$project_dir/app.js"; then
  echo "Legacy v35 animation code is still active" >&2
  exit 1
fi

if ! rg -q 'discordAvatar' "$project_dir/app.js" "$project_dir/race-config.js"; then
  echo "Discord avatars are not connected to the left racer cards" >&2
  exit 1
fi

if [[ ! -f "$project_dir/assets/realistic-v43/crowd-banner.png" ]]; then
  echo "Missing v40 crowd and mountain background" >&2
  exit 1
fi

read -r crowd_w crowd_h < <(identify -format '%w %h\n' "$project_dir/assets/realistic-v43/crowd-banner.png")
if [[ "$crowd_w" -ne 1820 || "$crowd_h" -ne 403 ]]; then
  echo "Crowd banner must remain at the approved 1820x403 crop; found ${crowd_w}x${crowd_h}" >&2
  exit 1
fi

if ! rg -q "background-size:cover!important" "$project_dir/alternate.css"; then
  echo "Crowd is not using proportional cover sizing" >&2
  exit 1
fi
if rg -q "crowd-banner\.png[^}]*background-size:100% 100%" "$project_dir/alternate.css"; then
  echo "Crowd has a stretching rule" >&2
  exit 1
fi
if rg -q "bike-crank|transition:\s*opacity|v40-racer-frame-back" "$project_dir/app.js" "$project_dir/alternate.css"; then
  echo "Synthetic crank or ghost-frame animation code is active" >&2
  exit 1
fi

baseline="$project_dir/../bitcoin-bottom-derby-public-v37-PHOTOREALISTIC-FULL-RELEASE/assets/realistic-v37"
for racer in bike whitesw0n; do
  for frame in "$project_dir/assets/realistic-v43/$racer"/frame-*.png; do
    name="$(basename "$frame")"
    cmp -s "$frame" "$baseline/$racer/$name" || {
      echo "$racer/$name no longer matches the coherent v37 animation geometry" >&2
      exit 1
    }
  done
done

rg -q '\$100 in TAO' "$project_dir/app.js" || { echo "TAO prize is missing" >&2; exit 1; }
if rg -q "picked \? '✓ Paddock Picks'" "$project_dir/app.js"; then
  echo "Your Pick still repeats Paddock Picks" >&2
  exit 1
fi
rg -q 'color: "#bdc9d8"' "$project_dir/race-config.js" || { echo "Tatiana silver accent missing" >&2; exit 1; }
rg -q 'background:#061527' "$project_dir/alternate.css" || { echo "Dark Paddock Picks body missing" >&2; exit 1; }

tatiana_source="$project_dir/../bitcoin-bottom-derby-public-v40-COHERENT-MOTION-WIP/assets/realistic-v40/tatiana"
for frame in "$project_dir/assets/realistic-v43/tatiana"/frame-*.png; do
  name="$(basename "$frame")"
  alpha_delta="$(compare -metric AE \( "$frame" -alpha extract \) \( "$tatiana_source/$name" -alpha extract \) null: 2>&1 || true)"
  if [[ "$alpha_delta" != "0" ]]; then
    echo "Tatiana alpha/geometry changed in $name" >&2
    exit 1
  fi
done

tatiana_saturation="$(convert "$project_dir/assets/realistic-v43/tatiana/frame-00.png" -colorspace HSL -channel G -separate +channel -format '%[fx:mean]' info:)"
awk -v value="$tatiana_saturation" 'BEGIN{exit !(value > 0.035)}' || {
  echo "Tatiana appears globally desaturated; natural skin is not preserved" >&2
  exit 1
}

rg -q '\.track-stage::after,' "$project_dir/alternate.css" || { echo "Fence rail is not disabled" >&2; exit 1; }
rg -q '\.fence-signs,' "$project_dir/alternate.css" || { echo "Eight-week sign is not disabled" >&2; exit 1; }
rg -q '\.finish-ahead' "$project_dir/alternate.css" || { echo "Oct 6 track sign is not disabled" >&2; exit 1; }

echo "PASS: v43 has 60 clean padded frames, photoreal corn Tom without matte edge, natural-skin Tatiana, no crowd fence/date overlays, and preserved approved UI."
