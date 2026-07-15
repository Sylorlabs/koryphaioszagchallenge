#!/usr/bin/env bash
# Build Koryphaios-Zag: one static binary, no external toolchain.
set -euo pipefail
cd "$(dirname "$0")"
ZNC="${ZNC:-/home/micah/Desktop/Sylorlabs/zag/zag-poc/znc}"
mkdir -p build

echo "── crypto test vectors (RFC 4231/5869/8439/7748)"
"$ZNC" probe/hashtest.zag -o build/hashtest --run 2>&1 | grep -iE "ALL PASS|checks passed" | tail -1
"$ZNC" probe/aeadtest.zag -o build/aeadtest --run 2>&1 | grep -iE "ALL PASS|checks passed" | tail -1
"$ZNC" probe/x25test.zag  -o build/x25test  --run 2>&1 | grep -iE "ALL PASS|checks passed" | tail -1

echo "── zrt test suite"
"$ZNC" src/zrt/zrt_test.zag -o build/zrt_test --run 2>&1 | grep -iE "ALL PASS|checks passed" | tail -1

echo "── koryphaios"
"$ZNC" src/main.zag -o build/koryphaios
ls -la build/koryphaios
echo "run: ./build/koryphaios   (KORYPHAIOS_PORT=3001 by default)"
