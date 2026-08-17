---
name: implement
description: Implement the tasks in a selected TASKS.md through per-task acceptance review and final integrated code review.
disable-model-invocation: true
---

# Implement

Implement the task set passed to `/skill:implement`. Use sequential workers and reviews, but keep task tracking, authoritative verification, repository history, and commits in the parent session.

## Setup

1. Select one unambiguous `TASKS.md` from the command arguments. Ask for its exact path when none or more than one could be selected. Read the complete task set, its linked source, all applicable repository instructions, and the repository status and diff.
2. Record the task-set starting HEAD and all pre-existing changes. Determine whether `TASKS.md` is tracked, ignored, or untracked:
   - For a tracked task file, include completed task updates in the relevant parent commit.
   - For an ignored or untracked task file, update it locally but do not force-add it. Tell every reviewer that this tracking mode is expected.
3. Identify unchecked tasks whose blocker task headings are complete. If pre-existing changes overlap the files or behavior likely affected by the next task, stop before delegation and report the overlap.

## Per-task cycle

4. Choose one available task in file order and record its starting HEAD. Delegate it to a fresh `worker` with this exact context:
   - Exact `TASKS.md` and linked source paths, selected task ID, and applicable instruction paths.
   - Task starting HEAD, pre-existing-change boundaries, and `ALLOW_COMMIT: no`.
   - Read the shared task context, complete selected task, relevant linked source, and applicable instructions.
   - Implement only the selected task and preserve unrelated state.
   - Run focused tests and exercise actual behavior when possible. The parent owns full required and task-set-wide gates.
   - Do not edit task tracking, stage, commit, or delegate.
   - Report every acceptance criterion with its implementation, exact test or behavioral command result, changed files, and remaining risks.
5. Check repository invariants before semantic review:
   - Confirm the worker completed its assignment, HEAD is unchanged, task tracking is unchanged, changed files are within scope, and `git diff --check` passes.
   - If the worker created exactly one direct descendant commit containing only current-task work, recover with `git reset --mixed <task-starting-HEAD>` so all file changes remain in the worktree. Record the violation and continue.
   - Stop if history changed in any other way, unrelated files changed, task tracking changed, or repository state is uncertain. Do not discard or overwrite file changes.
6. Delegate acceptance review to a fresh `acceptance-reviewer`. Supply the exact task and source paths, task ID, task starting HEAD, complete changed-file list, worker report, reported verification, pre-existing-change boundaries, and task-file tracking mode. Require a result for every criterion and final `PASS` or `FAIL`.
7. On `FAIL`, pass only the blocking findings and complete acceptance result to a fresh `worker` with the same boundaries and `ALLOW_COMMIT: no`. Do not ask it to fix follow-ups, warnings, pre-existing defects, or optional hardening. Repeat steps 5 and 6 after remediation. Allow at most two remediation worker-review cycles after the initial acceptance review.
8. After acceptance review passes, independently inspect every changed file and account for the complete task diff. Run all verification required by the selected task and exercise delivered behavior. Stop with the task unchecked and uncommitted if any criterion, verification, repository instruction, or behavior check fails.
9. Update only the completed task in `TASKS.md`. Mark evidence-backed criteria and its heading complete, then record accurate changes, decisions or deviations, verification results, and remaining risks.
10. Commit the completed task from the parent as one cohesive commit. Include the task update only when the task file is tracked. Follow repository signing instructions, confirm HEAD ancestry, and exclude unrelated changes.
11. Re-read `TASKS.md` and repeat from step 3 until every task is complete or no unchecked task has all blockers complete.

The per-task loop is:

`worker -> acceptance review -> remediation worker -> acceptance review -> parent verification -> task update -> parent commit -> next task`

Skip the remediation branch when acceptance review passes.

## Final integrated code review

12. After all tasks are complete, delegate one cumulative review to a fresh `reviewer`. Supply the exact task and source paths, task-set starting HEAD, all task commits, complete cumulative changed-file list, completion reports, reported verification, pre-existing-change boundaries, and task-file tracking mode. Require it to review the task-set change range for cross-task correctness, security, maintainability, and integration regressions, then return `PASS` or `FAIL`.
13. On `FAIL`, pass only blocking findings to a fresh `worker` with `ALLOW_COMMIT: no`. Require focused verification and preserve completed behavior. If a fix changes an accepted task's behavior, rerun acceptance review for that affected task. Then rerun the cumulative code review with a fresh `reviewer`. Allow at most two final remediation-review cycles.
14. After cumulative review passes, inspect the final remediation diff, run the task set's final required gate, exercise any changed behavior, and commit verified final-review fixes from the parent in cohesive units. If verification fails, leave final fixes uncommitted and report the failure.
15. Before finishing or stopping, retroactively sign any unsigned commits created by this run when signing is available. Report completed tasks and commits, tasks left unchecked, blocking failures, verification not completed, unsigned commits, and remaining work.

The final loop is:

`cumulative code review -> remediation worker -> affected acceptance review when needed -> cumulative code review -> parent final verification -> parent commit -> finish`

Skip the remediation branch when cumulative review passes.

## Stop conditions

Stop without marking or committing the current work when:

- Pre-existing or concurrent changes overlap the assignment.
- A subagent fails or changes repository state outside the recoverable single-commit case.
- Acceptance or cumulative review does not pass within two remediation cycles.
- Parent inspection, required verification, or behavioral verification fails.
- Repository state, task scope, or completion evidence is uncertain.
- No unchecked task has all blockers complete.

Do not discard, overwrite, force-add, or include unrelated changes to recover from a stop condition.
