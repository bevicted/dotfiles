---
name: codebase-design
description: Evaluate or improve a code area's module interfaces, seams, testability, caller leverage, and change locality. Use when designing or restructuring a module, assessing a deepening candidate, or when the user explicitly requests alternative interfaces.
---

# Codebase design

## Steps

1. Inspect the named code area, its callers, dependencies, and relevant tests. If no area is named, ask for one before proposing a design.
2. Describe the current module, interface, seam, adapters, depth, caller leverage, and change locality using evidence from the code. Preserve established project terminology where it communicates more clearly.
3. Recommend a change only when it improves an evidenced problem. A no-change recommendation is valid when the current shape already keeps complexity local.
4. When dependency assessment or test strategy affects a deepening candidate, read [DEEPENING.md](DEEPENING.md) and apply its process.
5. Only when the user requests alternative interfaces, read [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md) and follow that workflow. Do not start it for an ordinary design assessment.

## Reference

- **Module:** code with a caller-facing interface and an implementation. It can be a function, class, package, or cohesive slice.
- **Interface:** everything callers need to use a module correctly, including operations, inputs, outputs, invariants, ordering, errors, configuration, and relevant performance behavior.
- **Depth:** capability and complexity hidden behind an interface relative to what callers must learn. A deep module provides high leverage through a small, coherent interface.
- **Seam:** the place where behavior can vary without editing its callers. Choosing the seam is separate from choosing the interface.
- **Adapter:** a concrete implementation that fills an interface at a seam.
- **Caller leverage:** useful behavior obtained per fact a caller must know. Prefer designs that remove repeated coordination from callers.
- **Change locality:** whether a change, bug fix, required knowledge, and verification stay concentrated rather than spreading across callers.

Assess depth from callers, not implementation size. Use the deletion test: if removing an abstraction removes unnecessary complexity, simplifying it may help. If removal spreads hidden complexity into callers, the abstraction is earning its place. Prefer an interface that hides useful coordination while keeping callers and tests able to assert observable behavior through it.
