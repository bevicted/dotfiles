---
name: implement
description: Implement a TASKS.md manifest through per-task acceptance review and final integrated code review.
disable-model-invocation: true
---

# Implement

Implement the task set passed to `/skill:implement`. Keep task state, repository safety decisions, acceptance decisions, history, and commits in the parent session. Keep source discovery, implementation, semantic review, and context-heavy verification in isolated agents.

## Context discipline

- Keep full worker, review, verification, patch, and command-log artifacts outside the repository. Ask subagents to return only the verdict, failed acceptance IDs or blocking findings, changed files, command exit status, risks, and artifact paths. Do not paste full patches or full passing reports into the parent session.
- Pass stable context by path instead of repeating file contents or prior reports. On remediation, pass the blocking findings and prior report path, not the complete report text.
- Do not perform implementation discovery or independently reread every changed source file in the parent. Use the acceptance reviewer for complete semantic inspection. Read only the cited context needed to classify a finding, recover repository state, update task records, or commit safely.
- Run bounded deterministic checks in the parent with verbose output redirected to external log artifacts and report concise exit summaries. Delegate context-heavy or interactive behavior checks to a fresh `worker` in verification-only mode; the parent decides whether its evidence is sufficient.
- Preserve prior acceptance results after narrow remediation. Require delta review of affected criteria and regression risk unless the remediation is broad enough to invalidate the complete review.

## Setup

1. Select one unambiguous `TASKS.md` manifest from the command arguments. Ask for its exact path when none or more than one could be selected. Read the complete manifest, all applicable repository instructions, and the repository status and diff. Verify linked source and task paths exist; do not read linked source or implementation code in the parent unless a later decision requires it.
2. Validate the manifest before implementation:
   - If it is a legacy monolithic task set without linked task specifications, safety-halt and report that `/skill:tasks` migration is required; do not infer or rewrite the task structure during implementation.
   - Every task row has a stable ID, `pending` or `complete` status, an exact linked task file, and valid blocker IDs or `None`.
   - Every linked task file exists, IDs are unique, and availability follows from `pending` status plus `complete` blockers.
   - Safety-halt on malformed, missing, duplicate, contradictory, or deadlocked task state instead of guessing.
3. Record the task-set starting HEAD and exact pre-existing worktree, untracked-file, and staged-index state. Record exact content or restorable snapshots for task artifacts, including ignored artifacts. Determine their tracking mode. Update all task artifacts locally, but include only tracked artifacts in commits and never force-add ignored files.
4. Identify `pending` tasks whose blockers are `complete`. Safety-halt before delegation if pre-existing changes overlap the next task and cannot be separated safely.

## Per-task cycle

1. Choose one available task in manifest order. Read its complete task file, record its starting HEAD and repository state, and delegate it to a fresh `worker` with:
   - Exact manifest, task, linked source, applicable instruction, and external report paths.
   - Task ID, task starting HEAD, pre-existing-change boundaries, task-artifact tracking mode, and `ALLOW_COMMIT: no`.
   - Instructions to read the referenced context, implement only the task contract, preserve unrelated state, and avoid editing task artifacts, staging, committing, or delegating.
   - Instructions to run task-scoped verification and exercise actual behavior when possible. Use check mode or changed-file-scoped formatters. Do not run repository-wide write-mode formatters, dependency updaters, or generators; defer those authoritative gates to the parent.
   - Instructions to write complete acceptance evidence and command logs to external artifacts and return a compact summary.
2. Check and recover repository invariants before semantic review:
   - Confirm the assignment completed, identify every changed file including ignored and untracked files, and run `git diff --check`.
   - If the task started with an empty index and the worker staged files, restore the index to the task-starting HEAD while preserving worktree content.
   - If the task started with an empty index, the task-starting HEAD remains an ancestor of current HEAD, and every intervening commit contains only current-task work, reset mixed to the task-starting HEAD so all changes remain in the worktree. Record the violation and continue.
   - If the starting index was nonempty, restore its exact recorded state only when this can be done mechanically and verified without changing worktree bytes.
   - Restore an out-of-scope or task-artifact file automatically only when it was clean at the task boundary, its exact prior content is recorded, the mutation is incidental rather than required behavior, and restoration can be verified byte-for-byte. This includes deterministic formatter spillover. Record the recovery and continue.
   - Retry an operationally failed subagent with a fresh agent. Safety-halt only when history, index, worktree, or unrelated user state cannot be restored and attributed with certainty.
   - Create a complete task patch artifact outside the repository from the task boundary after recovery.
3. Delegate acceptance review to a fresh `acceptance-reviewer`. Supply paths for the manifest, task, source, instructions, complete patch, worker report, and verification artifacts plus the task boundary and tracking mode. Require the full external report to account for every changed file and every acceptance ID. Require the compact response to contain final `PASS` or `FAIL`, failed IDs, blocking findings, warnings, and the report path.
4. Classify the review result:
   - A finding blocks only when it cites an acceptance criterion, source requirement, repository instruction, or demonstrable correctness, security, or regression defect. Treat style preferences, nits, optional hardening, follow-ups, and pre-existing defects as warnings even if the reviewer labels them blocking.
   - On a valid implementation blocker, delegate only the blockers and report paths to a fresh worker with the same boundaries and `ALLOW_COMMIT: no`. Repeat invariant recovery and use a delta acceptance review for affected criteria and regression risk.
   - Continue remediation for as many cycles as needed while the existing task contract determines the fix. If the same finding persists, sharpen the handoff or change workers; repetition alone is not a stop condition.
   - Escalate only under the escalation condition defined below.
5. After acceptance passes, confirm the reviewer accounted for every changed file. Run all task-file verification and obtain sufficient behavioral evidence using the context rules above. Route any implementation-related failure back through invariant recovery, review classification, and remediation. Do not stop merely because parent verification found another defect.
6. Fill the task file's completion record from the external evidence artifacts, including changes, decisions or deviations, evidence for every acceptance ID, verification results, and remaining risks. Change only that task's manifest status from `pending` to `complete`.
7. Commit the completed task from the parent as one cohesive, path-limited commit containing only implementation changes and tracked task artifacts. Do not consume unrelated staged entries. Follow repository signing instructions, confirm ancestry, and verify the post-commit staged state exactly matches the recorded pre-existing staged state.
8. Re-read the manifest and repeat the per-task cycle for the next available task until every task is `complete`.

The per-task loop is:

`worker -> invariant recovery -> acceptance review -> remediation as needed -> authoritative verification -> completion record -> parent commit -> next task`

## Final integrated code review

1. After all tasks are `complete`, create a complete cumulative patch artifact outside the repository from the task-set starting boundary. Include implementation files, ignored or untracked task artifacts, untracked implementation files, and final-review work. Delegate cumulative review to a fresh `reviewer` using paths for the manifest, source, tasks, patch, evidence, instructions, task commits, boundaries, and tracking mode. Require complete cross-task correctness, security, maintainability, and regression analysis in an external report and a compact `PASS` or `FAIL` response.
2. Classify cumulative findings with the per-task blocking threshold. On a valid blocker, delegate focused remediation, apply the repository invariant recovery rules, and rerun cumulative review. Rerun delta acceptance review only for accepted criteria whose behavior or evidence could have changed. Continue without a fixed cycle limit while the selected source determines the fix; escalate only under the escalation condition below.
3. After cumulative review passes, run the manifest's final verification gate and exercise behavior changed during final remediation. Snapshot clean out-of-scope files and task artifacts before any repository-wide mutating command; automatically restore and verify only incidental changes under the repository invariant recovery rules. Route implementation failures back through remediation and review. Commit verified final-review fixes and tracked evidence updates from the parent in cohesive, path-limited units.
4. Retroactively sign unsigned commits created by this run when signing is available. Report completed tasks and commits, verification performed, recovered subagent violations, warnings, unsigned commits, and remaining work.

## Escalation and safety halts

Escalate to the user only when implementation requires an unsettled decision that would materially change specified product behavior, a normative specification, an architecture boundary, a public contract, a migration or persisted-data format, or the security model.

Safety-halt without marking current work complete when:

- Pre-existing or concurrent work overlaps the assignment and cannot be separated safely.
- Repository history, index state, worktree content, or unrelated user changes cannot be restored and verified exactly.
- Required verification remains unavailable after bounded retries, so completion cannot be established.
- Manifest state is malformed, contradictory, or deadlocked.

Do not stop merely because a subagent committed, staged, or touched an out-of-scope file when exact recovery is safe; a review or verification failed; remediation exceeded a round count; or a reviewer reported a nit, warning, follow-up, or optional improvement. Never discard uncertain changes, force-add ignored files, or include unrelated work in a commit.
