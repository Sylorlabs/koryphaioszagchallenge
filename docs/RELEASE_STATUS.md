# Release status

This repository is at the **native core foundation** milestone, not a release
candidate. The old browser server is retained only in baseline history while
its native replacements are landed. The current native entry point has no HTTP
listener and supports --project, --headless-test, --x11-selftest, --capture,
--safe-mode, --diagnostics, and --version.

Implemented evidence now covers typed in-process commands/events, native session
creation and selection, user-message persistence, restart recovery, schema
corruption backup, stable error codes, distinct provider identities, keyboard
and pointer paths, deterministic captures at four size/scale combinations, and
a live X11 connect/render/present/pump/close test. Provider refresh performs
pure-Zag executable PATH checks for Jules, Gemini CLI, Codex, Claude Code,
Cursor Agent, and Cline without invoking project-local impostors.

The release remains blocked on complete in-process service migration,
Secret-Service/vault storage, X.509 chain validation, provider execution, full
native workflows, AT-SPI, legacy-data migration fixtures, packaging, and
performance evidence. The release verifier fails closed for those unresolved
requirements.
