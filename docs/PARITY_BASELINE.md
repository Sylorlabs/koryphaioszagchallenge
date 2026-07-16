# Parity baseline

The source reference is Koryphaios commit
353598028393fbe9954900d7cc902aff262ad167, captured while the checkout had
uncommitted provider, startup-gating, notes, collaboration, and UI work.
That dirty state is material: this matrix is a migration contract, not a claim
that the reference was a release snapshot.

The dirty checkout contained 53 porcelain-status entries. Its baseline
fingerprint is
f5a20ca9b5f4931a6af6904378a112b0e40c9c685c1c4ad09b5a17fb60e09ecf,
calculated over HEAD, binary working/index diffs, status, and untracked-file
digests.

| Area | Reference behavior | Native status |
| --- | --- | --- |
| Desktop shell, sessions, messages | Tauri + Svelte | Native X11 shell with keyboard/pointer creation, untouched-session reuse, explicit force-new, rename, confirmed delete, selection, composer, persistent user messages/settings, and restart recovery; regeneration and provider replies remain pending |
| Providers and exact usage | API and CLI providers | Twelve distinct native identities inventoried; six CLI harnesses use provider-specific, executable-only PATH detection; Cline has a direct-exec, nonblocking NDJSON adapter with owned-auth detection, persisted selection, cancellation, timeout, stderr/exit truth, and unknown usage omitted; a test-only simulator verifies deterministic event ordering; other API/CLI executors pending |
| TLS PKI | Backend transport | Strict DER/leaf parsing, SAN hostname and validity checks, and TLS Finished verification landed; all provider HTTPS still fails closed until system-root chain building and certificate/CertificateVerify signatures are verified |
| Credential storage | Plaintext must be removed | Authenticated encrypted-vault foundation with explicit 256-bit key and atomic mode-0600 writes; Secret Service encrypted-session framing exists, but live collection/item operations and safe password-key derivation remain blocked |
| Legacy persistence | SQLite sessions/settings and project Markdown | Backup-first portable schema-v0 import covers sessions, messages, selected provider, and session-creation policy with exact usage and idempotency; direct SQLite and remaining data domains pending |
| Notes, memory, project docs | Markdown plus APIs | Authoritative `.koryphaios/memory/PROJECT.md` and `.koryphaios/rules/PROJECT.md` load, atomically save, persist across restart, and have keyboard-native editors; notes graph, search, rich preview, and broader project documents pending |
| Git, files, processes, tools | Backend routes and tool loop | Existing legacy Zag core; in-process migration pending |
| Worker/critic and ask-user | WebSocket events | Existing legacy state machine; native event binding pending |
| Teams and relay | Collaboration transport | Compatibility inventory pending |
| Settings/accessibility | Svelte settings and browser semantics | Native provider drawer, command palette, and persisted session-creation preference; remaining settings and AT-SPI pending |
| Performance | Browser runtime behavior | Headless warm-start, 10,000-event/120-frame worst-frame, and peak-RSS foundation thresholds enforced; live-X11 idle CPU and p95 input latency pending |

No planned or pending row counts as feature parity. The release verifier fails
closed until every row has an approved implementation and evidence.
