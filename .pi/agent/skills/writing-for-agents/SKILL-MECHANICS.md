# Skill mechanics

Apply this file with [`SKILL.md`](SKILL.md) when creating or editing a skill.

## Invocation

Choose invocation before writing the description:

- **Model-invoked:** Use when the agent should discover the skill from a task. Omit `disable-model-invocation`. Write a model-facing description that states what the skill does and the distinct conditions that trigger it.
- **User-invoked:** Use when a human will invoke the skill explicitly. Set `disable-model-invocation: true`. Keep the required description to a one-line summary.

Model-invoked descriptions consume context on every turn. Use them only when autonomous discovery is worth that cost.

## Frontmatter

A skill requires:

```yaml
---
name: example-skill
description: What the skill does and when to use it.
---
```

The name must be 1 to 64 characters using lowercase letters, digits, and nonconsecutive hyphens. The description must be present and no longer than 1024 characters. Prefer matching the directory name for compatibility across agent harnesses.

Use relative paths for bundled scripts, assets, and reference documents.

## Splitting skills

Create a separate skill only when a branch needs an independent trigger. Put substantial branch-specific reference in a linked file. Keep shared rules in one file and point to it from each consumer.

## Validation

Before completion:

1. Check the frontmatter and name limits.
2. Resolve every relative link from the skill directory.
3. Confirm the description covers each real trigger branch once.
4. Confirm the selected invocation mode matches expected use.
5. Run the harness's skill validator or loader and resolve every diagnostic.
