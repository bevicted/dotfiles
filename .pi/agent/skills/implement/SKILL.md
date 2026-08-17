---
name: implement
description: Implement a TASKS.md manifest through per-task acceptance review and final integrated code review.
disable-model-invocation: true
---

# Implement

Implement the task set passed to `/skill:implement`. Use the manifest to schedule linked task specifications. Keep task tracking, authoritative verification, repository history, and commits in the parent session.

## Setup

1. Select one unambiguous `TASKS.md` manifest from the command arguments. Ask for its exact path when none or more than one could be selected. Read the complete manifest, its linked source, all applicable repository instructions, and the repository status and diff.
2. Validate the manifest before implementation:
   - If the file is a legacy monolithic task set without linked task specifications, stop and ask the user to migrate it with `/skill:tasks`; do not infer or rewrite the task structure during implementation.
   - Every task row has a stable ID, `pending` or `complete` status, an exact linked task file, and valid blocker IDs or `None`.
   - Every linked task file exists.
   - Availability can be derived from `pending` status plus `complete` blockers.
   - Stop and report malformed, missing, duplicate, or contradictory task state instead of guessing.
3. Record the task-set starting HEAD and all pre-existing changes, including the exact staged index state. Determine whether the manifest and linked task files are tracked, ignored, or untracked. Update all task artifacts locally, but include only tracked artifacts in commits and never force-add ignored files. Tell every reviewer the exact tracking mode.
4. Identify `pending` tasks whose blockers are `complete`. If pre-existing changes overlap the files or behavior likely affected by the next task, stop before delegation and report the overlap.

## Per-task cycle

5. Choose one available task in manifest order. Read its complete linked task file and relevant source context, then record its starting HEAD. Delegate it to a fresh `worker` with this exact context:
   - Exact manifest, selected task, linked source, and applicable instruction paths.
   - Selected task ID, task starting HEAD, pre-existing-change boundaries, and `ALLOW_COMMIT: no`.
   - Read the manifest shared context, complete selected task file, relevant linked source, and applicable instructions.
   - Implement only the selected task and preserve unrelated state.
   - Run the task file's focused verification and exercise actual behavior when possible. The parent owns authoritative verification and the manifest's final task-set gate.
   - Do not edit task artifacts, stage, commit, or delegate.
   - Report every acceptance ID with its implementation, exact test or behavioral command result, changed files, and remaining risks.
6. Check repository invariants before semantic review:
   - Confirm the worker completed its assignment, HEAD is unchanged, all task artifacts are unchanged, changed files are within scope, and `git diff --check` passes.
   - If the task started with no staged changes and the worker created exactly one direct descendant commit containing only current-task work, recover with `git reset --mixed <task-starting-HEAD>` so all file changes remain in the worktree. Record the violation and continue.
   - Stop if the task started with staged changes and HEAD changed, history changed in any other way, unrelated files changed, task artifacts changed, or repository state is uncertain. Do not discard, overwrite, or silently alter pre-existing index state.
   - Create a complete task patch artifact outside the repository for read-only review. Account for every changed file, including untracked files, and preserve the task-starting boundary.
7. Delegate acceptance review to a fresh `acceptance-reviewer`. Supply the exact manifest, selected task, source, and complete patch-artifact paths; task ID; task starting HEAD; complete changed-file list; worker report; reported verification; pre-existing-change boundaries; and task-artifact tracking mode. Require one result for every acceptance ID and final `PASS` or `FAIL`.
8. On `FAIL`, pass only the blocking findings and complete acceptance result to a fresh `worker` with the same boundaries and `ALLOW_COMMIT: no`. Do not ask it to fix follow-ups, warnings, pre-existing defects, or optional hardening. Repeat steps 6 and 7 after remediation. Allow at most two remediation worker-review cycles after the initial acceptance review.
9. After acceptance review passes, independently inspect every changed file and account for the complete task diff. Run all verification required by the selected task file and exercise delivered behavior. Stop with the task still `pending` and implementation uncommitted if any criterion, verification, repository instruction, or behavior check fails.
10. Fill the selected task file's completion record with changes, decisions or deviations, evidence mapped to every acceptance ID, verification results, and remaining risks. Change only that task's manifest status from `pending` to `complete`.
11. Commit the completed task from the parent as one cohesive, path-limited commit containing only implementation changes and tracked task artifacts. Do not use broad staging or a commit that consumes unrelated staged entries. Follow repository signing instructions, confirm HEAD ancestry, and compare the post-commit staged state with the exact pre-existing staged state recorded in step 3. Preserve every unrelated staged entry; stop and report any difference that cannot be restored exactly without changing worktree content.
12. Re-read the manifest and repeat from step 4 until every task is `complete` or no `pending` task has all blockers `complete`.

The per-task loop is:

`worker -> acceptance review -> remediation worker -> acceptance review -> parent verification -> task completion record -> manifest status -> parent commit -> next task`

Skip the remediation branch when acceptance review passes.

## Final integrated code review

13. After all manifest tasks are `complete`, read every linked task file and create a complete cumulative patch artifact outside the repository from the task-set starting boundary. Include every task-set-relevant changed file, including ignored or untracked task artifacts, untracked implementation files, and final-review work. Delegate one cumulative review to a fresh `reviewer`. Supply the exact manifest, all task, source, and patch-artifact paths; task-set starting HEAD; all task commits; complete cumulative changed-file list; completion records; reported verification; pre-existing-change boundaries; and task-artifact tracking mode. Require review of the task-set change range for cross-task correctness, security, maintainability, and integration regressions, followed by `PASS` or `FAIL`.
14. On `FAIL`, record the final-remediation starting HEAD and pass only blocking findings to a fresh `worker` with `ALLOW_COMMIT: no`. Require focused verification and preserve completed behavior. Apply the repository invariant and scoped single-commit recovery checks from step 6. If a fix changes an accepted task's behavior, rerun steps 6 and 7 for that task, then update its completion evidence after parent verification. After all remediation and evidence updates, regenerate the complete cumulative patch artifact and rerun cumulative code review with a fresh `reviewer`. Allow at most two final remediation-review cycles.
15. After cumulative review passes, inspect any final remediation diff, run the manifest's final verification gate, and exercise behavior changed during final remediation. Commit verified final-review fixes and tracked evidence updates from the parent in cohesive, path-limited units using the staged-state preservation and comparison rules from step 11. If verification fails, leave final fixes uncommitted and report the failure.
16. Before finishing or stopping, retroactively sign any unsigned commits created by this run when signing is available. Report completed tasks and commits, pending tasks, blocking failures, verification not completed, unsigned commits, and remaining work.

The final loop is:

`cumulative code review -> remediation worker -> affected acceptance review when needed -> cumulative code review -> parent final verification -> parent commit -> finish`

Skip the remediation branch when cumulative review passes.

## Stop conditions

Stop without marking current work `complete` or committing it when:

- Pre-existing or concurrent changes overlap the assignment.
- A subagent fails or changes repository state outside the recoverable single-commit case.
- Acceptance or cumulative review does not pass within two remediation cycles.
- Parent inspection, required verification, or behavioral verification fails.
- Manifest state, task scope, repository state, or completion evidence is uncertain.
- No `pending` task has all blockers `complete`.

Do not discard, overwrite, force-add, or include unrelated changes to recover from a stop condition.
