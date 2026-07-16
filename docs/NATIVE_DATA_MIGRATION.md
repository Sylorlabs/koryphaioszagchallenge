# Native data migration slice

The first native migration boundary accepts a `koryphaios-portable-export`
document at schema version `0`. It covers the user-visible session list,
per-session messages, and the native new-session/provider preferences. These
objects correspond to the legacy SQLite `sessions` and `messages` row shapes
after conversion through the legacy application's public store/API mapping.
Direct SQLite page parsing is not part of this slice.

Invoke it through the release binary before opening the workspace:

```sh
build/koryphaios --project /path/to/project \
  --migrate /path/to/portable-export.json
```

Migration is one-way to native schema version `1`. Before changing the target,
the implementation parses and validates the entire export, including IDs,
roles, text content blocks, timestamps, usage values, session/message
relationships, duplicate sessions, and orphan message groups. Unsupported
versions and corrupt exports fail without creating target or backup files.
Diagnostics use stable `E_*` codes with the affected session or message ID when
available; malformed relationships are not silently skipped.

On success, the exact source plus every existing target file is copied into
`migration-backups/`. Replacement files use the existing atomic-write helper,
and `migration-state.json` is written last. A valid completion marker makes
later runs no-ops. A corrupt marker fails closed for recovery rather than
guessing whether a partial migration completed.

The implementation preserves provider-reported token and cost values. It does
not derive or estimate missing usage. Fixtures exercise both legacy string
message content and the newer text-block representation.

Focused verification:

```sh
toolchain/zag/zag-poc/znc src/native/migration_test.zag \
  -o build/migration_test --analyze-strict
build/migration_test
toolchain/zag/zag-poc/znc src/native/migration_recovery_test.zag \
  -o build/migration_recovery_test --analyze-strict
build/migration_recovery_test
```
