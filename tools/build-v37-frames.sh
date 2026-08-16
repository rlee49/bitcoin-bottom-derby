#!/usr/bin/env bash
set -euo pipefail

# Rebuild the v37 independent animation frames from the five supplied 4x3
# photorealistic source sheets. ImageMagick 6/7 is required.
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-$project_dir/assets/realistic-v37/source}"
output_root="${2:-$project_dir/assets/realistic-v37}"

canvas_w=600
canvas_h=460
cell_w=362
cell_h=362
pad_x=100
pad_y=49
threshold=15
expand=8

declare -A sheet_to_racer=(
  [bitcoin_knight_gallop_sprite_sheet.png]=rodster
  [hot_pink_gallop_sprite_sheet.png]=tatiana
  [bitcoin_cyborg_mount_animation_sprite_sheet.png]=bike
  [corn_cowboy_donkey_gallop_sprite_sheet.png]=tom
  [futuristic_alpaca_rider_gallop_sprite_sheet.png]=whitesw0n
)

declare -A avatar_bg=(
  [rodster]='#09284a'
  [tatiana]='#40142f'
  [bike]='#3b1d08'
  [tom]='#394015'
  [whitesw0n]='#0a3442'
)

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

for sheet_name in "${!sheet_to_racer[@]}"; do
  racer="${sheet_to_racer[$sheet_name]}"
  sheet="$source_dir/$sheet_name"
  racer_dir="$output_root/$racer"
  mkdir -p "$racer_dir"

  if [[ ! -f "$sheet" ]]; then
    echo "Missing source sheet: $sheet" >&2
    exit 1
  fi

  read -r source_w source_h < <(identify -format '%w %h\n' "$sheet")
  if [[ "$source_w" -ne 1448 || "$source_h" -ne 1086 ]]; then
    echo "Unexpected sheet geometry for $sheet_name: ${source_w}x${source_h}" >&2
    exit 1
  fi

  table="$work_dir/$racer-components.txt"
  convert "$sheet" -alpha extract -threshold "${threshold}%" \
    -define connected-components:verbose=true \
    -define connected-components:area-threshold=3000 \
    -connected-components 8 null: 2>&1 \
    | sed -nE 's/^ *([0-9]+): ([0-9]+)x([0-9]+)\+([0-9]+)\+([0-9]+).* ([0-9]+) gray\(255\)$/\1 \2 \3 \4 \5 \6/p' \
    | awk -v cw="$cell_w" -v ch="$cell_h" '$6 > 30000 { row=int(($5+(ch/2))/ch); col=int(($4+(cw/2))/cw); print row*4+col,$0 }' \
    | sort -n > "$table"

  component_count="$(wc -l < "$table")"
  if [[ "$component_count" -ne 12 ]]; then
    echo "Expected 12 isolated figures for $racer, found $component_count" >&2
    exit 1
  fi

  convert "$sheet" -alpha extract "$work_dir/$racer-original-alpha.png"

  while read -r frame_index component_id box_w box_h box_x box_y area; do
    row=$((frame_index / 4))
    col=$((frame_index % 4))
    crop_x=$((box_x - expand))
    crop_y=$((box_y - expand))
    crop_right=$((box_x + box_w + expand))
    crop_bottom=$((box_y + box_h + expand))
    if (( crop_x < 0 )); then crop_x=0; fi
    if (( crop_y < 0 )); then crop_y=0; fi
    if (( crop_right > source_w )); then crop_right=$source_w; fi
    if (( crop_bottom > source_h )); then crop_bottom=$source_h; fi
    crop_w=$((crop_right - crop_x))
    crop_h=$((crop_bottom - crop_y))
    place_x=$((pad_x + crop_x - (col * cell_w)))
    place_y=$((pad_y + crop_y - (row * cell_h)))
    frame_name="frame-$(printf '%02d' "$frame_index").png"

    convert "$sheet" -alpha extract -threshold "${threshold}%" \
      -define connected-components:keep="$component_id" \
      -connected-components 8 -auto-level "$work_dir/$racer-selection.png"
    convert "$work_dir/$racer-original-alpha.png" "$work_dir/$racer-selection.png" \
      -compose Multiply -composite "$work_dir/$racer-final-alpha.png"
    convert "$sheet" "$work_dir/$racer-final-alpha.png" -alpha off \
      -compose CopyOpacity -composite "$work_dir/$racer-isolated.png"
    convert "$work_dir/$racer-isolated.png" -crop "${crop_w}x${crop_h}+${crop_x}+${crop_y}" +repage \
      "$work_dir/$racer-subject.png"
    convert -size "${canvas_w}x${canvas_h}" canvas:none "$work_dir/$racer-subject.png" \
      -geometry "+${place_x}+${place_y}" -composite "$racer_dir/$frame_name"
  done < "$table"

  convert -size 320x320 "xc:${avatar_bg[$racer]}" \
    \( "$racer_dir/frame-00.png" -trim +repage -resize 286x286 \) \
    -gravity center -composite -quality 91 "$racer_dir/avatar.jpg"
done

echo "Built five 12-frame v37 racer sets on ${canvas_w}x${canvas_h} transparent canvases."
