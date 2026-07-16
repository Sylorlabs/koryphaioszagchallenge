# Native session lifecycle

The native `AppCommand`/`AppEvent` boundary owns the complete local session
lifecycle. No HTTP, WebSocket, browser storage, or UI-only state participates.

## Behavior

- `session_new` reuses the active session when it has no messages.
- A forced `session_new` always creates and selects a distinct session.
- The persisted `alwaysCreateSession` setting disables untouched-session reuse.
- `session_rename` rejects empty titles, titles over 120 bytes, and missing IDs.
- `session_delete` removes the session and its message file, then selects a
  surviving session if one exists.
- Deletes require explicit confirmation in the native UI.
- `F2` renames, `Ctrl+Delete` requests deletion, `Enter` confirms, `Escape`
  cancels, and `Ctrl+Shift+N` forces a new session.

Settings are stored atomically in `native-settings.json` with schema version 1.
Invalid settings fail startup closed, preserve the original as
`native-settings.corrupt.backup`, and expose `E_SETTINGS_SCHEMA` on the recovery
screen.

## Verification

`src/native/core_test.zag` drives reuse, force-new, rename, delete, settings
persistence, restart recovery, and corrupt-settings recovery through real
commands. `--headless-test` separately drives the keyboard and confirmation UI.
