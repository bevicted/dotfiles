# Research support scope

Research is a read-only delegated investigation tool for iterative, multi-source, conflicting, or source-sensitive work. Use direct `websearch` for one narrow lookup and direct `webfetch` for one known URL. Do not repeat a delegated investigation with parent web tools.

## Supported baseline

The accepted baseline is commits `ebd4140` and `2b7f32f`, tested with Pi `0.84.1` and qualified against the OpenAI Responses path with `openai-codex/gpt-5.6-sol:high`.

Supported behavior:

- fresh isolated Research with bounded parent-visible output;
- persisted child sessions and explicit `researchId` continuation after restart;
- child-only evidence masking, work budgets, and citation provenance checks;
- defensive filtering at parent context and provider payload boundaries;
- bounded fail-closed diagnostic replacement when a leak is detected.

## Data and security boundaries

Research reduces parent-context exposure; it is not a security sandbox or a formally proven isolation boundary.

- Raw evidence is sent to the selected child model provider.
- Full child history is stored in the normal Pi child session and may be shown in Research details.
- The parent model should receive only the bounded final report and public Research ID.
- The frozen scored evaluation did not pass. No quantified isolation, quality, cost, or latency claim is supported.
- Provider formats or Pi releases newer than the tested baseline may require compatibility fixes.

If `Research isolation failure` appears, treat that invocation as failed. Inspect Research details and telemetry; do not rely on or blindly retry the result.

## Maintenance

Freeze the current architecture. Add code only for a reproduced production failure or an intentional Pi/provider compatibility update. Do not resume the abandoned evaluation and optimization roadmaps.

After a Pi or provider update, run:

```sh
env -u PI_SUBAGENT_DEPTH node --test \
  .pi/agent/extensions/subagent/subagent.test.ts \
  .pi/agent/extensions/subagent/research.test.ts \
  .pi/agent/extensions/subagent/research-context.test.ts

env -u PI_SUBAGENT_DEPTH node --test \
  .pi/agent/extensions/web-fetch/fetch.test.ts \
  .pi/agent/extensions/web-search/mcp.test.ts

PI_OFFLINE=1 pi --no-extensions \
  --extension .pi/agent/extensions/subagent/index.ts --help
```
