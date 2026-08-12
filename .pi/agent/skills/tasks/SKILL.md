---
name: tasks
description: Convert the task named in the command into a scoped set of implementation tasks.
disable-model-invocation: true
---

# Tasks

Create tasks for the task passed to `/skill:tasks`. Do not implement the task or create, rewrite, move, or copy its source plan.

## Steps

1. Treat the command arguments as the task selector. They may contain the task directly or identify any available source, including the current conversation, a plan file, a specification, or another artifact. Read the complete selected source and relevant conversation context. Do not expand beyond the selected task.
2. Read every applicable `AGENTS.md` and follow it over this skill. Inspect enough repository code, documentation, and current behavior to make the tasks accurate. Do not ask the user to approve the breakdown. Record evidence-based assumptions when needed.
3. Set the task-set ID and output directory. When the source plan is `.agents/<task-set-id>/PLAN.md`, reuse its `<task-set-id>` and directory for the task set. Otherwise choose an ID in the form `<YYYY-MM-DD>-<short-kebab-slug>`. Reuse an existing ID when updating the same task set. If it belongs to different work, add a short distinguishing suffix. Never overwrite unrelated tasks.
4. Create only `.agents/<task-set-id>/TASKS.md` in the repository root. For a source plan in `.agents/<task-set-id>/PLAN.md`, create `TASKS.md` beside it. Preserve the source artifact in place. Link to a durable source from `TASKS.md`; when the source is conversation context, summarize all context needed to make the file self-contained.
5. Break the selected task into tasks using the rules below. Audit the result: every part of the selected task belongs to at least one task, every task is a vertical slice or justified refactor step, dependencies reference valid IDs, acceptance and verification are observable, and no task is likely to exceed 200k context.

## Task rules

- Give each task a stable ID: `<task-set-id>-NN`, numbered in dependency order. Do not renumber existing tasks when updating a task set.
- Make each implementation task a narrow, complete path through every affected layer. Include the data, behavior, interface, tests, configuration, migration, and documentation needed for that path when applicable.
- Each completed task must leave the repository valid and deliver behavior that can be directly verified. Do not create a sequence of layer-only tasks such as database, then API, then UI.
- Include minimal scaffolding in the first slice that uses it. Do not make broad setup or architecture a standalone task unless it has an independently verifiable result.
- Treat wide mechanical refactors as an exception. When a vertical slice cannot remain valid, use expand, bounded migration batches, then contract. Each step must state and verify its valid intermediate state.
- Scope each task for one fresh agent session, targeting about 100k total context including discovery, implementation, and verification. Split it when it could plausibly exceed 200k.
- List only genuine blockers. Tasks with all blockers complete form the available work frontier and may proceed independently.
- Give a new agent enough context to start without the originating conversation: relevant decisions, constraints, current behavior, and paths worth inspecting. Treat paths as starting points, not an exhaustive edit list.
- Require actual behavior verification consistent with the governing instructions. Tests may support verification but do not replace exercising the delivered behavior when possible.
- Mark the task heading `[x]` only after its acceptance criteria are met and verification succeeds. Record completion context for the next agent.

## `TASKS.md` format

Use one file per task set, not one file per task.

```markdown
# Tasks: <task title>

Task set: `<task-set-id>`
Source: <relative link, URL, or "current conversation at task creation">

## Task context

<Goal, current state, decisions, constraints, relevant paths, and assumptions needed to understand the selected task. Preserve important source details; do not invent a new plan.>

Pick any unchecked task whose blockers are complete. Before starting, read the task context, linked source when available, and all applicable repository instructions. When done, record completion notes and change the task heading from `[ ]` to `[x]`.

## [ ] <task-set-id>-01: <vertical outcome>

**Delivers:** <behavior or result available when this task is complete>

**Blocked by:** None

**Context:**
- <task-specific decision, constraint, current behavior, or relevant path>

**Acceptance criteria:**
- [ ] <observable criterion>
- [ ] <observable criterion>

**Verification:**
- <how to exercise the behavior and what proves success>

**Completion notes:**
- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>
```

Repeat the task section in dependency order. Use task IDs in `Blocked by`, or `None` when work can start immediately.
