# Design it twice

Use this workflow only after the user explicitly requests alternative interfaces for a selected candidate. Read [SKILL.md](SKILL.md) and, when dependencies matter, [DEEPENING.md](DEEPENING.md) first.

## Steps

1. Inspect the candidate, representative callers, tests, dependency categories, and project constraints. Record only verified constraints and relevant code context. State the problem space without proposing an interface.
2. Check whether independent parallel dispatch is available. If it is unavailable, say that independent parallel results cannot be produced and ask whether the user wants sequential exploration instead. Do not present sequential proposals as independent parallel designs.
3. Dispatch these three designs in parallel. Give every designer the same verified constraints and code context plus only its own priority. Do not give any designer another proposal or result.
   - **Minimal interface:** minimize entry points and required caller knowledge while preserving required behavior.
   - **Flexibility within evidence:** support variations demonstrated by the code or stated requirements, without designing for speculative use cases.
   - **Simplest common caller:** make the most common evidenced caller straightforward while retaining necessary behavior for other callers.
4. Add one dependency-focused design only when a justified dependency strategy is materially different from the three briefs, such as a remote or external dependency that needs a distinct port and adapter decision. Give it the same isolation as the other designs.
5. Require each design to provide its interface contract, a representative caller example, hidden complexity, dependency strategy, adapters when applicable, and tradeoffs.
6. Compare the results by interface contract, caller examples, hidden complexity, dependency strategy, caller leverage, change locality, and tradeoffs. Recommend one design, or a specific justified hybrid, and explain the decision from the verified constraints.
