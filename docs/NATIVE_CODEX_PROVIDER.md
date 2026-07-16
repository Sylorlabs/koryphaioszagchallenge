# Native Codex CLI provider

The native adapter is based on the locally installed official `codex-cli
0.144.4` interface. `codex --help`, `codex exec --help`, and `codex login
status` were inspected without starting a model turn. The observed account
status was reported by Codex itself; Koryphaios does not inspect or copy Codex
credentials.

`provider_codex.zag` starts the executable with direct `execve` argv. The
prompt is one argv value and is never shell command text. The default execution
policy is `--ask-for-approval never`, `--sandbox read-only`, an ephemeral
session, and the chosen project directory. Workspace-write and danger-full-
access remain unavailable until an Advanced security control can explain the
consequences and require explicit confirmation.

Stdout and stderr are separate `0600` files consumed incrementally by the
single-threaded native event loop. Stdout accepts documented JSONL event
envelopes. Completed `agent_message` items provide assistant text. Exact token
usage is surfaced only when `turn.completed.usage` contains non-negative integer
`input_tokens` and `output_tokens`; missing, fractional, or malformed counts are
omitted. Provider errors, malformed JSONL, stderr, exit status, and cancellation
remain distinct facts.

## Core integration

The shared core imports this adapter, schedules asynchronous direct
`codex login status` checks during provider refresh, permits selection only
after CLI-owned authentication succeeds, and runs Codex independently of the
Cline adapter. On each core tick it translates:

- `assistant_message` to `stream_delta` and final persisted assistant text;
- `usage` to an exact-usage event and exact persisted fields;
- `provider_error`, `stderr_text`, and nonzero `process_exit` to stable,
  provider-specific errors without swallowing stderr;
- cancellation to `cancelled` only after the child has been reaped.

The core must not infer authentication from config files, treat executable
presence as authentication, invent a model list, or fabricate token usage.

## Remaining gaps

The module and shared-core execution are verified with deterministic local
fixtures. Live model execution was deliberately not performed during
implementation. Model availability must come from a verified Codex CLI surface;
the inspected CLI version exposes model selection but no non-mutating model-list
command, so the UI must accept a user-selected model or leave it unspecified
until Codex reports availability. Configurable sandbox policy remains pending;
production therefore stays on the read-only preset. JSONL command/tool activity
is preserved as raw structured provider activity; native tool-preview rendering
and permission mediation for those events remain integration work.
