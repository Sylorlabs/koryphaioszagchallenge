#!/usr/bin/env bash
set -euo pipefail
prefix="${1:-${HOME:?}/.local}"
rm -f "$prefix/bin/koryphaios"
rm -f "$prefix/share/applications/koryphaios.desktop"
rm -f "$prefix/share/icons/hicolor/192x192/apps/koryphaios.png"
echo "uninstalled Koryphaios from $prefix"
