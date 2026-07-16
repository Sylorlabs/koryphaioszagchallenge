# Release status

This repository is at the **native core foundation** milestone, not a release
candidate. The old browser server is retained only in baseline history while
its native replacements are landed. The current native entry point has no HTTP
listener and supports --project, --headless-test, --x11-selftest, --capture,
--safe-mode, --diagnostics, and --version.

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

The Zag compiler defect exposed by this application was fixed source-first in
the sibling Zag checkout: qualified generic function signatures now register
their substituted generic struct layouts before type normalization. Native
container access uses the normal list.get API again; the local compiler digest
and relevant source digest are pinned in TOOLCHAIN.lock.

The release remains blocked on the remaining real provider adapters, regeneration, complete in-process service migration,
Secret-Service/vault storage, X.509 chain validation, provider execution, full
native workflows, AT-SPI, legacy-data migration fixtures, packaging, and
performance evidence. The release verifier fails closed for those unresolved
requirements.
