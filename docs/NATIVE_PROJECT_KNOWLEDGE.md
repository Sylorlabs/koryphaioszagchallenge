# Native project knowledge

Project memory and rules remain Markdown files owned by the project:

- `.koryphaios/memory/PROJECT.md`
- `.koryphaios/rules/PROJECT.md`

Startup reads these files directly. Native edits use atomic temporary-file plus
rename replacement and update the in-process view model only after the write
succeeds. Files are limited to 1 MiB each to bound rendering and prompt-context
work; oversize writes fail with `E_KNOWLEDGE_TOO_LARGE`.

The native keyboard workflow is:

- `Ctrl+M`: open project memory;
- `Ctrl+R`: open project rules;
- `Ctrl+S`: save the authoritative Markdown file;
- `Escape`: close the editor.

No HTML script, navigation, or network execution is involved. Rich Markdown
layout, project-document discovery outside these two authoritative paths, search,
and graph navigation remain separate parity work.
