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
  record native-headless pass contract-and-renderer
else
  record native-headless fail failed
fi

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
