# Zag language notes for this project (validated by probes 2026-07-10)

Compiler: `/home/micah/Desktop/Sylorlabs/zag/zag-poc/znc` — native x86-64 ELF, no external tools.
Build: `znc src/main.zag -o build/koryphaios` (add `--run` to execute). Compiles ~3.3k lines in 0.23s.
Vendored std (runtime bindings): `/home/micah/Desktop/Sylorlabs/koryphaioszagchallenge/zagstd/` (rt.zag, list.zag, map.zag, hashmap.zag).

## VERIFIED WORKING
- `fn main() i32`, functions, recursion, methods `fn (self: T) name(...) R {}`
- structs (value semantics), generic structs `Box[T]`, generic fns `f[T](...)`, monomorphized
- tagged unions + exhaustive `switch` with payload capture `.tag => |v| {}` and `else =>`
- enums `Enum.Member`
- optionals `?T`, `null`, `orelse`, `.?`, `if (opt) |v| {}`
- error unions: `error Name { A, B }`, `!T` returns, `try`, `expr catch fallback`, `catch |e|`
- `let name: Type = expr;` — mutable, block-scoped. ALWAYS annotate the type.
- `while`, `if/else if/else`, `switch`; `&&` `||` short-circuit
- ALL bit ops work: `<< >> | & ^` (on i32/i64)
- slices `[]T`: `.len`, index `s[i]`, range-slice `s[a..b]`; string literals are `[]u8`
- pointer indexing: `p[i]` on `*T`; pointer range-slice `p[a..b]` → `[]T` (KEY idiom for buffers)
- `&x` address-of, `p.*` deref, `p.*.field.sub` nested access/assign through pointers
- `new(Struct{...})` → `*Struct` heap alloc (no delete on native; leak or arena)
- casts: `x as Type` (i8/u8/i32/i64/pointers; `p as i64` works for syscalls; `160 as i8` fine)
- `@sizeOf[T]()`, `@strEq(a, b)`
- `@import("path")` merges decls; `@import("path") as name` namespaces; diamond imports OK
- rt externs: `_zag_malloc/_zag_realloc/_zag_free/_zag_memcpy/_zag_memcmp`,
  `_zag_strlen/_zag_strcmp/_zag_strcmp_ord/_zag_strdup/_zag_str_concat/_zag_str_index_of_byte`,
  `_zag_i64_to_str/_zag_u64_to_str/_zag_str_to_i64`,
  `_zag_print/_zag_println/_zag_eprintln/_zag_flush`,
  `_zag_read_file/_zag_write_file/_zag_write_exec/_zag_file_exists`,
  `_zag_exec_cmd/_zag_exec_capture`, `_zag_exit`, `_zag_argc/_zag_arg/_zag_getenv`,
  `_zag_slice_ptr(s)` → `*i8`, `_zag_read_fd(fd,buf,n)`, `_zag_clock_monotonic_ms()`,
  `_zag_raw_syscall(num,a1..a6)` — full Linux syscall access (VERIFIED: real TCP server works)

## COMPILER PATCHED FOR THIS PROJECT
- `_zag_exec_capture(cmd) []u8` — was declared in std/rt.zag but NOT implemented
  in znc's x86-64 backend. Implemented it natively (pipe2+fork+dup2+execve+read-loop)
  in selfhost/native/ncodegen.zag; znc rebuilt + self-host fixpoint verified.
  Now usable directly. See docs/ZAG_COMPILER_PATCH.md. Backup: znc.pre-execcap.bak.

## NOT SUPPORTED (avoid)
- NO `break` / `continue` / `defer` / labeled loops → use flag vars: `let go: i32 = 1; while (go == 1 && ...)`
- NO top-level `let` (globals) → thread a `*State` pointer through call chains
- NO `for` loops → `while` with manual index
- NO fixed-size arrays `[N]T` → use malloc'd buffers `*i8`/`*T` or ArrayList
- NO hex/octal/binary literals → decimal only (write 0xFF as 255, 0x7FFFFFFF as 2147483647)
- NO tuples, anonymous structs, varargs, default args
- NO compile-time exec, macros, reflection
- NO threads/atomics/async → single-threaded epoll event loop for the server
- NO pointer arithmetic (`p + 1`) → use indexing `p[i]` or re-slice
- Negative literals in some positions: prefer `0 - 1` if `-1` misparses
- Closures are stack-bound; can't escape. Function values exist but prefer switch-dispatch tables.
- unused-var warnings may exist; keep code clean

## CAPTURED-OPTIONAL SLICE — FIXED IN THE COMPILER
- Previously, indexing/slicing a captured `?[]u8` payload directly
  (`if (opt) |v| { v[0]; v[a..b] }`) yielded GARBAGE. Root cause: the native
  backend bound aggregate captures as `*[]u8` (pointer), and `*[]u8` is
  indistinguishable from `ArrayList[[]u8].data` (pointer-to-array-of-slices), so
  `v[i]` was lowered as "the i-th slice of an array" not "the i-th byte".
- FIXED at the source: captured SLICE payloads now bind as `[]u8` BYREF (the slot
  holds the payload's {ptr,len} block address), making `v` a genuine slice with no
  `*[]u8` ambiguity. All slice ops (`v[i]`, `v[a..b]`, `v.len`) work naturally now.
  Struct/union payloads still bind as `*T`. See docs/ZAG_COMPILER_PATCH.md.
  The natural `if (opt) |v| { v[i] }` pattern is correct — no workaround needed.

## GOTCHAS DISCOVERED DURING BUILD (important!)
- EMPTY FUNCTION BODIES `fn f(x: i32) void { }` break codegen ("call to unknown function"
  at every CALL SITE). Every function body needs ≥1 statement — use `let _u: i32 = 0;`.
- `opt == null` / `opt != null` on `?*T` is UNRELIABLE at runtime (no compile error).
  Always use if-capture: `if (opt) |v| { ... } else { ... }`.
- `let x: T = switch (...) {...}` fails ("aggregate let needs an aggregate initializer").
  Use switch with return in each arm, or assign inside arms.
- Char literals DO work: 'A', '\\', '\n' (contrary to early note).
- u8 arithmetic does NOT wrap at 255 — mask with & 255 before storing computed bytes.
- Reverse late binding works: an imported file may call a function defined in ANY file of
  the final merged program (even one that imports it). Resolution is post-merge.
- f64 fully works (literals, casts, union payloads); no f64→str binding (hand-roll).

## IDIOMS
- Byte buffer → slice: `let sl: []u8 = buf[0..n];` (buf: *i8)
- ArrayList[u8] as string builder: `push[u8](&out, ch)`; final slice: `out.data[0..out.len]`
- StringMap[V] from std/map.zag for string-keyed maps (keys NOT copied — keep alive)
- char literals don't exist: use byte values (32 space, 34 `"`, 58 `:`, 123 `{`, 125 `}`)
- SHA-1/u32 math: do it in i64 with `& 4294967295` masking; rotl32 verified working
- errno from syscalls: negative return value = -errno

## SYSCALLS VERIFIED
socket=41, setsockopt=54, bind=49, listen=50, accept=43, read=0, write=1, close=3.
sockaddr_in: 16 bytes; [0]=2 (AF_INET LE), [2..3]=port big-endian, [4..7]=addr, rest 0.
Planned: connect=42, accept4=288, fcntl=72, epoll_create1=291, epoll_ctl=233, epoll_wait=232,
nanosleep=35, pipe2=293, fork=57? (avoid), getrandom=318.

## PROJECT LAYOUT
- `src/zrt/` — runtime ("what Bun does"): str, buf, json, sha1, base64, net, http, ws, client
- `src/backend/` — Koryphaios port: model, store, routes, providers, orchestrator, events
- `src/main.zag` — entry
- `frontend/public/` — hand-written UI (own toolkit, no frameworks), served by Zag http
- `probe/` — language experiments; `reference/Koryphaios/` — READ-ONLY original source
