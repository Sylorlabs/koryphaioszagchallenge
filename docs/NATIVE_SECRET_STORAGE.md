# Native credential storage boundary

The native application must never persist API keys as plaintext. The modules
in `src/native/secret_service.zag` and `src/native/encrypted_vault.zag` establish
the fail-closed boundary without claiming unfinished integration as security.

## Secret Service

The implementation includes a typed lifecycle, strict backend-selection policy,
D-Bus EXTERNAL authentication encoding, method-call framing, `Hello`, and an
encrypted `OpenSession` request encoder. D-Bus authentication or service
discovery alone never marks credential storage ready.

Live Secret Service credential operations remain blocked on the standardized
`dh-ietf1024-sha256-aes128-cbc-pkcs7` session primitives: 1024-bit modular DH,
AES-128-CBC, PKCS#7 handling, reply parsing, and collection/item calls. The
unencrypted `plain` OpenSession mode is intentionally prohibited. Until those
pieces land, Secret Service remains credential-ineligible rather than silently
downgrading.

## Explicit encrypted-vault fallback

The fallback uses a versioned binary envelope and RFC 8439
ChaCha20-Poly1305. Every record has a fresh 96-bit nonce and provider-scoped
associated data; wrong keys, wrong scopes, tampering, truncated input, and
trailing input fail closed. Writes are atomic and the final file is mode 0600.

The vault accepts only an explicitly supplied 32-byte high-entropy key. It does
not hash a password with SHA-256 or repeated HMAC and call that secure. A
password-backed vault remains unavailable until the pure-Zag runtime includes a
reviewed memory-hard password KDF such as Argon2id and secure memory handling.

Known hardening still required before release integration:

- locked/guarded memory and guaranteed compiler-resistant secret zeroization;
- live Secret Service encrypted-session negotiation and reply validation;
- key acquisition UX that does not place a vault key in argv, logs, or project
  files;
- crash/recovery fixtures and integration with startup readiness.

## Focused verification

Compile and run directly with the pinned compiler:

```sh
toolchain/zag/zag-poc/znc src/native/secret_storage_test.zag \
  -o build/secret_storage_test --analyze-strict
build/secret_storage_test
```

The suite covers state-transition rejection, exact EXTERNAL auth encoding,
encrypted-mode selection, authenticated round trips, wrong-key and wrong-scope
rejection, tampering, malformed envelopes, weak-key rejection, and encrypted
atomic persistence.
