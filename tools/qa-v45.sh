#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
racers=(rodster tatiana bike tom whitesw0n)

node --check "$project_dir/app.js"
node --check "$project_dir/race-config.js"
node --check "$project_dir/community-config.js"
node --check "$project_dir/supabase-config.js"

# Preserve every v43/v44 visual byte while allowing the v45 production code changes.
(cd "$project_dir" && awk '$2 ~ /^assets\// && $2 !~ /^assets\/realistic-v43\/tom\/frame-/ { print }' V43_RUNTIME_BASELINE.sha256 | sha256sum --quiet -c -)
(cd "$project_dir" && awk '$2 == "alternate.css" || $2 == "race-config.js" { print }' V43_RUNTIME_BASELINE.sha256 | sha256sum --quiet -c -)
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

rg -q 'previewMode: false' "$project_dir/community-config.js"
! rg -q 'ChartNerd|MoonStacker|CandleWatcher|SatsAndCoffee|DipHunter|OrangePill|BlockRunner|HashRider|LowFinder|WickSniper' "$project_dir/community-config.js" "$project_dir/app.js"
rg -q 'publishableKey: "sb_publishable_' "$project_dir/supabase-config.js"
! rg -q 'sb_secret_|service_role|DISCORD_BOT_TOKEN\s*[:=]\s*["'"'][^"'"']+["'"']' "$project_dir/supabase-config.js" "$project_dir/app.js"
rg -q 'functions\.invoke\(backend\.functionName' "$project_dir/app.js"
rg -q "rpc\('get_derby_vote_totals'" "$project_dir/app.js"
rg -q "rpc\('get_derby_public_entries'" "$project_dir/app.js"
rg -q "rpc\('get_my_derby_vote'" "$project_dir/app.js"
rg -q "provider: 'discord'" "$project_dir/app.js"
rg -q 'cdn.jsdelivr.net/npm/@supabase/supabase-js@2' "$project_dir/index.html"

for racer in bike rodster tatiana tom whitesw0n; do
  rg -q "discordAvatar: \"assets/avatar-${racer}\.png\"" "$project_dir/race-config.js"
done
rg -q 'r\.discordAvatar \|\| r\.avatar' "$project_dir/app.js"

echo 'PASS: v45 production code is configured, preview identities are removed, all 60 active frames are unique, and every approved v44 visual asset remains unchanged.'
