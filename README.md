# Koryphaios, rewritten in Zag

A from-scratch rewrite of [Koryphaios](reference/Koryphaios/) — an AI-orchestration
desktop app originally built on **Bun + TypeScript + SvelteKit** — in
**[Zag](../zag/)**, a proof-carrying systems language, compiled by its own native
compiler (`znc`) to a single static x86-64 ELF with **zero external tools, zero
dependencies, no libc**.

```
┌───────────────────────────────────────────────────────────────────┐
│  build/koryphaios  — one static binary (~230 KB)                  │
│                                                                   │
│  src/zrt/        "what Bun does", Zag-native                      │
│    net.zag       TCP + epoll over raw Linux syscalls              │
│    http.zag      HTTP/1.1 server: keep-alive, MIME, static files  │
│    ws.zag        WebSocket (RFC 6455): handshake, frame codec     │
│    json.zag      full JSON parser/writer (\uXXXX, surrogates)     │
│    sha1.zag      SHA-1 (i64 masked math)                          │
│    base64.zag    RFC 4648                                         │
│    str.zag       string utils + StrBuf builder                    │
│    bytes.zag     raw buffer codecs for syscall structs            │
│                                                                   │
│  src/backend/    the Koryphaios port                              │
│    store.zag     sessions/messages persistence (JSON, atomic)     │
│    app.zag       provider registry, auth, WS event fanout         │
│    routes.zag    the /api surface + SPA static serving            │
│    chat.zag      Kory orchestration loop (event-driven)           │
│    util.zag      wall clock, nanoid, rename/chmod/mkdir syscalls  │
│                                                                   │
│  frontend/public/  hand-written UI toolkit (no frameworks)        │
│    toolkit.js    K.* component library built for this app         │
│    theme.css     the kintsugi design system                       │
│    app.js        the Koryphaios UI on the toolkit                 │
└───────────────────────────────────────────────────────────────────┘
```

## Run

```bash
# build (compiles in ~0.3 s)
/home/micah/Desktop/Sylorlabs/zag/zag-poc/znc src/main.zag -o build/koryphaios

# run
./build/koryphaios              # http://127.0.0.1:3001
KORYPHAIOS_PORT=4000 ./build/koryphaios
```

Open http://127.0.0.1:3001 — the app boots to the exact Koryphaios main screen.
Connect a provider under **Settings → Providers**:

- **Demo (built-in)** — any key; streams a simulated Kory response through the
  full realtime pipeline. No external services needed.
- **Ollama** — Zag-native path: nonblocking sockets + chunked-transfer decoding
  + SSE parsing, all in Zag, pointed at `http://localhost:11434`.
- **Anthropic / OpenAI / Groq / xAI / DeepSeek** — TLS terminated by a `curl`
  subprocess streaming SSE to a file the event loop tails (Zag has no TLS stack;
  this is the one documented concession).

## What matches the original

- **Agentic tool loop** — Kory doesn't just chat, it *works*: the provider's
  streamed tool calls are dispatched to real handlers (`bash`, `read_file`,
  `write_file`, `edit_file`, `ls`, `grep`, `glob`), results feed back, and the
  model requests another turn — up to a 25-turn cap. `bash` runs through the
  native `_zag_exec_capture` primitive; file ops through native syscalls.
- **Multi-agent orchestration** — `delegate_to_worker` spawns a domain
  specialist worker with its own tool loop; its output is reviewed by a
  fresh-context, read-only **Critic** that must end with PASS/FAIL (≤3 attempts)
  before the result returns to the manager. Emits `agent.spawned` / per-agent
  `agent.status` so workers appear in the feed.
- **Interactive `ask_user`** — the agent can pause mid-task, emit
  `kory.ask_user`, and resume when the client replies with `user_input` (the
  answer is injected as the tool result).
- **MCP server** — a JSON-RPC 2.0 endpoint at `/mcp` (`initialize`,
  `tools/list`, `tools/call`) exposes the same tool registry to other agents.
- **Process supervisor** — `/api/processes` spawns detached background shells
  (`setsid`), tracks pids, reaps them non-blockingly in the event loop, and
  emits `process.started` / `process.exited`.
- **Context archive** — every tool result is appended to a per-session
  `context-archive.jsonl`; `/api/sessions/:id/context` serves it to the UI.
- **API contract** — 50+ endpoints across sessions, messages (+ regenerate),
  providers (+ MCP), auth, project, workspace, **git**
  (status/diff/stage/commit/branch/push/pull), **memory**
  (universal/project/session), **notes** (CRUD + search), **agent settings**,
  mode, billing/spend, feedback, **processes**. CORS + preflight + bearer.
- **WS protocol** — `?auth=` pre-upgrade, `provider.status` connect push,
  `subscribe_session` fanout, and the full per-turn choreography including
  `kory.thought → kory.routing → agent.status → stream.delta (50 ms coalescing)
  → stream.tool_call → stream.tool_result → agent.spawned → stream.usage →
  agent.status(done)`.
- **Data model** — nanoid-12 ids, epoch-ms timestamps, message content as
  `[{"type":"text","text":...}]` blocks, session token/cost accounting.
- **UI** — rebuilt pixel-for-pixel from the Svelte source (`docs/UI_SPEC.md`)
  with a bespoke vanilla-JS toolkit; tool calls, tool results, and worker spawns
  render live in the agent feed.

Deliberate fixes over the original (per `docs/BACKEND_SPEC.md` §8): real WS
ping/pong instead of the 60-second force-close bug, Ollama URLs get `/v1`
correctly, `session.updated` has one canonical payload shape.

## Fully native networking — no subprocess bridges

Every network path is now hand-written Zag over raw syscalls; there is **no
`curl`, no external process for I/O**. The remaining `sh -c` calls are the
`bash` tool and `git` — i.e. deliberately *running an external program*, which
is the feature, not a transport bridge.

- **Native DNS** (`src/zrt/dns.zag`) — A-record resolution over UDP against the
  system nameserver from `/etc/resolv.conf`.
- **Native TLS 1.3 client** (`src/zrt/tls.zag` + `tls_hash`/`tls_aead`/
  `tls_x25519`) — a from-scratch **TLS_CHACHA20_POLY1305_SHA256 / X25519**
  implementation: SHA-256, HMAC, HKDF, ChaCha20, Poly1305, and X25519 all built
  from scratch and verified against their RFC test vectors (RFC 8446/8439/7748/
  5869/4231). It performs the real authenticated handshake and record
  encryption, then streams application data through the epoll loop. Verified
  end-to-end: the app reaches `api.openai.com` and surfaces OpenAI's real
  responses. *Security note:* it does not yet validate the server certificate
  chain (no X.509/PKI) — the one deliberately deferred property, documented in
  `tls.zag`. Anthropic is reached via its official OpenAI-compatible endpoint so
  one transcript format + one SSE parser cover every provider.
- **Native process spawn** (`native_spawn` in `util.zag`) — background shells
  via pure-Zag `fork`/`setsid`/`dup2`/`execve`, reaped with `wait4`.

## Scope notes (honest boundaries)
- **Persistence** is JSON files (atomic tmp+rename) rather than SQLite — same
  wire shapes, human-inspectable.
- **Settings**: the Providers tab is fully functional; the other tabs render
  with correct chrome. A handful of original subsystems that don't affect the
  core experience (MCP server, LSP, replay, process-supervisor, redis/queue
  infra) are not ported — several were dead code in the original (see
  `docs/BACKEND_SPEC.md` appendix).
- **`_zag_exec_capture` + dash**: `find | head | grep` in a non-tty context
  yields empty output — this is a `dash`/SIGPIPE quirk reproduced identically by
  a plain `sh -c '...' > file`, not a primitive bug; put filters before `head`.

## Zag limitations hit (and how they were handled)

Per the challenge rules ("if you ever hit a roadblock with Zag, modify its
source"), the one true compiler gap was **fixed in znc itself**; the rest were
designed around within the language.

| Roadblock | Resolution |
|---|---|
| `_zag_exec_capture` declared in std but **not implemented** in znc's x86-64 codegen | **Patched the compiler.** Added the `RT_EXECCAP` runtime routine to `selfhost/native/ncodegen.zag` (`pipe2` + `fork` + `dup2` + `execve` + a grow-buffer read loop), rebuilt znc from source, verified a **byte-identical self-host fixpoint** and the full semantics suite (14/14). `util_exec_capture` now calls the real native primitive — see below. |
| Empty function bodies break codegen at call sites | every stub body carries one statement |
| `opt == null` unreliable on `?*T` | if-capture (`if (opt) \|v\|`) everywhere |
| No threads/async | single-threaded epoll event loop; orchestration is an explicit state machine |
| No TLS stack | **Wrote one.** A from-scratch TLS 1.3 client in Zag (X25519 + ChaCha20-Poly1305 + SHA-256/HKDF), verified against RFC vectors and against `api.openai.com` — no curl |
| No `break`/`continue`, no globals, no fixed arrays | flag-variable loops, `*AppState` threading, malloc'd tables |

The full validated language subset lives in `docs/ZAG_NOTES.md`; the compiler
patch is documented in `docs/ZAG_COMPILER_PATCH.md`.

### The compiler patch (`_zag_exec_capture`)

`znc` shipped a declaration for `_zag_exec_capture` in `std/rt.zag` but its
x86-64 backend only lowered `_zag_exec_cmd` (fire-and-forget) — capturing a
subprocess's stdout aborted the build with *"native: call to unknown
function."* Rather than route around it, the backend now implements the
primitive directly, reusing two idioms already in the codegen: the
`fork`/`execve`/envp-forwarding of `_zag_exec_cmd` and the grow-buffer
`read`-loop of `_zag_read_file`, joined by an anonymous `pipe2` whose write end
is `dup2`'d onto the child's stdout. Provenance-preserving backups of the
pre-patch compiler live at `../zag/zag-poc/znc.pre-execcap.bak`.

## Verification

- `src/zrt/zrt_test.zag` — 111 assertions (str/json/sha1/base64 incl. RFC 6455
  accept-key vector): `znc src/zrt/zrt_test.zag -o build/zrt_test --run`
- Live protocol tests: raw-socket Python WS client exercising handshake, all
  three frame-length encodings, the demo chat flow, and a fake chunked-SSE
  Ollama server against the native client path.
- UI: screenshot-diffed at 1280×720 against `app_full.png` from the original.
