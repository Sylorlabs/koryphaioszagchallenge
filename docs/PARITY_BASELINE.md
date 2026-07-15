# Parity baseline

The source reference is Koryphaios commit
353598028393fbe9954900d7cc902aff262ad167, captured while the checkout had
uncommitted provider, startup-gating, notes, collaboration, and UI work.
That dirty state is material: this matrix is a migration contract, not a claim
that the reference was a release snapshot.

| Area | Reference behavior | Native status |
| --- | --- | --- |
| Desktop shell, sessions, messages | Tauri + Svelte | Native X11 shell foundation |
| Providers and exact usage | API and CLI providers | Planned; no fake usage emitted |
| TLS PKI | Backend transport | Blocked: X.509 validation required |
| Notes, memory, project docs | Markdown plus APIs | Migration design pending |
| Git, files, processes, tools | Backend routes and tool loop | Existing legacy Zag core; in-process migration pending |
| Worker/critic and ask-user | WebSocket events | Existing legacy state machine; native event binding pending |
| Teams and relay | Collaboration transport | Compatibility inventory pending |
| Settings/accessibility | Svelte settings and browser semantics | Native widgets and AT-SPI pending |

No planned or pending row counts as feature parity. The release verifier fails
closed until every row has an approved implementation and evidence.
