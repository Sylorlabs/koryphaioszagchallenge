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
## Cline executor

Cline is the first production executor. The native core:

- detects the executable from non-empty PATH entries;
- derives authentication from Cline's own parseable
  `~/.cline/data/secrets.json` without copying its key;
- persists the selected identity in versioned native settings;
- invokes current Cline with explicit `--plan --json --auto-approve false`
  Basic policy and a positional prompt using direct `execve` argv, never
  `sh -c`;
- consumes cumulative NDJSON text snapshots into non-duplicated deltas;
- polls and reaps the child without blocking the X11 event loop;
- surfaces capped real stderr and exit status;
- supports SIGTERM cancellation and a 300-second timeout;
- persists partial output on cancellation with an explicit stopped marker;
- reports no token usage unless a provider emits exact usage.

Codex is also integrated through the separate adapter documented in
`NATIVE_CODEX_PROVIDER.md`; it defaults to the CLI's read-only sandbox and
derives authentication from `codex login status`.

The remaining CLI/API adapters must meet the same stderr, exit, cancellation,
authentication, model-availability, and exact-usage contract.
