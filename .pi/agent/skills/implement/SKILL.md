---
name: implement
description: Implement a TASKS.md manifest through per-task acceptance review and final integrated code review.
disable-model-invocation: true
---

# Implement

Implement the task set passed to `/skill:implement`. Keep task state, repository safety decisions, acceptance decisions, history, and commits in the parent session. Keep source discovery, implementation, semantic review, and context-heavy verification in isolated agents.

## Context discipline

- Before first delegation, the parent may read only the complete manifest, applicable repository instruction files, and the selected task. Read one selected task at a time. Do not pre-read the source plan, future task files, linked design or user documents, implementation files, or tests.
- Keep implementation discovery and complete semantic inspection in isolated workers and reviewers. In the parent, read source only when a cited finding requires classification, repository recovery requires inspection, or the escalation condition may apply. Read the smallest cited range.
- Keep full worker, verification, patch, and command-log artifacts outside the repository. When a compact result is complete, never read its full report or logs in the parent. On failure, extract only the relevant error block and a bounded tail instead of reading the full log.
- Before the first subagent call for a task, write one external handoff file containing stable paths, instructions, task boundary, tracking mode, constraints, artifact destinations, and output schemas. Subagent prompts contain only the handoff path, role and action, and any dynamic finding or delta path. Do not repeat stable path lists or prior report text in prompts.
- Run bounded deterministic checks in the parent with verbose output redirected to external log artifacts and return concise exit summaries. Delegate context-heavy or interactive behavior checks to a fresh `worker` in verification-only mode; the parent decides whether its compact evidence is sufficient.
- Preserve prior acceptance results after narrow remediation. Require delta review of affected criteria and regression risk unless the remediation is broad enough to invalidate the complete review.

## Setup

1. Select one unambiguous `TASKS.md` manifest from the command arguments. Ask for its exact path when none or more than one could be selected. Read the complete manifest and applicable repository instruction files. Record repository status and complete pre-existing diff and index artifacts outside the repository without loading those diffs into parent context. Inspect only the smallest task-relevant hunk if overlap or recovery classification requires it. Verify linked source and task paths exist without reading their contents.
2. Validate the manifest before implementation:
   - If it is a legacy monolithic task set without linked task specifications, safety-halt and report that `/skill:tasks` migration is required; do not infer or rewrite the task structure during implementation.
   - Every task row has a stable ID, `pending` or `complete` status, an exact linked task file, and valid blocker IDs or `None`.
   - Every linked task file exists, IDs are unique, and availability follows from `pending` status plus `complete` blockers.
   - Safety-halt on malformed, missing, duplicate, contradictory, or deadlocked task state instead of guessing.
3. Record the task-set starting HEAD and exact pre-existing worktree, untracked-file, and staged-index state. Record exact content or restorable snapshots for task artifacts, including ignored artifacts. Determine their tracking mode. Update all task artifacts locally, but include only tracked artifacts in commits and never force-add ignored files. Create an external task-set ledger with these stable paths and boundaries; derive each per-task handoff from it.
4. Identify `pending` tasks whose blockers are `complete`. Safety-halt before delegation if pre-existing changes overlap the next task and cannot be separated safely.

## Per-task cycle

1. Choose one available task in manifest order. Read only its complete task file, record its starting HEAD and repository state, and create its external handoff file from the task-set ledger. The handoff instructs a fresh `worker` to:
   - Read the manifest, selected task, linked source, applicable instructions, and relevant source context itself.
   - Implement only the task contract, preserve unrelated state, and obey `ALLOW_COMMIT: no`; do not edit task artifacts, stage, commit, or delegate.
   - Run task-scoped verification and exercise actual behavior when possible. Use check mode or changed-file-scoped formatters. Do not run repository-wide write-mode formatters, dependency updaters, or generators; defer those authoritative gates to the parent.
   - Write complete acceptance evidence and command logs to external artifacts, plus a concise completion-record draft matching the task schema.
   - Return only completion state, changed-file count and exceptions, command exit summaries, risks, and artifact paths.

   Invoke the worker with the handoff path and action only.
2. Check and recover repository invariants before semantic review:
   - Confirm the assignment completed, identify every changed file including ignored and untracked files, and run `git diff --check`.
   - If the task started with an empty index and the worker staged files, restore the index to the task-starting HEAD while preserving worktree content.
   - If the task started with an empty index, the task-starting HEAD remains an ancestor of current HEAD, and every intervening commit contains only current-task work, reset mixed to the task-starting HEAD so all changes remain in the worktree. Record the violation and continue.
   - If the starting index was nonempty, restore its exact recorded state only when this can be done mechanically and verified without changing worktree bytes.
   - Restore an out-of-scope or task-artifact file automatically only when it was clean at the task boundary, its exact prior content is recorded, the mutation is incidental rather than required behavior, and restoration can be verified byte-for-byte. This includes deterministic formatter spillover. Record the recovery and continue.
   - Retry an operationally failed subagent with a fresh agent. Safety-halt only when history, index, worktree, or unrelated user state cannot be restored and attributed with certainty.
   - Create a complete task patch artifact outside the repository from the task boundary after recovery.
3. Delegate acceptance review to a fresh `acceptance-reviewer` using the handoff and complete-patch paths. Require it to validate the completion-record draft against the patch and evidence. Do not require a read-only reviewer to write an external report. Require this bounded response and no files-reviewed list or per-criterion prose:

   ```text
   VERDICT: PASS|FAIL
   ACCOUNTED: <changed files count>, <acceptance IDs or range>
   FAILED: <IDs or None; all unlisted IDs retain PASS>
   BLOCKERS: <only evidence-backed findings, or None>
   WARNINGS: <short summaries, or None>
   ```

   On `FAIL`, each blocker includes its criterion or requirement, evidence, and path. The parent may persist this structured response but does not expand it into a narrative report.
4. Classify the review result:
   - A finding blocks only when it cites an acceptance criterion, source requirement, repository instruction, or demonstrable correctness, security, or regression defect. Treat style preferences, nits, optional hardening, follow-ups, and pre-existing defects as warnings even if the reviewer labels them blocking.
   - Pass exactly the validated blockers to remediation. Never add adjacent cleanup, warnings, nits, or follow-ups. Promote a warning only by first writing a reclassification record with the exact criterion, requirement, instruction, or reproduced defect that makes it blocking.
   - On a valid implementation blocker, delegate its structured finding or reclassification path to a fresh worker through the existing handoff. Repeat invariant recovery and use the bounded delta-review schema for affected criteria and regression risk.
   - Continue remediation for as many cycles as needed while external evidence shows progress and the existing task contract determines the fix. If the same finding persists, improve the reproducer, sharpen the handoff, or change workers; repetition alone is not a stop condition.
   - Escalate only under the escalation condition defined below.
5. After acceptance passes, confirm the reviewer accounted for every changed file. Run all task-file verification and obtain sufficient behavioral evidence using the context rules above. Route any implementation-related failure back through invariant recovery, review classification, and remediation. Do not stop merely because parent verification found another defect, and do not read full reports or logs when the compact result identifies the outcome.
6. After the reviewer accepts the completion-record draft, apply it from the parent without loading the full worker report into context. Structurally verify the resulting record contains every acceptance ID, verification, decisions or deviations, and risks, then change only that task's manifest status from `pending` to `complete`.
7. Commit the completed task from the parent as one cohesive, path-limited commit containing only implementation changes and tracked task artifacts. Do not consume unrelated staged entries. Follow repository signing instructions, confirm ancestry, and verify the post-commit staged state exactly matches the recorded pre-existing staged state.
8. Re-read the manifest and repeat the per-task cycle for the next available task until every task is `complete`.

The per-task loop is:

`worker -> invariant recovery -> acceptance review -> remediation as needed -> authoritative verification -> completion record -> parent commit -> next task`

## Final integrated code review

1. After all tasks are `complete`, create a complete cumulative patch artifact outside the repository from the task-set starting boundary. Include implementation files, ignored or untracked task artifacts, untracked implementation files, and final-review work. Delegate cumulative review to a fresh `reviewer` through the task-set ledger and cumulative-patch path. Require complete cross-task correctness, security, maintainability, and regression analysis internally, but return only the bounded acceptance-review response schema. Do not require an external narrative report.
2. Classify cumulative findings with the per-task blocking threshold. On a valid blocker, delegate focused remediation, apply the repository invariant recovery rules, and rerun cumulative review. Rerun delta acceptance review only for accepted criteria whose behavior or evidence could have changed. Continue without a fixed cycle limit while the selected source determines the fix; escalate only under the escalation condition below.
3. After cumulative review passes, run the manifest's final verification gate and exercise behavior changed during final remediation. Snapshot clean out-of-scope files and task artifacts before any repository-wide mutating command; automatically restore and verify only incidental changes under the repository invariant recovery rules. Route implementation failures back through remediation and review. On command failure, inspect only bounded error excerpts, never the full log. Commit verified final-review fixes and tracked evidence updates from the parent in cohesive, path-limited units.
4. Retroactively sign unsigned commits created by this run when signing is available. Report completed tasks and commits, verification performed, recovered subagent violations, warnings, unsigned commits, and remaining work.

## Escalation and safety halts

Escalate to the user only when implementation requires an unsettled decision that would materially change specified product behavior, a normative specification, an architecture boundary, a public contract, a migration or persisted-data format, or the security model.

Safety-halt without marking current work complete when:

- Pre-existing or concurrent work overlaps the assignment and cannot be separated safely.
- Repository history, index state, worktree content, or unrelated user changes cannot be restored and verified exactly.
- Required verification remains unavailable after bounded retries, so completion cannot be established.
- Manifest state is malformed, contradictory, or deadlocked.

Do not stop merely because a subagent committed, staged, or touched an out-of-scope file when exact recovery is safe; a review or verification failed; remediation exceeded a round count; or a reviewer reported a nit, warning, follow-up, or optional improvement. Never discard uncertain changes, force-add ignored files, or include unrelated work in a commit.
