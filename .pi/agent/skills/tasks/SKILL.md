---
name: tasks
description: Convert the task named in the command into a scoped set of implementation tasks.
disable-model-invocation: true
---

# Tasks

Create a task-set manifest and linked task specifications for the task passed to `/skill:tasks`. Do not implement the task or create, rewrite, move, or copy its source plan.

## Steps

1. Treat the command arguments as the task selector. They may contain the task directly or identify any available source, including the current conversation, a plan file, a specification, or another artifact. Read the complete selected source and relevant conversation context. Do not expand beyond the selected task.
2. Read every applicable `AGENTS.md` and follow it over this skill. Inspect enough repository code, documentation, and current behavior to make the tasks accurate. Do not ask the user to approve the breakdown. Record evidence-based assumptions when needed.
3. Set the task-set ID and output directory. When the source plan is `.agents/<task-set-id>/PLAN.md`, reuse its `<task-set-id>` and directory. Otherwise choose an ID in the form `<YYYY-MM-DD>-<short-kebab-slug>`. Reuse an existing ID when updating the same task set. If it belongs to different work, add a short distinguishing suffix. Never overwrite unrelated tasks.
4. Create this layout in the repository root:

   ```text
   .agents/<task-set-id>/
     TASKS.md
     tasks/
       01-<short-slug>.md
       02-<short-slug>.md
   ```

   Preserve the source artifact in place. Link to a durable source from `TASKS.md`; when the source is conversation context, put all shared context needed for restart in the manifest. Use one task specification file per task, including one-task sets, so `/skill:implement` has one schema. When updating a legacy single-file task set, preserve its IDs, status, dependencies, acceptance criteria, and completion evidence while moving task sections into linked files; replace the old manifest content only after every new file is written and audited.
5. Write `TASKS.md` as the coordination manifest. It owns shared context, task IDs and paths, persisted status, dependencies, and the final task-set gate. Do not put task-specific criteria or completion notes in the manifest.
6. Write each linked task file as that task's implementation contract. It owns the delivered outcome, task-specific context and boundaries, numbered acceptance criteria, focused verification, and parent-written completion record. Do not duplicate status or dependencies from the manifest.
7. Audit the complete result: every selected-source requirement belongs to at least one task, every task link resolves, IDs and blockers match the manifest, every task is a vertical slice or justified refactor step, acceptance and verification are observable, shared constraints have one owner, and no task is likely to exceed 200k context.

## Canonical ownership

- The source plan or selected source owns product requirements and rationale.
- Applicable `AGENTS.md`, code, and build configuration own repository-wide rules and standard commands.
- `TASKS.md` owns shared task-set implementation context, task paths, dependencies, and `pending` or `complete` status.
- Each task file owns its scope, acceptance criteria, focused verification, and completion evidence.
- Git owns changed code and commit identity. Do not record a task's commit SHA in a file committed by that commit.
- The parent implementation agent alone updates persisted status and completion evidence. Workers and reviewers do not edit task artifacts.

## Task rules

- Give each task a stable ID: `<task-set-id>-NN`, numbered in dependency order. Do not renumber existing tasks when updating a task set.
- Name its file `tasks/NN-<short-slug>.md`. Preserve an existing task path when updating it.
- Make each implementation task a narrow, complete path through every affected layer. Include the data, behavior, interface, tests, configuration, migration, and documentation needed for that path when applicable.
- Each completed task must leave the repository valid and deliver behavior that can be directly verified. Do not create a sequence of layer-only tasks such as database, then API, then UI.
- Include minimal scaffolding in the first slice that uses it. Do not make broad setup or architecture a standalone task unless it has an independently verifiable result.
- Treat wide mechanical refactors as an exception. When a vertical slice cannot remain valid, use expand, bounded migration batches, then contract. Each step must state and verify its valid intermediate state.
- Scope each task for one fresh agent session, targeting about 100k total context including discovery, implementation, and verification. Split it when it could plausibly exceed 200k.
- List only genuine blockers in the manifest. A `pending` task is available when every listed blocker is `complete`. Do not persist derived `blocked`, `available`, or `in_progress` states.
- Give a new agent enough task-specific context to start without the originating conversation. Treat paths as starting points, not an exhaustive edit list.
- Keep shared constraints in the manifest. In task files, point to shared context rather than copying it unless a short repeated warning prevents a material mistake.
- Use stable acceptance IDs `AC-1`, `AC-2`, and so on. Write observable criteria without status checkboxes; the manifest is the sole owner of overall task status.
- Put focused automated checks and actual behavior exercises in each task file. Put full-repository or cross-task gates in the manifest's final verification section instead of repeating them in every task.
- Mark a manifest task `complete` only after its acceptance criteria are met, required task verification succeeds, and its completion record is filled.

## `TASKS.md` manifest format

```markdown
# Tasks: <task title>

Task set: `<task-set-id>`
Source: <relative link, URL, or "current conversation at task creation">

## Shared context

<Goal, current state, shared decisions and constraints, useful terminology, high-value starting paths, and assumptions. Preserve source details needed across tasks without inventing a new plan.>

Read this manifest, the selected task file, the linked source when needed, and all applicable repository instructions before implementation.

## Tasks

| Status | ID | Task | Blocked by |
|---|---|---|---|
| pending | `<task-set-id>-01` | [<vertical outcome>](tasks/01-<short-slug>.md) | None |
| pending | `<task-set-id>-02` | [<vertical outcome>](tasks/02-<short-slug>.md) | `<task-set-id>-01` |

## Final verification

- <full-repository or cross-task gate run after cumulative review>
```

## Task specification format

```markdown
# <task-set-id>-01: <vertical outcome>

Manifest: [TASKS.md](../TASKS.md)
Source context: <optional relative link or source section>

## Delivers

<Behavior or result available when this task is complete.>

## Context

- <Task-specific decision, constraint, current behavior, boundary, or relevant path.>

## Acceptance criteria

- AC-1: <observable criterion>
- AC-2: <observable criterion>

## Verification

- <Focused automated check and actual behavior exercise, including what proves success.>

## Completion record

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Acceptance evidence:
  - AC-1: <fill when complete>
  - AC-2: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>
```
