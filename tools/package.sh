#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

out="${1:-artifacts/koryphaios-linux-x86_64}"
./build.sh >/tmp/koryphaios-package-build.log

if ! file build/koryphaios | rg -q 'ELF 64-bit.*x86-64.*statically linked'; then
  echo 'package: native binary is not a static x86-64 ELF' >&2
  exit 1
fi
if readelf -l build/koryphaios 2>/dev/null | rg -q 'INTERP'; then
  echo 'package: native binary unexpectedly has a dynamic interpreter' >&2
  exit 1
fi

rm -rf "$out"
mkdir -p "$out/bin" "$out/share/applications" "$out/share/icons/hicolor/192x192/apps"
install -m 0755 build/koryphaios "$out/bin/koryphaios"
install -m 0644 packaging/koryphaios.desktop "$out/share/applications/koryphaios.desktop"
install -m 0644 reference/Koryphaios/frontend/static/logo-192.png "$out/share/icons/hicolor/192x192/apps/koryphaios.png"
install -m 0755 tools/install.sh "$out/install.sh"
install -m 0755 tools/uninstall.sh "$out/uninstall.sh"
(
  cd "$out"
  sha256sum bin/koryphaios share/applications/koryphaios.desktop \
    share/icons/hicolor/192x192/apps/koryphaios.png > SHA256SUMS
)
size="$(stat -c %s "$out/bin/koryphaios")"
sha="$(sha256sum "$out/bin/koryphaios" | awk '{print $1}')"
printf '{"schemaVersion":1,"version":"0.3.0","target":"linux-x86_64-x11","sha256":"%s","size":%s,"signatureRequired":true,"signature":null}\n' "$sha" "$size" > "$out/update-manifest.json"
echo "package: PASS $out"
