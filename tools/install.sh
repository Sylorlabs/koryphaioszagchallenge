#!/usr/bin/env bash
set -euo pipefail
package_dir="$(cd "$(dirname "$0")" && pwd)"
prefix="${1:-${HOME:?}/.local}"
install -d "$prefix/bin" "$prefix/share/applications" "$prefix/share/icons/hicolor/192x192/apps"
install -m 0755 "$package_dir/bin/koryphaios" "$prefix/bin/koryphaios"
install -m 0644 "$package_dir/share/applications/koryphaios.desktop" "$prefix/share/applications/koryphaios.desktop"
install -m 0644 "$package_dir/share/icons/hicolor/192x192/apps/koryphaios.png" "$prefix/share/icons/hicolor/192x192/apps/koryphaios.png"
echo "installed Koryphaios under $prefix"
