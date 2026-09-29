---
name: improve-codebase-architecture
description: Review a codebase area for evidence-grounded architecture improvements, then hand a selected candidate to grill.
disable-model-invocation: true
---

# Improve codebase architecture

## Steps

1. Read [codebase-design](../codebase-design/SKILL.md) for the design guidance used in this review.
2. Set the exploration scope. Follow a user-named module, subsystem, or pain point. If none is named, inspect recent Git history to find frequently changed areas, then state the selected scope and why it was selected.
3. Inspect the scoped code, callers, dependencies, relevant tests, and existing project guidance. Take domain names from that evidence. Use available subagent-dispatch capability for read-only exploration without prescribing agent types. Give each explorer the scope and require file evidence; if dispatch is unavailable, disclose the limitation and do not invent exploration evidence.
4. Assess only evidence-supported friction. Consider shallow interfaces, leaked coordination across seams, poor change locality, repeated caller knowledge, and difficulty testing observable behavior. Apply the design guidance's deletion test. Omit unsupported refactors. Recommend no change when the evidence does not support a useful improvement.
5. Present the review in chat only:
   - Start with a short ranked overview.
   - Follow with numbered candidates. For each, include file evidence, problem, proposed direction, benefits, risks, and recommendation strength.
   - Use short bullets. Add a small ASCII before/after sketch only when it clarifies the direction.
   - Do not propose concrete interfaces before the user selects a candidate.
   - End with the top recommendation and ask which candidate the user wants to explore. When there is no supported candidate, make the evidence-grounded no-change recommendation and ask whether to explore a different area.
6. After the user selects a candidate, retain its inspected evidence and settled constraints. Read [grill](../grill/SKILL.md) and delegate the interview behavior to that skill. Do not repeat its workflow or implement changes during the review or interview.
7. Only when the user requests interface alternatives for the selected candidate, read [codebase-design](../codebase-design/SKILL.md) again and follow its alternatives branch. Carry the selected candidate's evidence and settled constraints into that exploration. Do not start this branch for an ordinary review.
