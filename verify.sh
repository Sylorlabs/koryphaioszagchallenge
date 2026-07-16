#!/usr/bin/env bash
# Single authority gate for the native rewrite.
set -euo pipefail
cd "$(dirname "$0")"

profile="${1:-foundation}"
znc="${ZNC:-/home/micah/Desktop/Sylorlabs/zag/zag-poc/znc}"
fail=0

record() {
  local name="$1" result="$2" detail="$3"
  printf '%s\t%s\t%s\n' "$name" "$result" "$detail"
  if [[ "$result" != "pass" ]]; then fail=1; fi
}

if [[ -x "$znc" ]]; then record compiler-path pass native; else record compiler-path fail missing; fi
expected="$(awk -F= '$1 == "znc_sha256" { print $2 }' TOOLCHAIN.lock)"
actual="$(sha256sum "$znc" | awk '{ print $1 }')"
if [[ "$expected" == "$actual" ]]; then record compiler-lock pass pinned; else record compiler-lock fail drift; fi

if git ls-files | rg '(^build/|^data/|\.db(-|$)|\.log$|^frontend/public/)' >/dev/null; then
  record git-hygiene fail tracked-generated-or-browser-artifact
else
  record git-hygiene pass clean
fi
if [[ -f LICENSE && -f docs/PROVENANCE.md ]]; then record provenance pass documented; else record provenance fail missing-license-or-provenance; fi

if "$znc" src/native/main.zag -o build/koryphaios --analyze-strict >/tmp/koryphaios-zag-build.log 2>&1; then
  record native-build pass strict
else
  record native-build fail strict-build
  sed -n '1,80p' /tmp/koryphaios-zag-build.log >&2
fi

if [[ -x build/koryphaios ]] && build/koryphaios --headless-test | rg -q 'native-headless: PASS'; then
  record native-headless pass contract-keyboard-pointer-renderer
else
  record native-headless fail failed
fi

if "$znc" src/native/core_test.zag -o build/core_test --analyze-strict >/tmp/koryphaios-zag-core-build.log 2>&1 &&
   build/core_test | rg -q 'NATIVE CORE: ALL PASS'; then
  record native-core pass persistence-recovery-providers-errors
else
  record native-core fail failed
  sed -n '1,80p' /tmp/koryphaios-zag-core-build.log >&2
fi

if rg -n -i 'coming soon|placeholder|fake provider|estimated tokens' src/native >/tmp/koryphaios-placeholder-audit.log; then
  record placeholder-audit fail forbidden-native-placeholder
  sed -n '1,40p' /tmp/koryphaios-placeholder-audit.log >&2
else
  record placeholder-audit pass no-forbidden-markers
fi

if rg -n 'http_server_make|frontend/public|/api/|WebSocket UI' src/native |
   rg -v 'No HTTP server|No UI action|No HTTP listener|No HTTP or WebSocket' >/tmp/koryphaios-browser-audit.log; then
  record browser-boundary fail browser-transport-reference
  sed -n '1,40p' /tmp/koryphaios-browser-audit.log >&2
else
  record browser-boundary pass in-process-only
fi

capture_ok=1
for spec in "1024 640 1" "1280 720 1" "1440 900 1" "1280 800 2"; do
  read -r w h scale <<<"$spec"
  path="/tmp/koryphaios-native-$w-$h-$scale.bmp"
  if ! build/koryphaios --capture "$path" --width "$w" --height "$h" --scale "$scale" >/dev/null ||
     ! file "$path" | rg -q "$w x $h"; then
    capture_ok=0
  fi
done
if [[ "$capture_ok" == 1 ]]; then record deterministic-captures pass four-resolutions-including-hidpi; else record deterministic-captures fail capture-error; fi

capture_a="/tmp/koryphaios-native-determinism-a.bmp"
capture_b="/tmp/koryphaios-native-determinism-b.bmp"
build/koryphaios --capture "$capture_a" --width 1024 --height 640 >/dev/null
build/koryphaios --capture "$capture_b" --width 1024 --height 640 >/dev/null
if cmp -s "$capture_a" "$capture_b"; then record capture-determinism pass byte-identical; else record capture-determinism fail changed-pixels; fi

case "$profile" in
  foundation) ;;
  release)
    record parity fail unresolved-native-workflows
    record tls-pki fail x509-chain-validation-not-implemented
    record accessibility fail atspi-not-implemented
    record packaging fail release-artifacts-not-implemented
    ;;
  *)
    record invocation fail unknown-profile
    ;;
esac

if (( fail )); then exit 1; fi
