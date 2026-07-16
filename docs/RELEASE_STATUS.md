# Release status

This repository is at the **native core foundation** milestone, not a release
candidate. The old browser server is retained only in baseline history while
its native replacements are landed. The current native entry point has no HTTP
listener and supports --project, --headless-test, --x11-selftest, --capture,
--safe-mode, --migrate, --performance-selftest, --diagnostics, and --version.

Implemented evidence now covers typed in-process commands/events, native session
creation, untouched-session reuse, force-new, rename, confirmed deletion and
selection, persisted session policy, user-message persistence, restart recovery,
schema/settings corruption backup, stable error codes, distinct provider
identities, keyboard and pointer paths, deterministic captures at four
size/scale combinations, and a live X11 connect/render/present/pump/close test.
Provider refresh performs
pure-Zag executable PATH checks for Jules, Gemini CLI, Codex, Claude Code,
Cursor Agent, and Cline without invoking project-local impostors.

Production chat now fails closed before persistence when no real provider
executor is selected, so it cannot leave a misleading user-only turn or partial
loading state. Cline is the first real executor: direct argv execution,
Cline-owned authentication detection, persisted selection, nonblocking NDJSON
processing, cancellation, timeout, stderr/exit diagnostics, and no invented
usage. An explicitly test-only deterministic simulator exercises user
and assistant persistence plus thinking, delta, assistant, and done events. It
is absent from the production catalog and emits no invented token or cost data.

Project memory and rules now remain authoritative Markdown under
`.koryphaios/memory/PROJECT.md` and `.koryphaios/rules/PROJECT.md`. Native
keyboard editors load them at startup and write atomically with bounded size and
stable errors; they are not mirrored into an opaque database.

Foundation packaging now produces and verifies a static ELF, desktop entry,
tracked-provenance icon, checksums, and staged install/launch/uninstall scripts.
The update manifest remains deliberately unsigned and the release gate fails
until offline signing and runtime signature verification are provisioned.

The foundation performance gate now measures warm native startup, 120 rendered
frames with a 10,000-event feed, and peak RSS. It blocks above 750 ms startup,
16 ms worst headless frame, or 128 MiB RSS. Live-X11 idle CPU and p95
input-to-present evidence remain release work rather than inferred metrics.

A backup-first migration command now imports validated portable schema-v0
exports into native schema v1 for sessions, messages, selected provider, and
new-session policy. It preserves exact reported usage, writes its completion
marker last, and is idempotent. Direct SQLite ingestion, automated rollback
after a mid-write I/O failure, and migration of notes, memory, teams, processes,
billing, and credentials remain incomplete.

The credential boundary now has an authenticated ChaCha20-Poly1305 vault with
atomic mode-0600 persistence and an explicit high-entropy key requirement.
Secret Service discovery and encrypted-session request framing fail closed;
live item operations still require DH/AES session primitives and D-Bus reply
handling. No plaintext or weak password-derived fallback is enabled.

TLS now strictly parses bounded DER/X.509 leaves, checks SAN hostnames and
validity, verifies the TLS Finished message in constant time, and refuses to
send application data. System-root chain building and certificate signature
verification remain required, so native HTTPS intentionally remains unusable
rather than accepting an unverifiable peer.

The Zag compiler defect exposed by this application was fixed source-first in
the sibling Zag checkout: qualified generic function signatures now register
their substituted generic struct layouts before type normalization. Native
container access uses the normal list.get API again; the local compiler digest
and relevant source digest are pinned in TOOLCHAIN.lock.

The release remains blocked on remaining real provider adapters, regeneration,
complete in-process service migration, live Secret Service operations, X.509
chain/signature validation, full native workflows, AT-SPI, full legacy-data
coverage, signed release packaging, and live-X11 performance evidence. The
release verifier fails closed for those unresolved requirements.
