# Native Linux packaging

`tools/package.sh` produces a browser-free Linux x86-64 directory containing:

- the static Zag ELF with no userspace GPU-library dependency;
- the X11 desktop entry;
- the Apache-2.0 Koryphaios application icon from the tracked parity snapshot;
- install and uninstall scripts;
- SHA-256 checksums;
- a versioned update manifest.

`tools/package-selftest.sh` verifies the static ELF boundary, all checksums, a
staged installation, installed `--version` execution, and uninstall cleanup.

The generated update manifest deliberately has `signatureRequired: true` and a
null signature. Foundation packaging therefore works, while the release gate
continues to fail until an offline release key signs the manifest and signature
verification is implemented. No key is generated or stored by the repository.
