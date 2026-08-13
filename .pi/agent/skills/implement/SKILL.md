---
name: implement
description: Implement the tasks in a selected TASKS.md through sequential worker, review, remediation, verification, and commit cycles.
disable-model-invocation: true
---

# Implement

Implement the task set passed to `/skill:implement`. Coordinate subagents, but keep task completion, final verification, and commits in the parent session.

## Steps

1. Select the task set from the command arguments. Require one unambiguous `TASKS.md`; ask for its path when none or more than one could be selected. Read the complete file, its linked source, all applicable repository instructions, and the repository status and diff.
2. Record the starting HEAD and pre-existing changes. Identify the unchecked tasks whose blockers have completed task headings. If pre-existing changes overlap the files or behavior likely affected by the next task, stop before delegation and report the overlap. Preserve unrelated changes throughout the run.
3. Choose one available task in file order. Run only one task at a time. Delegate it to a fresh `worker` with instructions to:
   - Read the complete task set, linked source, and applicable repository instructions.
   - Implement only the selected task, including all acceptance criteria.
   - Preserve pre-existing changes and keep the repository valid.
   - Run the task's specified verification and exercise actual behavior when possible.
   - Not edit `TASKS.md`, commit, or delegate.
   - Report changed files, acceptance-criteria evidence, commands and results, behavioral verification, and remaining risks.
4. Inspect the worker's changes and report. Stop if the worker failed, changed HEAD, changed `TASKS.md`, touched unrelated work, or left the repository in an uncertain state.
5. Delegate review to a fresh `reviewer`. Give it the task-set path, task ID, changed files, worker report, and any relevant pre-existing-change boundaries. Require it to read the implementation and linked context, trace relevant call sites, and return:
   - A result for every acceptance criterion: `SATISFIED`, `NOT SATISFIED`, or `INSUFFICIENT EVIDENCE`.
   - Blocking findings with file paths and line numbers when applicable.
   - Verification evidence it inspected, clearly labeled as reported evidence because the reviewer cannot execute commands.
   - A final `PASS` or `FAIL`. `PASS` requires every acceptance criterion to be satisfied, no blocking finding, and sufficient verification evidence.
6. On `FAIL`, pass the complete review and selected task to a fresh `worker`. Require it to address every blocking finding, rerun relevant verification and actual behavior, and follow the worker constraints in step 3. Then run a fresh review using step 5. Allow at most two remediation worker-review cycles after the initial review. Stop with the task unchecked if either subagent fails or the final review still fails.
7. After review passes, independently inspect every changed file and account for the complete task diff. Run the task's required verification and exercise the delivered behavior. Tests do not replace behavioral verification when behavior can be exercised. Stop with the task unchecked and uncommitted if any criterion, verification, repository instruction, or behavior check fails.
8. Update only the completed task in `TASKS.md`. Mark evidence-backed acceptance criteria and its heading complete, and record accurate completion notes for changes, decisions or deviations, verification results, and remaining risks or follow-ups.
9. Commit the completed task as one cohesive commit, including its `TASKS.md` update and only its implementation changes. Follow all repository commit and signing instructions. Confirm HEAD had not changed unexpectedly and do not include unrelated pre-existing changes.
10. Re-read `TASKS.md` and repeat from step 2 for the next task that is now available. Continue until every task is complete or no unchecked task has all blockers complete.
11. Report completed tasks and commits, tasks left unchecked, blocking failures, verification not completed, and remaining work.

## Stop conditions

Stop without marking or committing the current task when:

- Pre-existing or concurrent changes overlap the task.
- A subagent fails or changes repository state outside its assignment.
- Review does not pass within two remediation cycles.
- Final inspection, required verification, or behavioral verification fails.
- Repository state, task scope, or completion evidence is uncertain.
- No unchecked task has all blockers complete.

Do not discard, overwrite, or include unrelated changes to recover from a stop condition.
