# Research support scope

Research reduces context by running one fixed read-only researcher in a fresh child process. It is not a security sandbox.

Use Research for iterative multi-source synthesis, conflicting evidence, or source-sensitive reports. Use direct `websearch` for one narrow lookup and direct `webfetch` for one known URL; those tools keep their normal direct routing.

## Interface

Research is one-shot and accepts exactly:

```json
{ "task": "Research question, context, file paths, requested depth, and source constraints." }
```

There is no continuation, Research ID, effort mode, web policy, files array, or separate context field. The child receives no parent conversation or session. It has the fixed `researcher` model and read-only `read`, `grep`, `find`, `ls`, `websearch`, and `webfetch` tools. Its final answer is returned as written, subject only to the 8 KiB and 400-line head bound.

Full child messages and usage remain in normal tool details for the user-facing collapsed and expanded renderer. Pi does not send tool details to the parent model.
