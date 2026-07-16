# Koryphaios Zag Challenge

Koryphaios is being rebuilt as a Linux x86-64 native desktop application in
Zag. The release target is X11/XWayland. It has no browser UI, WebView, static
asset server, REST UI boundary, or WebSocket UI boundary.

## Current status

This is an active native rewrite, not a release candidate. The application
opens an X11 window rendered by a locally tracked pure-Zag software framebuffer.
Its user-interface commands use the typed AppCommand/AppEvent boundary in
src/native/contract.zag. Session creation, untouched-session reuse, force-new,
rename, confirmed deletion, selection, user-message and preference persistence,
restart recovery, provider inventory and executable-only CLI detection,
keyboard input, pointer activation, and deterministic capture are exercised
without browser transport. The old browser
implementation is present only in Git history and in the reference snapshot
used for parity inventory.

The work still required before release is deliberately documented in
docs/RELEASE_STATUS.md and docs/PARITY_BASELINE.md. The repository now includes
fail-closed X.509 leaf preflight, authenticated encrypted-vault foundations,
portable legacy session/message migration, static packaging, and headless
performance gates. Full trust-chain validation, live Secret Service operations,
full workflow/data migration, AT-SPI, signed updates, and live-X11 performance
evidence are not represented as completed.

## Build and run

The checked compiler is the native Zag compiler described in TOOLCHAIN.lock and
pinned as a Git submodule.

    git submodule update --init --recursive

    ./build.sh
    ./build/koryphaios --headless-test
    ./build/koryphaios --capture /tmp/koryphaios-native.bmp --width 1280 --height 800 --scale 2
    ./build/koryphaios --x11-selftest
    ./build/koryphaios --project /path/to/project
    ./build/koryphaios --project /path/to/project --migrate /path/to/portable-export.json
    ./build/koryphaios --performance-selftest
    ./build/koryphaios --diagnostics
    ./build/koryphaios

## Verification

    ./verify.sh foundation
    ./verify.sh release

The foundation gate must pass for every milestone. It includes strict build,
core persistence/recovery, keyboard/pointer workflow, browser-boundary and
forbidden-marker audits, repository/source/secret/toolchain provenance policy,
TLS/X.509 preflight, encrypted-secret storage, portable migration, measured
performance, four deterministic captures including HiDPI, and byte-identical
capture comparison. The release gate intentionally fails closed
while release-required capability evidence is unresolved.

## Provenance

The X11/framebuffer foundation is extracted from PrismStudio under Apache-2.0;
the exact origin and Koryphaios behavior baseline are in docs/PROVENANCE.md.
