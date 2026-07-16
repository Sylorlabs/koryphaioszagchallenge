# Provenance

src/native/x11.zag, src/native/fb.zag, and src/native/fontdata.zag are
extracted from the sibling PrismStudio checkout at the local baseline available
on 2026-07-15. They retain the Apache-2.0 licensing of that project; the files
are locally tracked here so the native presentation layer is reproducible
without an undeclared runtime dependency.

The original product behavior baseline is the sibling Koryphaios checkout:

- commit: 353598028393fbe9954900d7cc902aff262ad167
- state: dirty at capture; its status fingerprint is recorded in
  docs/PARITY_BASELINE.md.

Zag is pinned as the `toolchain/zag` Git submodule from
`https://github.com/Sylorlabs/zag.git`. `TOOLCHAIN.lock` records the exact
submodule revision, native code-generator digest, compiler version, and compiler
binary digest. The tracked compiler binary is rebuilt from that pure-Zag source
at the same revision. A verifier failure means the build is not reproducible.

The packaged 192px application icon is reused from the tracked Koryphaios parity
snapshot at `reference/Koryphaios/frontend/static/logo-192.png` under the same
Apache-2.0 project license. It is copied only into generated release artifacts.
