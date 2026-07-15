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

The compiler lock records both the upstream Git revision and the exact local
native compiler digest. A verifier failure means the build is not reproducible.
