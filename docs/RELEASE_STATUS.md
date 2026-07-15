# Release status

This repository is at the **native platform foundation** milestone, not a
release candidate. The old browser server is retained only in baseline history
while its native replacements are landed. The current native entry point has no
HTTP listener and supports --headless-test, --capture, --safe-mode,
--diagnostics, and --version.

The release remains blocked on complete in-process service migration,
Secret-Service/vault storage, X.509 chain validation, full native workflows,
AT-SPI, migrations, packaging, and performance evidence. The release verifier
fails closed for those unresolved requirements.
