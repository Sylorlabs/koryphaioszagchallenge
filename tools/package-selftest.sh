#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pkg="$(mktemp -d /tmp/koryphaios-package.XXXXXX)"
prefix="$(mktemp -d /tmp/koryphaios-install.XXXXXX)"
trap 'rm -rf "$pkg" "$prefix"' EXIT
tools/package.sh "$pkg" >/tmp/koryphaios-package-selftest.log
(cd "$pkg" && sha256sum -c SHA256SUMS >/dev/null)
"$pkg/install.sh" "$prefix" >/dev/null
"$prefix/bin/koryphaios" --version | rg -q '^koryphaios-zag '
"$pkg/uninstall.sh" "$prefix" >/dev/null
test ! -e "$prefix/bin/koryphaios"
echo 'package-selftest: PASS static checksums install launch uninstall'
