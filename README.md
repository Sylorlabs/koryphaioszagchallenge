# Koryphaios Zag Challenge

Koryphaios is being rebuilt as a Linux x86-64 native desktop application in
Zag. The release target is X11/XWayland. It has no browser UI, WebView, static
asset server, REST UI boundary, or WebSocket UI boundary.

## Current status

This is the native platform foundation, not a release candidate. The application
opens an X11 window rendered by a locally tracked pure-Zag software framebuffer.
Its user-interface commands use the typed AppCommand/AppEvent boundary in
src/native/contract.zag. The old browser implementation is present only in Git
history and in the reference snapshot used for parity inventory.

The work still required before release is deliberately documented in
docs/RELEASE_STATUS.md and docs/PARITY_BASELINE.md. In particular, X.509 chain
validation, Secret Service storage, full workflow migration, AT-SPI, packaging,
and performance evidence are not represented as completed.

## Build and run

The checked compiler is the native Zag compiler described in TOOLCHAIN.lock.

    ./build.sh
    ./build/koryphaios --headless-test
    ./build/koryphaios --capture /tmp/koryphaios-native.bmp
    ./build/koryphaios --diagnostics
    ./build/koryphaios

## Verification

    ./verify.sh foundation
    ./verify.sh release

The foundation gate must pass for this milestone. The release gate intentionally
fails closed while release-required capability evidence is unresolved; its TSV
records name every blocker rather than masking it with placeholders.

## Provenance

The X11/framebuffer foundation is extracted from PrismStudio under Apache-2.0;
the exact origin and Koryphaios behavior baseline are in docs/PROVENANCE.md.
