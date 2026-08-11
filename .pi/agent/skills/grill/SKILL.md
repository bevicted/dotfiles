---
name: grill
description: Stress-test a user's plan, decision, or idea through structured, prerequisite-aware questions. Use when the user explicitly asks to be grilled or asks for an exhaustive challenge to their thinking.
---

# Workflow

1. Establish the scope. Identify the goal, success criteria, constraints, and desired outcome. Ask the user only for preferences, private context, and facts unavailable through tools.

2. Build an internal decision tree covering material assumptions, alternatives, dependencies, risks, reversibility, and failure conditions.

3. Research observable facts with available tools before asking questions that depend on them. If a fact cannot be verified, state the uncertainty instead of guessing.

4. Identify the frontier: open decisions whose prerequisites are settled. Select up to five highest-impact frontier questions for the round. Keep dependent questions for a later round.

5. Format each question as:

   ```markdown
   **Q1 - <title>:** <question and relevant choices>

   > Recommendation: <answer, rationale, tradeoffs, and uncertainty>
   ```

6. Wait for the user's answers. Challenge contradictions and unsupported assumptions, update the decision tree, and repeat from step 3.

7. When no material questions remain, summarize the goal, constraints, settled decisions, remaining assumptions, and unresolved risks. Ask the user to confirm or identify omissions.

8. End the interview after confirmation. Do not implement or modify anything unless the user separately requests it.

Honor requests to stop, skip a question, or narrow the scope immediately.
