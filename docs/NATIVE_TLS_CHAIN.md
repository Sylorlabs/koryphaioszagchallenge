# Native TLS trust-chain foundation

`src/zrt/x509_chain.zag` provides the bounded, pure-Zag trust-store and chain-candidate layer for the native TLS client.

Implemented:

- direct Linux system CA bundle loading from the Debian/Ubuntu, Fedora/RHEL, and common `/etc/ssl` paths;
- direct `openat`/`read` loading capped at 16 MiB, with an extra-byte overflow probe and no shell or external certificate tool;
- strict PEM boundary and Base64 padding validation;
- a maximum of 1,024 trust anchors and 1 MiB per DER certificate;
- strict certificate-envelope, matching inner/outer signature-algorithm, issuer, subject, validity, SPKI, Basic Constraints, Key Usage, and critical-extension representation;
- exact DER issuer/subject candidate matching;
- issuer time, `CA`, `keyCertSign`, and unknown-critical-extension rejection; and
- fail-closed status values that keep `authenticated` and `signatures_ok` false.

The deterministic probe is `probe/x509chaintest.zag`. It also loads the release machine's real system bundle and asserts that it stays within the anchor bound.

## Deliberate security boundary

This module does **not** make HTTPS trusted yet. A structurally valid direct issuer ends with `signature_verification_unavailable`, not success. Release authentication still requires:

1. RSA-PSS and ECDSA certificate-signature verification over the exact `tbsCertificate` bytes;
2. public-key and signature-algorithm parameter parsing and policy;
3. multi-intermediate path construction with loop, depth, path-length, name-constraints, EKU, and algorithm-strength enforcement;
4. TLS 1.3 `CertificateVerify` verification; and
5. wiring the authenticated chain result into `tls.zag` without a bypass.

Until all five exist and negative tests pass, provider HTTPS must continue to fail closed before application data is sent.
