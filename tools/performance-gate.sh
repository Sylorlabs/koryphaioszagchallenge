#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
binary="${1:-build/koryphaios}"
out="$(mktemp /tmp/koryphaios-performance.XXXXXX)"
trap 'rm -f "$out"' EXIT
/usr/bin/time -f 'peak_rss_kib=%M elapsed_s=%e' -o "$out" "$binary" --performance-selftest > "${out}.app"
trap 'rm -f "$out" "${out}.app"' EXIT
app="$(cat "${out}.app")"
rss="$(awk -F'[= ]' '/peak_rss_kib/ {print $2}' "$out")"
startup="$(printf '%s\n' "$app" | sed -n 's/.*startup_us=\([0-9][0-9]*\).*/\1/p')"
frame="$(printf '%s\n' "$app" | sed -n 's/.*frame_max_us=\([0-9][0-9]*\).*/\1/p')"
events="$(printf '%s\n' "$app" | sed -n 's/.*feed_events=\([0-9][0-9]*\).*/\1/p')"
if [[ "$app" != performance-selftest:\ PASS* || -z "$rss" || "$rss" -ge 131072 ||
      -z "$startup" || "$startup" -ge 750000 || -z "$frame" || "$frame" -gt 16700 ||
      -z "$events" || "$events" -lt 10000 ]]; then
  echo "performance-gate: FAIL $app peak_rss_kib=${rss:-unknown}" >&2
  exit 1
fi
echo "performance-gate: PASS startup_us=$startup frame_max_us=$frame peak_rss_kib=$rss feed_events=$events"
