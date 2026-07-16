# Native provider execution boundary

Production chat is fail-closed until a provider has a real executable adapter.
`message_send` rejects with `E_PROVIDER_REQUIRED` before writing the user
message, incrementing the session, or showing a loading state. Availability
detection alone never implies execution support.

The deterministic `test-simulator` exists only behind `core_open_test`. It is
not present in the provider catalog, settings UI, production startup, or model
selection. Its purpose is to exercise the typed command/event contract and
persistence without network credentials:

1. Persist the user message.
2. Emit `agent_status: thinking`.
3. Emit one deterministic `stream_delta`.
4. Persist the assistant message.
5. Emit `assistant_added` and `agent_status: done`.

The simulator reports no token count or cost. Zero values remain persistence
defaults for unknown usage; the UI does not present them as measured usage.
Real CLI/API adapters must replace the production rejection individually and
must surface stderr, exit status, cancellation, authentication expiry, model
availability, and provider-reported usage.
