# Tasks: Research provider-boundary remediation and completion

Task set: `2026-08-13-research-provider-boundary-remediation`
Source: [v3-v7 evaluation results](../2026-08-13-research-context-isolation/EVALUATION-RESULTS.md), [original task set](../2026-08-13-research-context-isolation/TASKS.md), and the current conversation at task creation

## Task context

The Research child lifecycle is substantially implemented. Original tasks 01 through 05 are complete: persistent parent-owned Research sessions, explicit continuation, child-only stale-result masking, shared work budgets, successful-fetch provenance, citation validation, child extension isolation, and bounded parent-visible output have focused coverage. The original Task 06 evaluation gate has not passed, so original Task 07 optimization remains blocked.

The retained v6 and v7 attempts separate the remaining defects:

- V6 completed fresh isolated Research calls with bounded marker-free parent and provider envelopes. Its downstream command unloaded the production subagent extension, so downstream `context` leakage was an evaluation-command defect. V6 also exposed a real continuation defect: private-value matching treated shared `thinkingSignature` metadata as child evidence and orphaned a provider function-call output. Commit `249b9fe290e0bfa984d6b72406fbdde8271f475e` fixed that narrow collision.
- V7 loaded the production boundary for downstream calls and kept tools disabled, but exposed a broader provider adapter defect. The model-agnostic `context` contained the correct bounded Research report. The OpenAI Responses payload then lost `function_call_output.output`, replaced valid parent messages with the bounded isolation error, and retained an unnamed `webfetch` schema. The provider rejected the request. C5 continuation therefore did not execute.
- The child researcher itself produced strong fresh reports in v6 and v7. The remaining correctness work is concentrated in the parent provider boundary and its production integration, not in search, persistence, budgets, masking, or evidence validation.

Treat `.agents/2026-08-13-research-context-isolation/audit/v3/` through `audit/v7/` and every committed evaluation design/result as immutable historical evidence. Do not edit, overwrite, delete, or retry a retained attempt. New evaluation work must use a new versioned audit directory.

Use `openai-codex/gpt-5.6-sol:high` as the correctness baseline. Keep direct `websearch` and `webfetch` limited to one narrow lookup or one known URL. Do not add Oracle behavior, mutation tools, shell access to the researcher, nested delegation, or default report artifacts.

Relevant starting points:

- `.pi/agent/extensions/subagent/research-boundary.ts` owns parent `context` and `before_provider_request` enforcement.
- `.pi/agent/extensions/subagent/index.ts` owns Research registration, lifecycle, result details, and child invocation.
- `.pi/agent/extensions/subagent/research-session.ts` owns trusted persistence and continuation.
- `.pi/agent/extensions/subagent/subagent.test.ts` and `research.test.ts` contain provider and lifecycle seams.
- [v7 raw audit](../2026-08-13-research-context-isolation/audit/v7/) contains the exact corrupt OpenAI Responses payloads.
- [v7 design](../2026-08-13-research-context-isolation/EVALUATION-v7.md) is the latest frozen protocol and must remain unchanged.

Pick any unchecked task whose blockers are complete. Before starting, read this complete task set, every linked source needed by the selected task, and all applicable repository instructions. Implement one task at a time. Exercise actual behavior; tests alone do not establish provider correctness. Record completion notes and check a heading only after every acceptance criterion and verification item succeeds.

## [x] 2026-08-13-research-provider-boundary-remediation-01: Preserve valid provider-native Research call pairs

**Delivers:** The parent boundary sends one bounded Research result to the provider without forwarding child-private evidence or corrupting provider-native messages, function calls, function outputs, or tool schemas.

**Blocked by:** None

**Context:**

- V7 proves the current recursive private-value sanitizer is over-broad. Parent-originated handoff text, provider metadata, and protocol values may legitimately recur in the child transcript.
- Private classification must come from trusted child evidence origins, not from every scalar value in every child message.
- The `context` hook is the primary model-agnostic transformation boundary. `before_provider_request` is the final provider-specific assertion and enforcement boundary. It must not invent malformed provider payloads.
- Reuse the exact v7 OpenAI Responses shapes from ignored raw audit fixtures in deterministic tracked tests without modifying the raw artifacts.

**Acceptance criteria:**

- [x] Private fingerprints derive only from actual child-private origins: child web tool results, child tool-call structures and opaque IDs, non-final progress observations, child details, and child usage or telemetry. Trusted handoff values, parent-originated prompt text, generic field names, final bounded synthesis, and required provider metadata are not tainted merely because they recur in the child.
- [x] The parent `context` contains the original parent user and assistant messages, the original Research tool call, and exactly one bounded Research tool result with no `details`, child usage, child messages, raw markers, or private child structures.
- [x] The OpenAI Responses payload preserves the matching `function_call` and `function_call_output`, including the bounded `output`, call ID, reasoning metadata needed by the provider, and every active tool schema name. It contains zero raw child markers, details, usage, progress snapshots, or child tool structures.
- [x] Provider-specific coverage also proves that Anthropic-style and generic message envelopes remain valid; provider enforcement does not depend on OpenAI field names alone.
- [x] The `context` hook removes all known private origins before provider serialization. Because Pi's documented `before_provider_request` hook can replace but not cancel a request, an unexpected provider-level leak uses a tested provider-native replacement containing only one bounded isolation diagnostic and no tools or private evidence. The transport may receive that safe request; it never receives the tainted payload or a malformed call/output envelope. Evidence-free telemetry records the replacement.
- [x] Fresh, parallel, interleaved, persisted-reload, cancellation, failure, and no-marker paths retain request-correlated telemetry and immutable private details without changing generic subagent behavior.
- [x] Deterministic regressions use more than 100 KiB of unique child markers and the exact v7 failure characteristics: shared parent/child values, `thinkingSignature`, `function_call_output`, required `output`, and named `webfetch` schema.

**Verification:**

- Run the focused Research/subagent suites with a local fake OpenAI Responses provider and assert the actual transport receives a valid call/output pair and bounded report.
- Replay sanitized copies of representative v7 parent `context` and provider payload fixtures; assert exact required fields, zero markers, bounded growth, and no unnamed tool schema.
- Force each fail-closed branch through an actual AgentSession and inspect the fake transport payload, persisted audit entry, and bounded session/UI result. Assert the transport receives either no request or one provider-valid diagnostic-only request with zero private evidence, never the tainted payload.
- Run both web suites, offline extension loading, generic single/parallel/chain regressions, and `git diff --check`.

**Completion notes:**

- Changes: Replaced broad recursive scalar taint with origin-aware text, opaque-ID, and canonical-structure fingerprints scoped to each Research run. The context boundary now preserves sequential and reloaded parent provenance while reducing each Research result to one bounded text envelope. Provider validation requires one exact native `research` call/output pair, preserves OpenAI Responses reasoning fields, repairs only the exact known unnamed `webfetch` schema, and validates Anthropic and generic envelopes. A native-provider Proxy composes a terminal payload guard without dropping provider capabilities or request options; dynamic unguarded provider replacement aborts before transport and is wrapped for retry.
- Decisions or deviations: `before_provider_request` remains an early assertion because Pi chains later handlers. Terminal enforcement runs through the active native provider's `onPayload`; if another extension replaces that provider after wrapping, the current operation aborts with evidence-free telemetry rather than risking transport. Telemetry flushes at `agent_settled` or shutdown, not `agent_end`, so automatic retry and compaction retry retain correlation. Historical v3-v7 artifacts remain unchanged; the exact v7 shape is represented by a tracked sanitized fixture.
- Verification results: Independent review passed all seven criteria. Parent verification passed 73 focused Research/subagent tests, including actual OpenAI Responses, Anthropic, generic, guarded diagnostic transport, unguarded replacement abort/retry, same-session/reload, parallel/interleaved, cancellation/failure/no-marker, exact-v7, and greater-than-100-KiB cases. Both web suites passed 89/91 with two optional live tests skipped. Offline loading of subagent, webfetch, and websearch extensions, fixture JSON validation, `git diff --check`, tracked task/history mutation checks, and repository status checks passed.
- Remaining risks or follow-ups: Authenticated production-provider fresh, downstream, restart, and continuation qualification remains Task 02. Provider-native metadata variants introduced by future Pi versions may require additional exact-path classification.

## [x] 2026-08-13-research-provider-boundary-remediation-02: Prove production fresh, downstream, and resumed Research behavior

**Delivers:** Normal Pi processes can complete fresh Research, a tools-disabled downstream parent turn, and explicit continuation after restart without leaking child evidence or corrupting provider state.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-01`

**Context:**

- This is an unscored behavioral qualification, not another frozen evaluation attempt.
- Load the production subagent extension before capture in every parent process. Use `--no-tools` for downstream calls while retaining the boundary extension; verify no provider tools are advertised.
- Exercise the same C5 shape that failed in v6 and v7: fresh A/B evidence, process restart, explicit `researchId`, then new C evidence in the same child session.

**Acceptance criteria:**

- [x] A fresh persisted parent creates one isolated child, fetches the planned local sources, returns a valid bounded report and public Research ID, and completes the next parent provider request successfully.
- [x] A tools-disabled downstream invocation reloads the persisted parent with the production boundary active, advertises no provider tools, retains only bounded Research content, and completes with zero raw markers in both `context` and provider payload captures.
- [x] After a parent process restart, explicit continuation resolves the same trusted child, preserves prior A/B provenance, fetches new C evidence once, starts a fresh invocation budget, and returns a valid resumed report.
- [x] The resumed provider request preserves every required parent function-call pair and contains no orphan call ID, missing output, unnamed tool schema, `None` model, or Research isolation fallback unless a real leak fixture is injected.
- [x] Child JSONL contains no copied parent history or undeclared extension entries; normal masking, compaction, export, deletion, cancellation-then-resume, and lineage audit behavior still work.
- [x] Direct web tools, ordinary Pi sessions, and generic subagents retain existing behavior.
- [x] One authenticated local-fixture pilot uses `openai-codex/gpt-5.6-sol:high` and records lossless context/provider captures, usage, child session hashes, and repository status. It is explicitly unscored and does not alter historical audit artifacts.

**Verification:**

- Run deterministic process-restart tests and the authenticated local-fixture fresh/downstream/resume pilot.
- Independently inspect every captured call ID, function output, tool schema, marker search, child hash, budget ledger, and provenance record.
- Exercise cancellation followed by resume, normal child export/deletion, and an interactive collapsed/expanded Research rendering check.
- Run focused Research/subagent tests, both web suites, offline loading, repository mutation checks, and `git diff --check`.

**Completion notes:**

- Changes: Added the tracked Task 02 local fixture, terminal native-provider capture extension and deterministic capture test, reproducible authenticated pilot, source/repository manifests, and retained unscored results. The pilot exercises fresh A/B Research, a restarted tools-disabled downstream turn, and a restarted explicit C continuation in the same trusted child. It retains terminal transport payloads, pre-terminal context diagnostics, sessions, usage, budgets, lineage, hashes, fixture access, export/deletion, command output/status, and collapsed/expanded rendering. Boundary metadata exceptions are restricted to exact typed provider vocabulary and six canonical content types; arbitrary diagnostics, timestamps, MIME parameters, and lookalikes remain private.
- Decisions or deviations: Final provider evidence comes from a capture provider loaded before the production subagent guard, so it records only after the terminal `onPayload` transformation. Raw context is retained separately and is not claimed as the sanitized provider boundary. The pilot is intentionally unscored and uses a new ignored audit path; source manifests bind HEAD, index, and executed worktree bytes independently because qualification ran before this task commit.
- Verification results: Independent review passed all seven criteria. The retained authenticated run `audit/task-02/20260813T215038Z/` used `openai-codex/gpt-5.6-sol:high`; fetched `/a.txt`, `/b.txt`, and `/c.txt` exactly once; preserved one child and Research ID across restart; used two invocation budgets; emitted valid fresh and resumed native pairs; exposed no downstream tools, raw markers, unnamed schema, `None` model, or fallback; and passed export, deletion, and interactive rendering checks. Parent verification passed 76 focused tests including terminal capture, 89/91 web tests with two optional live skips, offline loading, Python compilation, diff checks, source-manifest equality, retained-audit assertions, and the unchanged v3-v7 aggregate hash `62eebe5fa19a20f3f6d467d368e65ff4dba56bb926dd549a3c8d03734c01331b`.
- Remaining risks or follow-ups: Future provider protocol values or content types require explicit typed allowlist entries plus adversarial coverage. Pre-terminal context and authenticated raw artifacts remain private ignored evidence. Scored evaluation preflight and extraction are Tasks 03-06.

## [ ] 2026-08-13-research-provider-boundary-remediation-03: Add a reproducible preflight and provider-shape gate

**Delivers:** A tracked preflight harness creates deterministic evaluation inputs and rejects command, environment, fixture, or provider-envelope defects before any scored model cell launches.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-01`

**Context:**

- V3 through v6 lost time to avoidable preflight and artifact-generation defects. V7 launched despite a provider shape that a deterministic qualification should have rejected.
- This task stops at launch qualification. Raw-result extraction and scoring audit belong to Task 04.
- Keep raw model traces ignored. Track the runner inputs, fixture generator, packet definitions, capture extension, command schema, and provider-shape qualification.

**Acceptance criteria:**

- [ ] One documented command creates an empty versioned audit directory, records exact argv/environment/status files, generates the fixed ten-route fixture and prompts, starts and stops the fixture safely, and validates hashes, route order, source sizes, session freshness, and extension policy.
- [ ] A no-model dry run validates every direct, isolated, continuation, and downstream command expansion in fixed order, including full commit IDs, exact model/reasoning, unset `PI_SUBAGENT_DEPTH`, active extensions, tools policy, budgets, output caps, and artifact paths.
- [ ] A local fake-provider qualification runs the production registered Research tool and rejects missing `function_call_output.output`, orphan call IDs, unnamed tool schemas, advertised downstream tools, raw marker leakage at either boundary, missing captures, or unbounded envelopes.
- [ ] The gate cannot launch a scored provider command until every preflight and fake-provider assertion has a retained passing record.
- [ ] Tests inject each known v3-v7 preflight, command, fixture, and provider-shape defect and produce one stable actionable diagnostic.
- [ ] Historical v3-v7 designs, results, and raw audit directories remain byte-for-byte unchanged.

**Verification:**

- Run the no-model dry run twice into disposable ignored directories and compare deterministic files after excluding timestamp and process-ID fields declared by the schema.
- Run the fake-provider qualification against valid and corrupt OpenAI Responses fixtures; prove the scored transport launcher remains unreachable on every failure.
- Run harness tests, schema validation, repository status checks, and `git diff --check`.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-04: Add lossless extraction and static evaluation audit

**Delivers:** Raw evaluation artifacts are transformed into reproducible measurements, validity, citation, and score records without mutation or silent retry.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-03`

**Context:**

- Retained v3-v7 reviews repeatedly corrected derived validity after execution. One tracked analyzer and auditor must become authoritative before v8 is frozen.
- The analyzer reads raw records only. Derived files may be regenerated; raw prompts, captures, stdout, sessions, fixture logs, and child copies are immutable inputs.

**Acceptance criteria:**

- [ ] Extraction computes exact serialized context/provider bytes and token estimates; parent, child, and total usage/cache/cost/calls/elapsed; tool calls; budget/masking/compaction events; outputs; citations; child hashes; and invalidation reasons.
- [ ] Static audit detects missing, duplicate, reordered, retried, or overwritten cells and verifies fixed order, command identity, access-log order, call/output pairing, tool schemas, marker scans, child custom types, provenance, and hashes.
- [ ] The validity model distinguishes phase-local observations, complete arm validity, score eligibility, qualitative observations, and suite-level gates without converting missing measurements to zero or pass.
- [ ] Citation audit opens each retained source body in full and records supporting lines, source role, successful fetch provenance, entailment, unsupported claims, and resumed evidence.
- [ ] Analyzer output is deterministic from the same raw inputs and records its own version and input hashes.
- [ ] Tests cover malformed JSONL, partial provider failure, cancellation, missing child copies, bad hashes, failed provenance, missing preflight records, invalid downstream decisions, and stale derived files.
- [ ] Historical v3-v7 raw audit artifacts remain byte-for-byte unchanged.

**Verification:**

- Run extraction twice against immutable copied fixtures and compare all derived outputs byte-for-byte.
- Replay representative valid and invalid v3-v7 raw shapes and independently recompute critical bytes, markers, call pairs, usage sums, scores, and gates.
- Run analyzer/auditor tests, schema validation, repository status checks, and `git diff --check`.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-05: Freeze the context-first v8 evaluation

**Delivers:** A standalone committed v8 design reuses the accepted cases and rubric while pinning the remediated implementation and reproducible harness before scored execution.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-02`, `2026-08-13-research-provider-boundary-remediation-03`, `2026-08-13-research-provider-boundary-remediation-04`

**Context:**

- Create and commit the design separately before any scored invocation. Do not run scored cells in this task.
- Inherit the v7 evidence packets, prompts, fixed order, no-retry rule, scoring rubric, and isolation/quality gates. Change only the implementation baseline, audit version, harness integration, and corrections already proven by Tasks 01 through 04.
- Preserve v3-v7 attempts as immutable history rather than folding them into v8 results.

**Acceptance criteria:**

- [ ] The tracked v8 design names the exact implementation, harness, prompt, fixture, capture, extraction, and scoring blobs and gives a satisfiable standalone design-seal and execution-revision rule.
- [ ] Exact direct/isolated prompts, packets, model/effort, retrieval date, tools, output caps, budgets, case order, timeout, no-retry rule, invalidation rules, rubric, and success thresholds remain equivalent to the frozen v7 protocol.
- [ ] Both downstream arms load the production boundary before capture, use `--no-tools`, expose no provider tools, and retain equivalent parent setup.
- [ ] Preflight requires Task 03's no-model dry run and fake-provider payload qualification plus Task 04's analyzer/static-audit qualification to pass before starting the fixture server or any scored cell.
- [ ] The design requires zero markers and private child fields in every isolated `context` and provider payload, a valid bounded call/output envelope, successful C5 continuation, complete lossless metrics, and independent full-source citation audit.
- [ ] A reviewer verifies every inherited rule and changed rule, finds no impossible or ambiguous preflight, and confirms that only the design and required ignore rule are included in the standalone signed commit.

**Verification:**

- Run the harness design validator and no-model dry run against the exact proposed v8 files.
- Have an independent reviewer compare v8 to v7 and enumerate every semantic change; require every change to map to an accepted remediation criterion.
- Commit the frozen design as one signed standalone commit and confirm no scored audit directory exists.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-06: Execute and independently audit v8

**Delivers:** One immutable v8 attempt receives an independently verified PASS or terminal FAIL disposition; only PASS completes original Task 06 and unlocks optimization.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-05`

**Context:**

- Run v8 once in fixed order. A scored-launch defect requires retained evidence and a terminal FAIL for this roadmap; do not create v9 in this task set.
- This task may be completed with an honest terminal FAIL after all launched work is retained and audited. Tasks 07-10 require an explicit v8 PASS, not merely this task heading.
- On PASS, update only the original `2026-08-13-research-context-isolation-06` heading and completion notes. Do not rewrite its acceptance criteria text or checkbox list.

**Acceptance criteria:**

- [ ] Every preflight result and every launched direct, isolated, continuation, and downstream cell is retained losslessly; fixed order, launch count, timeout, failure, cancellation, and no-retry state are explicit.
- [ ] The tracked analyzer reports exact parent/child/total usage, cache, cost, calls, latency, tools, budgets, masking, compaction, outputs, details, child copies, hashes, invalidation, citations, scores, and all suite gates without treating missing evidence as pass or zero.
- [ ] Independent review recomputes critical context/provider bytes, marker/private-field scans, call/output pairs, tool schemas, C5 lineage and provenance, citation support, downstream decisions, and gate results from raw artifacts.
- [ ] If v8 passes, C1 has at least 100 KiB of direct parent-visible evidence; every isolated boundary is marker-free and valid; C5 resumes successfully; every quality threshold passes; and higher child compute is reported only as the isolation premium.
- [ ] On PASS, an independent reviewer returns PASS for every original Task 06 criterion, the original Task 06 heading and completion notes are updated, and the tracked report clearly separates v8 from prior attempts.
- [ ] If any v8 gate fails, the tracked report names the exact failing raw evidence, the original Task 06 remains unchanged and unchecked, Tasks 07-10 remain blocked, and the task set records a terminal stop without adapting or rerunning v8.

**Verification:**

- Execute the frozen harness once and retain the complete ignored v8 audit directory plus tracked results.
- Independently inspect every parent payload, child JSONL, call ID/output pair, citation URL, budget ledger, score, and gate calculation.
- Run final focused Research/subagent/web suites, offline loading, authenticated local/web/resume/cancellation checks, interactive UI checks, normal export/deletion, repository status, and `git diff --check`.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-07: Freeze the optimization comparison protocol

**Delivers:** A standalone committed protocol fixes every optimization candidate, repetition, ordering, tolerance, quality gate, and adoption rule before candidate measurements begin.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-06` and its explicit v8 PASS disposition

**Context:**

- Do not run optimization candidates in this task. The accepted v8 result is the immutable correctness baseline.
- Candidate selection after seeing results would invalidate the comparison. Freeze the complete matrix and analysis before measurement.

**Acceptance criteria:**

- [ ] The tracked protocol fixes the exact baseline configuration and one-variable candidate matrix for cache affinity, retrieval concurrency, child turns or handoff, and cheaper standard model/reasoning.
- [ ] It fixes three paired repetitions per candidate, pair order, deterministic ordering seed where applicable, timeout, retry/invalidation rules, raw artifact layout, and the exact success-adjusted cost/latency comparison.
- [ ] It defines numeric non-inferiority tolerances and mandatory zero-regression gates for parent isolation, citation validity, unsupported claims, answer correctness, required structure, and downstream decisions.
- [ ] It states which provider-reported cache fields establish affinity and prohibits savings claims when the provider does not expose sufficient evidence.
- [ ] It defines adoption and rejection before execution: adopt only a measured improvement that stays within every frozen quality tolerance; otherwise preserve the accepted v8 baseline.
- [ ] It pins the harness, evaluator, model catalog snapshot, cases, source/work budgets, output caps, and citation audit used by every candidate.
- [ ] An independent reviewer confirms that each comparison changes one variable, the matrix cannot be selectively shortened, and only the protocol is included in its standalone signed commit.

**Verification:**

- Run the protocol schema and command-expansion dry run without launching candidate model cells.
- Independently recalculate every declared tolerance and adoption branch on synthetic pass, regression, missing-data, and invalid-cell fixtures.
- Commit the protocol separately and confirm no optimization audit directory exists.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-08: Measure cache affinity and retrieval concurrency

**Delivers:** The first optimization stage adopts or rejects stable resumed-session cache affinity and concurrent independent retrieval against the accepted v8 baseline without weakening isolation or quality.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-07` and the accepted v8 PASS baseline

**Context:**

- Change one variable at a time. Use the accepted v8 cases, budgets, output caps, scoring, and parent-boundary assertions.
- Stable persistent child identity may improve cache affinity, but only provider-reported cache reads/writes count as evidence.
- Independent known-URL fetches may run concurrently; discovery-to-fetch dependencies remain ordered.

**Acceptance criteria:**

- [ ] Baseline and candidate runs follow the frozen Task 07 matrix, complete all three declared paired repetitions, differ by exactly one variable, and retain paired raw artifacts, quality scores, boundary assertions, usage, cost, calls, and latency.
- [ ] Fresh and resumed children retain stable session and prompt-cache identity across process restarts; actual provider cache read/write behavior is measured or a provider limitation is documented without a savings claim.
- [ ] Independent retrieval may execute concurrently within the shared reservation ledger, while dependent retrieval remains ordered and count/byte budgets remain race-safe.
- [ ] Cancellation and partial failure during concurrent retrieval leave deterministic finalized reservations and a resumable child.
- [ ] Any adopted cache or concurrency change improves a measured dimension without worsening v8 isolation, citation quality, answer quality, or downstream thresholds. A non-improving candidate is rejected with retained evidence.
- [ ] Details/UI continue to report model, reasoning, cache, child/total usage, masking, budgets, lineage, and concurrency outcomes without entering parent model context.

**Verification:**

- Run every frozen three-repetition pair against the accepted v8 baseline and apply the precommitted success-adjusted cost, latency, and non-inferiority calculations.
- Rerun the >100 KiB boundary case and matched downstream decision after each adopted change.
- Exercise concurrent limit boundaries, cancellation, resume, direct/generic regressions, focused/web suites, and `git diff --check`.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-09: Measure child-turn and standard-model candidates

**Delivers:** The second optimization stage adopts or rejects fewer child turns and a cheaper standard route using the accepted v8 quality rubric.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-08`

**Context:**

- Keep `openai-codex/gpt-5.6-sol:high` unless a cheaper standard model/reasoning route is non-inferior.
- Do not remove adaptive research steps merely to lower requests. Preserve source screening, contradiction handling, citation provenance, and required output structure.

**Acceptance criteria:**

- [ ] Each child-turn or handoff candidate follows the frozen Task 07 matrix, completes all three declared paired repetitions, changes one variable, and uses the same cases, source/work budgets, answer cap, scoring, and boundary gates as the accepted baseline.
- [ ] A child-turn change is adopted only when it reduces redundant model requests or latency without reducing adaptive behavior, valid citations, required structure, or downstream quality.
- [ ] A cheaper standard model/reasoning route is adopted only when repeated paired results are non-inferior for answer correctness, citation support, unsupported claims, insufficiency, and downstream decisions.
- [ ] Sol/high remains pinned when non-inferiority is not established; rejected candidates and losses remain visible in tracked results.
- [ ] At least one scoped optimization improves a measured cost, token, cache, request, or latency dimension without weakening isolation or quality, or all scoped candidates are safely rejected and the accepted baseline is preserved.
- [ ] Direct web and generic subagent behavior do not regress, and Research details/UI retain exact effective model and reasoning telemetry.

**Verification:**

- Run every frozen three-repetition candidate/baseline pair; retain raw outputs, usage, timing, scoring, and full citation audits and apply the precommitted tolerances.
- Rerun provider-boundary, resumed continuation, downstream decision, cancellation, compaction, budget exhaustion, and evidence-validation cases after each adopted change.
- Run focused Research/subagent/web suites, offline loading, interactive rendering, repository mutation checks, and `git diff --check`.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>

## [ ] 2026-08-13-research-provider-boundary-remediation-10: Close the original roadmap and document final routing

**Delivers:** The accepted implementation, evaluation, optimization evidence, routing guidance, and original Tasks 06-07 are synchronized and fully verified.

**Blocked by:** `2026-08-13-research-provider-boundary-remediation-09`

**Context:**

- This task performs final integration and documentation. It must not introduce another optimization variable.
- Update the original Task 07 heading and completion notes only when every original acceptance criterion is supported by the accepted v8 baseline and Tasks 08-09. Do not rewrite its acceptance criteria text or checkbox list.

**Acceptance criteria:**

- [ ] The original Task 07 heading and completion notes accurately record adopted and rejected optimizations, measured cache/cost/token/call/latency effects, and retained quality/isolation evidence without changing its acceptance criteria.
- [ ] Final guidance states when to use direct `websearch` or `webfetch`, when to use Research, why delegated investigation must not be duplicated, the measured isolation benefit, and the remaining isolation premium.
- [ ] Details/UI and audit documentation state the effective model/reasoning, parent/child/total usage, cache, masking, budgets, provenance, lineage, continuation, and retention behavior without exposing private evidence.
- [ ] Normal Pi export/deletion, process restart, fresh/resumed local and web Research, concurrent retrieval, cancellation, compaction, budget exhaustion, citation validation, and interactive rendering all work on the accepted configuration.
- [ ] The >100 KiB provider-boundary and downstream-quality gates pass on the final configuration; no Oracle behavior, mutation capability, shell, nested delegation, or default report artifact was introduced.
- [ ] Every tracked design/result/task link resolves, historical v3-v7 attempts remain unchanged, ignored raw artifacts are retained, every remediation-task commit is signed or recovered through the documented signing workflow, and the repository is clean except for documented ignored audits. Historical commits are not rewritten.

**Verification:**

- Run the complete focused Research/subagent/web suites, offline extension loading, authenticated fresh/resume/cancellation checks, interactive UI checks, normal export/deletion, repository mutation checks, link checks, `git diff --check`, and signature/status checks.
- Independently review the final implementation and both task sets against every remaining original Task 06-07 acceptance criterion.

**Completion notes:**

- Changes: <fill when complete>
- Decisions or deviations: <fill when complete>
- Verification results: <fill when complete>
- Remaining risks or follow-ups: <fill when complete>
