# Deepening

Use this process after reading [SKILL.md](SKILL.md), when considering a candidate whose dependencies or tests affect the design.

## Steps

1. Classify each relevant dependency from inspected code and tests:
   - **In-process:** computation or state in the same process. Treat merging as a candidate, not a default. Compare whether the current separation has a coherent interface, caller leverage, and useful change locality.
   - **Local-substitutable:** a dependency with a realistic local test stand-in. Test the module through its interface with that stand-in when it represents the required behavior.
   - **Remote but owned:** a service across a network seam that the project controls. Consider an injected port and adapters when the transport genuinely varies or needs isolated testing.
   - **True external:** a third-party dependency. Isolate the dependency behind an injected port only when that seam is justified, then use a faithful test double for behavior the module depends on.
2. Define an external seam only for demonstrated variation or a meaningful testing need. Keep internal seams private unless callers need to vary them. Production and test adapters can justify a seam; one adapter alone does not.
3. Test observable behavior through the proposed interface. Preserve useful behavior coverage while changing test layers. Remove a test only when its useful coverage remains protected by other tests; do not delete tests merely because a module was merged or deepened.
4. Compare the candidate with leaving the code unchanged. Recommend deepening only when it makes caller coordination, future changes, and verification more local without hiding complexity that callers must still manage.

## Reference

A port is an interface owned at a seam; an adapter is its concrete implementation. Keep transport and dependency mechanics behind the module when callers do not need to control them. Verify error behavior, ordering, invariants, and failure handling at the interface rather than coupling tests to internal structure.
