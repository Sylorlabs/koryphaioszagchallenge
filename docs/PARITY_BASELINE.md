# Parity baseline

The source reference is Koryphaios commit
353598028393fbe9954900d7cc902aff262ad167, captured while the checkout had
uncommitted provider, startup-gating, notes, collaboration, and UI work.
That dirty state is material: this matrix is a migration contract, not a claim
that the reference was a release snapshot.

The dirty checkout contained 53 porcelain-status entries. Its baseline
fingerprint is
f5a20ca9b5f4931a6af6904378a112b0e40c9c685c1c4ad09b5a17fb60e09ecf,
calculated over HEAD, binary working/index diffs, status, and untracked-file
digests.

| Area | Reference behavior | Native status |
| --- | --- | --- |
| Desktop shell, sessions, messages | Tauri + Svelte | Native X11 shell with keyboard/pointer creation, untouched-session reuse, explicit force-new, rename, confirmed delete, selection, composer, persistent user messages/settings, and restart recovery; regeneration and provider replies remain pending |
| Providers and exact usage | API and CLI providers | Twelve distinct native identities inventoried; six CLI harnesses use provider-specific, executable-only PATH detection; production send fails before persistence until a real executor is selected; an explicitly test-only simulator verifies user/assistant persistence and typed stream ordering without estimated usage; API/CLI execution pending |
| TLS PKI | Backend transport | Blocked: X.509 validation required |
| Notes, memory, project docs | Markdown plus APIs | Migration design pending |
| Git, files, processes, tools | Backend routes and tool loop | Existing legacy Zag core; in-process migration pending |
| Worker/critic and ask-user | WebSocket events | Existing legacy state machine; native event binding pending |
| Teams and relay | Collaboration transport | Compatibility inventory pending |
| Settings/accessibility | Svelte settings and browser semantics | Native provider drawer, command palette, and persisted session-creation preference; remaining settings and AT-SPI pending |

No planned or pending row counts as feature parity. The release verifier fails
closed until every row has an approved implementation and evidence.
