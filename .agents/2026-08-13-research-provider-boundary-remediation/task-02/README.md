# Task 02 qualification harness

This is an unscored authenticated Task 02 qualification. It never reads, writes, retries, deletes, or alters frozen `research-context-isolation/audit/v3` through `audit/v7` artifacts.

## Run

Run from the repository root with OpenAI Codex OAuth ready:

```sh
AUDIT=.agents/2026-08-13-research-provider-boundary-remediation/audit/task-02/$(date -u +%Y%m%dT%H%M%SZ)
env -u PI_SUBAGENT_DEPTH python3 .agents/2026-08-13-research-provider-boundary-remediation/task-02/pilot.py --audit-dir "$AUDIT"
```

The runner requires a new directory below the ignored Task 02 audit root. Before any command it records exact `git status --porcelain=v1 --untracked-files=all`, HEAD, and aggregate HEAD-to-index, index-to-worktree, and HEAD-to-worktree diff hashes without storing a diff. Its source manifest includes `.gitignore`, every tracked Task 02 file, every subagent/web production and test TypeScript file, and both model catalogs. Every source records separate HEAD blob object/content hashes when present, index blob object/content hashes when present, and worktree byte hashes; absence is explicit, so new `AM` paths cannot collapse index and worktree state.

Before every qualification command and at completion, the runner compares that complete manifest. It writes `final-repository.json` plus `source-manifest-verification.json` and fails if sources, status, or aggregate diffs changed. The only permitted writes are under the ignored audit directory, which is outside the manifest and Git status scope. A passing audit therefore binds the exact worktree bytes that executed.

Capture is loaded before production subagent. At `session_start` and model selection it wraps the active native provider while preserving provider options and capabilities. Production subagent then wraps capture with its terminal boundary. `terminal_transport_payload` is appended only after the terminal `onPayload` resolves, so it is the transmitted payload. `pre_terminal_context` is a separate diagnostic and is not presented as a sanitized boundary capture.

The pilot retains lossless stdout, stderr, timeout/signal/failure status for focused Research/subagent, both web suites, offline loading, deterministic cancellation/restart, authenticated fresh/downstream/resume, export, and pseudo-terminal rendering. It requires exactly one access each to `/a.txt`, `/b.txt`, and `/c.txt`, and rejects every other route. It checks terminal payload markers, native call/output pairs, tool schemas, downstream no-tools, lineage, budget invocations, copied-child hashes, export, deletion, and collapsed then expanded rendering.

Raw sessions, pre-terminal context, provider payloads, fixture access, and command output remain ignored beneath the audit directory because they can contain private local evidence. The tracked harness and fixture contain no credentials.
