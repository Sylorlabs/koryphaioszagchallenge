# Zag compiler patch: native `_zag_exec_capture`

**File patched:** `/home/micah/Desktop/Sylorlabs/zag/zag-poc/selfhost/native/ncodegen.zag`
**Backups:** `znc.pre-execcap.bak` (working pre-patch compiler), `/tmp` seed copy.
**Status:** landed, self-hosting, all tests green.

## The gap

`std/rt.zag` declares `extern fn _zag_exec_capture(cmd: []u8) []u8 @io @alloc;`
and the language front-end (lexer/parser/sema) accepts calls to it — but znc's
x86-64 backend (`ncodegen.zag`) only lowered the fire-and-forget
`_zag_exec_cmd`. Any program that captured a subprocess's stdout aborted at
codegen with:

```
znc: error in <fn> (line N): native: call to unknown function
```

This was the sole real Zag limitation hit while porting Koryphaios (the backend
needs `pwd` for the project name and `git` for the source-control panel).

## The fix

`_zag_exec_capture` is the composition of two routines the backend already had:

- **`_zag_exec_cmd`** — `fork()`, child `execve("/bin/sh", ["-c", cmd], envp)`
  with envp reconstructed from the kernel's initial stack via `r15`.
- **`_zag_read_file`** — a `read()` loop into a `malloc`'d buffer that doubles
  via `realloc` when full, returning a `{ptr,len}` slice.

The new `RT_EXECCAP` routine joins them with an anonymous pipe:

1. `pipe2(&pair, 0)` → read/write fds (unpacked from the packed 8-byte pair with
   32-bit shifts, since fds are small positive ints).
2. `fork()`.
3. **child:** `dup2(writefd, 1)` (stdout → pipe), `close` both pipe fds,
   `execve("/bin/sh", ["/bin/sh","-c",cmd,NULL], envp)`; `exit(127)` on failure.
4. **parent:** `close(writefd)` (so EOF arrives on child exit), then the
   `read_file` grow-buffer loop reading `readfd` to EOF, `close(readfd)`,
   `wait4(pid,…)` to reap, and `make_slice(buf,total)`.

### Changes (all in `ncodegen.zag`)

| Site | Change |
|---|---|
| RT index table | `RT_EXECCAP() = 18`; `RT_COUNT()` 18 → 19 |
| `cg_native_rt_ret` | `_zag_exec_capture` → `"[]u8"` (aggregate result) |
| `cg_is_native_rt` | `_zag_exec_capture` → `1` |
| call dispatch (`cg_lower_runtime`) | `_zag_exec_capture` → `idx=RT_EXECCAP, want=1` |
| `cg_rt_close_deps` | `RT_EXECCAP` pulls in `use_ml`, `use_rl`, `RT_PATHBUF` |
| `cg_emit_native_rt` | emits `cg_emit_rt_execcap` when referenced |
| new fn `cg_emit_rt_execcap` | the routine body described above |

Syscalls used: `pipe2`(293), `fork`(57), `dup2`(33), `execve`(59), `read`(0),
`close`(3), `wait4`(61), `exit`(60) — all x86-64.

## Verification

- **Rebuilt** znc from source (`./znc selfhost/native/znc.zag -o znc.new`, ~44 s).
- **Self-host fixpoint:** `znc.new` recompiling itself produced a **byte-identical**
  `znc.new2` (`cmp` clean) — the patched compiler is a stable fixed point.
- **Semantics suite:** `tests/run_semantics.sh` → `pass=14 fail=0 known_gaps=0`.
- **Primitive test** (`probe/capture.zag`): multi-line capture, env forwarding
  (`pwd`), a **108 KB** output (exercising the realloc grow path across several
  64 KB buffers), and empty output (`true`) — all correct.
- **In-app:** `/api/project` (via `pwd`) and `/api/git/*` (via `git`, returning
  the real branch `wip/retire-c-backend-2026-06-30` when run inside a repo) now
  work through the native primitive with no shell-file workaround.

## Reverting

`cp ../zag/zag-poc/znc.pre-execcap.bak ../zag/zag-poc/znc` restores the
pre-patch compiler. `koryphaios` would then need `util_exec_capture` switched
back to the shell-redirect form (see git history of `src/backend/util.zag`).

---

# Patch 2: captured optional/while-let SLICE payloads mis-indexed

**File patched:** `selfhost/native/ncodegen.zag`
**Backup:** `../zag/zag-poc/znc.pre-capturefix.bak`
**Status:** landed, byte-identical self-host fixpoint, semantics 14/14.

## The bug

`if (opt) |v| { v[i] }` / `v[lo..hi]` on an optional slice (`opt: ?[]u8`) read
**garbage**. `v.len` was correct, but indexing/slicing returned bytes of the
slice *struct* (or an address) instead of the slice's data.

Root cause: the native backend binds an aggregate capture payload as `*T` — for
a slice that is `*[]u8`. But `*[]u8` is exactly how `ArrayList[[]u8].data` is
typed (a pointer to an *array* of slices), where `data[i]` correctly means "the
i-th slice." The index lowering therefore treated the captured `v[i]` as
"the i-th slice of an array" (stride 16, returns element address) rather than
"the i-th byte of this one slice." The two meanings are type-identical, so the
type alone can't disambiguate them.

## The fix

Bind a captured SLICE payload as `[]u8` **byref** instead of `*[]u8`:
`cg_slot_alloc_br(env, cap, inner, 1, /*byref=*/1)`. A byref aggregate slot holds
the block's address (`cg_push_agg_base` does a `load`, not a `lea`), so `v`
becomes a genuine `[]u8` whose block is the payload — and every slice operation
uses the normal slice paths. Struct/union payloads still bind as `*T`
(unchanged), and `*[]u8` array pointers are untouched, so `ArrayList[[]u8]`
keeps its correct per-slice indexing.

### Changes (all in `ncodegen.zag`)

| Site | Change |
|---|---|
| if-let lowering (`.if_` capture) | slice inner → `cg_slot_alloc_br(..,1,1)` byref `[]u8`; else `*T`/scalar as before |
| while-let lowering (`.while_` capture) | same slice → byref `[]u8` |
| scan registration (if-let & while-let) | register the capture type as `[]u8` for slices (was `*[]u8`) so type inference agrees |

## Verification

- **Fix:** `if (m()) |v| { v[0]; v[0..5]; v.len }` all correct (was garbage).
- **Non-regression:** `ArrayList[[]u8]` — `get`/`pop`/`data[i]` still return the
  i-th SLICE (the exact case a naive first attempt broke).
- **Fixpoint:** the patched compiler rebuilds itself **byte-identically**
  (`znc.zag` uses optionals and `ArrayList[[]u8]` pervasively).
- **Semantics suite:** `pass=14 fail=0`.
- **In-app:** the native TLS client's `tls_read_record` / `tls_decrypt_record`
  were rewritten to the natural `if (opt) |v| { v[i] }` pattern (workarounds
  removed) and the live handshake against `api.openai.com` still succeeds.

## Reverting

`cp ../zag/zag-poc/znc.pre-capturefix.bak ../zag/zag-poc/znc`. The app's TLS code
would then need the capture-into-outer-var workaround reinstated.
