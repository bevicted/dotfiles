---
name: writing-for-agents
description: Write and revise instructions consumed by coding agents, including skills, AGENTS.md, CLAUDE.md, and linked guidance. Use when creating or reviewing agent-facing instructions.
---

# Writing for agents

Write instructions that produce consistent decisions and actions. Match all governing instructions, including their style rules.

For a skill, also read [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) before editing.

## Workflow

1. Read the governing instructions, the complete target document, and any linked material needed for the task.
2. Define the behavior the document must produce. Identify distinct trigger branches and any hard constraints.
3. Place each item at the right level:
   - Put required actions in ordered steps.
   - Keep reference near the step or concept that uses it.
   - Move branch-specific detail to a linked document when it would obscure the main path.
   - Keep each rule in one authoritative location.
4. Write direct instructions with concrete verbs, stable terminology, and explicit completion criteria.
5. Prune and validate against the checklist below.

The edit is complete when every required behavior appears once, all links and examples are valid, and the document conforms to its governing instructions.

## Context pointers

A context pointer names material outside the current document and states when to read it. Skill descriptions and links from `AGENTS.md` are context pointers.

Write each pointer to:

- Name the material or capability first.
- State the exact conditions that require it.
- Cover each distinct branch once. Remove synonymous triggers.
- Inline critical or universally needed rules instead of hiding them behind a pointer.

A pointer consumes context whenever its containing document is loaded. Keep it shorter than the material it exposes.

## Structure

Separate actions from reference:

- **Steps** tell the agent what to do and in what order.
- **Reference** supplies rules, facts, definitions, and examples used by those steps.

Keep the main path visible. Group a concept's rules and caveats under one heading. Split a document only when a linked branch has a distinct trigger or when the main document has become difficult to scan.

Give each step a checkable bound. Prefer "account for every modified file" over "review the changes." Add an exhaustive bound only when the task requires exhaustive work.

## Wording

- Use imperative, literal language.
- State the desired behavior. Use prohibitions only for hard guardrails, paired with the positive alternative when useful.
- Prefer concrete verbs such as `read`, `compare`, `run`, and `verify`.
- Reuse one established term for one concept. Avoid decorative synonyms and invented jargon.
- State rationale only when it changes a decision or prevents a likely mistake.
- Use examples to resolve ambiguity, not to repeat a rule.
- Follow the repository's vocabulary, formatting, and character restrictions.

## Pruning

Review every sentence:

- **Behavior:** Does it change an agent action or decision? Remove exposition and generic advice that does not.
- **Source of truth:** Can the agent get this reliably from code, configuration, directory layout, or `--help`? Refer to the source unless the lookup is costly or the reason is otherwise hidden.
- **Duplication:** Is the same rule stated elsewhere? Keep the best-placed copy.
- **Relevance:** Does it apply to a real branch? Move branch-only detail behind a pointer and remove stale material.
- **Precision:** Can compliance be checked? Replace subjective bounds with observable ones.

## Validation checklist

- The target follows every applicable `AGENTS.md`, `CLAUDE.md`, and project convention.
- Ordered work is expressed as steps; supporting material is easy to find.
- Each step has a clear completion condition where one is needed.
- Context pointers name both the material and its trigger conditions.
- Rules are authoritative in one place and do not restate easy environment lookups.
- Links resolve, examples agree with the rules, and format-specific validation passes.
- The final document is concise, ASCII-only when required, and free of stale content.
