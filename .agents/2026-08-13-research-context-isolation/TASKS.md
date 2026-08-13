# Tasks: Research context isolation hardening

Task set: `2026-08-13-research-context-isolation`
Source: [PLAN.md](./PLAN.md)

## Task context

The dedicated `research` tool must keep iterative search results, fetched pages, source screening, and working evidence out of the main agent's model context. Context isolation is the primary objective. Child and total tokens, cost, and latency are an isolation premium to measure and optimize only after the boundary is proven.

The current implementation in `.pi/agent/extensions/subagent/` starts a read-only `researcher` through the existing single-agent subprocess path, returns at most 8 KiB and 400 lines to the parent, and retains complete child messages in tool details. It currently uses `pi --no-session`, has no continuation ID, does not inspect the next parent provider payload, and maps `effort` only into prompt text. The rejected v1 evaluation used trivial evidence packets and a matched-total-token rejection rule, so it did not establish the intended isolation property.

The OpenCode investigation in `.agents/2026-08-12-isolated-researcher-subagent/OC_RESEARCHER_RESEARCH.html` confirms the target mechanics: a fresh linked child session receives only the task, retains its own tool evidence, returns only final text, can resume by task ID, and uses child compaction and stale-tool-result pruning. Its direct investigation accumulated 39 tool results and about 468 KB of model-visible tool text in the parent, demonstrating why multi-step research must remain isolated.

Approved decisions and constraints:

- Deliver the complete roadmap, not only the first isolation proof.
- Persist resumable Research children in Pi's normal JSONL session store. Reuse `SessionManager`, `parentSession`, custom non-context entries, normal export/deletion, and normal Pi compaction. Do not add a bespoke transcript database or artifact lifecycle.
- Add an optional strict `researchId` input. A fresh run returns a generated ID; only an ID already mapped to the current parent lineage, cwd, and trusted Research definition may resume. Never accept caller session paths or arbitrary Pi session IDs.
- A fresh child must not copy or fork parent history. It receives only trusted Research metadata, the researcher prompt, and the normalized handoff.
- Only bounded Research tool `content` may enter the parent model context. Full child messages, tool results, details, usage, lineage, and telemetry stay non-model-visible and inspectable.
- Use Pi's `context` and `before_provider_request` events to prove the model-agnostic and provider-specific boundaries. Use child-only `context`, `tool_call`, and `tool_result` hooks for stale-result masking, shared budgets, and evidence collection.
- Preserve the stored child transcript while masking stale observations non-destructively in provider input. Preserve recent turns, current work, errors, and exact citation evidence. Use normal Pi compaction for overflow; do not add another summarizer unless measured masking/compaction behavior proves it necessary.
- Mechanically enforce calibrated `standard` and `deep` search, fetch, and returned-byte budgets. Prompt text is not budget enforcement.
- Mechanically validate the required final sections and web citations against successful `webfetch` evidence, including evidence retained from earlier calls in a resumed Research session.
- Direct `websearch` and `webfetch` remain for one narrow bounded lookup or one known URL. Multi-query, multi-source, adaptive, conflicting, or source-sensitive work stays isolated. Parent guidance must prohibit duplicating delegated research.
- Keep `openai-codex/gpt-5.6-sol:high` as the correctness baseline. Change the standard model or reasoning only after non-inferior answer and citation quality is measured.
- Do not invoke Oracle or restore any dedicated Oracle behavior. Keep `.pi/agent/agents/oracle.md` unchanged.

Relevant starting points:

- `.pi/agent/extensions/subagent/index.ts` owns Research registration, `runSingleAgent`, parent-visible content, details, and rendering.
- `.pi/agent/extensions/subagent/research.ts` owns strict normalization, safe files, fixed researcher selection, handoff composition, and 8 KiB/400-line output bounds.
- `.pi/agent/extensions/subagent/runner.ts` owns child spawn, stdin-only prompting, cancellation, event parsing, immutable progress snapshots, and usage.
- `.pi/agent/extensions/subagent/subagent.test.ts` is the current deterministic test seam.
- Pi exposes `SessionManager.create/open`, `NewSessionOptions.parentSession`, `--session`/`--session-id`, custom entries that do not enter LLM context, normal compaction, `context`, and `before_provider_request`.
- `.pi/agent/extensions/web-search/` and `.pi/agent/extensions/web-fetch/` provide already bounded direct web tools whose ordinary parent behavior must not regress.

Pick any unchecked task whose blockers are complete. Before starting, read the task context, linked source, and all applicable repository instructions. When done, exercise actual behavior, record completion notes, and change the task heading from `[ ]` to `[x]` only when every acceptance criterion is met.

## [x] 2026-08-13-research-context-isolation-01: Prove and enforce the parent provider boundary

**Delivers:** A production-shaped Research lifecycle and deterministic provider-boundary test proving that a large private child transcript cannot enter the next parent model request.

**Blocked by:** None

**Context:**

- The current unit tests validate bounded `content` and retained `details`, but they stop before Pi serializes the next parent request.
- Refactor only enough of the Research path to inject child execution and provider capture in tests. Keep `runSingleAgent`/`runChild` as the production default and do not create a second executor.
- Pi's `context` event sees a deep-copy of model messages; `before_provider_request` sees the final provider payload. Both boundaries must be checked.
- Parent isolation telemetry belongs in a non-context custom entry and details. It must not copy raw evidence or make the parent prompt larger.

**Acceptance criteria:**

- [ ] Research execution uses one injectable lifecycle seam whose default is the existing subprocess path, including cancellation, progress, output extraction, usage, and failure classification.
- [ ] A deterministic local fake-provider test executes the registered Research tool with more than 100 KiB of unique markers across child tool results, then captures the next parent `context` event and `before_provider_request` payload.
- [ ] The captured parent messages and provider payload contain the bounded final synthesis but contain zero raw child markers, child tool calls/results, partial snapshots, and Research `details` fields.
- [ ] Below, at, and above both the 8 KiB and 400-line limits, exact serialized parent growth depends only on bounded Research content plus fixed tool-envelope overhead, not on private transcript size; output remains valid UTF-8.
- [ ] Success, preflight failure, child failure, cancellation, and partial-update paths all keep parent-visible text bounded and keep full immutable current-run child messages and usage only in details.
- [ ] Isolation telemetry records exact model-visible serialized bytes and token estimate separately from child and total usage, contains no raw evidence, and is persisted through a custom entry that does not participate in LLM context.
- [ ] Any detected leak fails closed before a provider request is sent and produces a bounded actionable Research error rather than silently forwarding private evidence.
- [ ] Generic single, parallel, and chain subagent behavior, Research rendering, and failure middleware remain unchanged.

**Verification:**

- Run the new Research provider-boundary test against the same registered tool and result-building code used in production; inspect captured payload fixtures and unique-marker assertions.
- Run `env -u PI_SUBAGENT_DEPTH node --test .pi/agent/extensions/subagent/subagent.test.ts .pi/agent/extensions/subagent/research.test.ts`.
- Run both web suites and `PI_OFFLINE=1 pi --no-extensions --extension .pi/agent/extensions/subagent/index.ts --help`.
- In a real local-only Research call, inspect the subsequent parent request telemetry and expanded details; confirm repository status is unchanged.

**Completion notes:**

- Changes: Added the exact 3x3 byte/line serialized-growth matrix, full lifecycle coverage, persisted custom-entry telemetry assertions, request-correlated pending-run consumption, structural child-content taint handling, and a one-error fail-closed leak path.
- Decisions or deviations: The provider boundary rebuilds only a bounded Research text envelope, strips Research details/usage independently, and records delivered rather than rejected-payload bytes. Persistent sessions, child masking/budgets, and evidence validation remain out of scope.
- Verification results: Focused subagent/Research suites pass (38 tests), including interleaved requests, transformed OpenAI child calls, non-text child blocks, no-marker details/usage, and the registered-tool local fake OpenAI provider run with over 100 KiB of private evidence. Both web suites pass (89 tests, 2 live tests skipped). Offline extension loading and `git diff --check` pass.
- Remaining risks or follow-ups: Authenticated model-provider smoke testing is not required for this local fake-provider boundary proof.

## [x] 2026-08-13-research-context-isolation-02: Add trusted persistent Research sessions and continuation

**Delivers:** Fresh Research calls create isolated Pi sessions in the normal session store and later calls can explicitly resume them by a safe parent-owned `researchId`.

**Blocked by:** `2026-08-13-research-context-isolation-01`

**Context:**

- Replace Research's `--no-session` child target only; generic subagents remain ephemeral unless separately requested in future work.
- Use Pi's normal `SessionManager` and CLI session targeting so existing compaction, JSONL audit/export, retention, and prompt-cache session identity apply.
- A parent session custom entry is the authoritative mapping from a public Research ID to a child session. The child stores non-context Research lineage metadata. `parentSession` should reference the parent session file when one exists; in-memory parents still require an unforgeable parent session ID match for same-process continuation.
- The public input remains strict and gains only optional `researchId`; never expose or accept a filesystem path.

**Acceptance criteria:**

- [ ] The strict schema and normalizer accept optional non-blank `researchId`, reject unknown fields and malformed IDs, and retain all existing path/web/effort validation.
- [ ] A fresh call generates a Research ID, creates a normal Pi child session with trusted lineage metadata and fixed user researcher/model/tools, and returns the ID in bounded model-visible metadata and complete details.
- [ ] Inspecting a fresh child JSONL proves it contains no parent conversation messages and begins only with normal session metadata, non-context Research metadata, and the normalized child handoff.
- [ ] The parent stores a non-context mapping entry containing the Research ID, child session identity, canonical cwd, parent lineage, trusted agent/model/tools, creation/update time, and no caller-controlled path.
- [ ] A resumed call resolves only through the current parent's mapping, validates cwd and trusted researcher identity, targets the same child session, and makes prior child evidence available to the child without copying it into parent content.
- [ ] Missing, malformed, deleted, cross-parent, cross-cwd, project-local, ordinary Pi session, and tampered IDs fail before spawn with bounded diagnostics that do not disclose session paths.
- [ ] Concurrent attempts to resume the same Research ID are serialized or rejected deterministically; cancellation leaves the child session valid for a later resume.
- [ ] Continuation works after a parent process restart for persisted parent sessions. In-memory parent behavior is explicit and tested.
- [ ] Child session lineage is visible in details/UI audit, and normal Pi session export and deletion work without a bespoke cleanup mechanism.

**Verification:**

- Exercise a fresh local-only call and two resumed calls, restart Pi between calls, and inspect parent/child JSONL plus next parent provider payloads.
- Attempt every invalid ownership/cwd/session case and prove failure occurs before child spawn.
- Exercise simultaneous resumes and cancellation followed by a successful resume.
- Export and delete a Research child using normal Pi session facilities, then confirm resume reports a bounded missing-session error.
- Run focused Research/subagent tests, both web suites, offline extension loading, and repository mutation checks.

**Completion notes:**

- Changes: Added strict opaque `researchId` normalization, SessionManager-backed Research child bootstrapping, parent custom mapping entries, trusted resume validation, process-safe atomic child-session locks, and child lineage in details/UI.
- Decisions or deviations: The parent mapping stores only the child session ID, never a path. Persisted parents resolve that ID only inside their session directory; an atomic 0600 sidecar lock beside the trusted child JSONL serializes independent Pi processes. In-memory parents can continue only through the same live SessionManager object.
- Verification results: Focused Research/subagent tests pass (42 tests), including JSONL isolation, restart, ownership/cwd/tampering/deletion, separate-store filesystem locking, normal-Pi handoff persistence, real cancellation followed by normal-Pi resume, ordinary-session, and in-memory cases. Web suites pass (89 tests, 2 live tests skipped). Offline extension loading and `git diff --check` pass.
- Remaining risks or follow-ups: Child stale-result masking, work budgets, and evidence validation remain intentionally deferred to Tasks 03 through 05.

## [x] 2026-08-13-research-context-isolation-03: Mask stale child evidence without mutating its transcript

**Delivers:** Long or resumed Research sessions keep recent and citation-critical evidence while old web observations stop being repeatedly sent to the child model.

**Blocked by:** `2026-08-13-research-context-isolation-02`

**Context:**

- Register child-only context management through a trusted Research-child environment/session marker. The hook must be inert in parent sessions, generic subagents, and direct web-tool use.
- Follow the approved OpenCode-like strategy: mask old tool outputs in provider input, preserve the stored JSONL transcript, and rely on Pi's normal compaction for overflow.
- Use deterministic masking first. Do not introduce an LLM summarization call for stale observations in this task.

**Acceptance criteria:**

- [ ] A Research-child-only `context` hook activates from validated session lineage, not from arbitrary prompt content or an untrusted environment value alone.
- [ ] Masking starts only after at least one newer completed turn and protects a calibrated recent-token budget; current task/turn, errors, incomplete calls, and configured protected tools are never masked.
- [ ] Stale `websearch` and `webfetch` results are replaced in provider input with compact deterministic records containing tool kind, query or canonical URL, retrieval status, and retained evidence references, not free-form summaries.
- [ ] Exact excerpts needed by citations and the most recent evidence remain available to the child; the policy has an observable deterministic rule for what is protected.
- [ ] Stored child session entries remain byte-for-byte unchanged by masking and remain available to normal Pi export/audit.
- [ ] Synthetic histories below, at, and above every age/token threshold show reduced provider context, stable ordering, valid tool-call/result structure, and no effect on parent or generic-subagent contexts.
- [ ] Normal Pi auto-compaction still triggers and resumes correctly on an oversized Research child; masking does not duplicate or conflict with compaction summaries.
- [ ] Masking telemetry reports original and delivered bytes/token estimates without including raw evidence in the parent.

**Verification:**

- Build synthetic persisted child histories with unique recent, stale, error, and citation markers; compare stored JSONL hashes before/after provider calls and inspect captured child provider payloads.
- Run a multi-call web Research session large enough to trigger masking, then an overflow fixture that triggers normal Pi compaction and continues.
- Confirm a parent direct `websearch`, generic subagent, and ordinary Pi session retain their existing unmodified context behavior.
- Run focused Research/subagent tests, both web suites, offline loading, and `git diff --check`.

**Completion notes:**

- Changes: Added a child-only context hook gated by the spawn session-ID marker, child header parentSession, exact parent-owned Research mapping, and mapped child file. It masks only stale successful websearch/webfetch results with deterministic tool/target/status/evidence-reference records, preserves recent 12k-token context without a single-result budget overage, three latest evidence results, canonicalized Markdown/raw citations, errors, incomplete calls, and non-web tools. Stale records now use a minimal tool-result envelope.
- Decisions or deviations: Masking is non-persistent: context events receive Pi's deep copy, so original child evidence entries remain byte-for-byte unchanged. Each context preparation appends evidence-free byte/token telemetry to a non-context child audit entry; final Research details recover those entries after the child exits. Normal Pi compaction remains the sole summarizer.
- Verification results: Focused subagent/Research/masking suites pass (47 tests), including forged-lineage rejection, independent generic-subagent/direct-websearch/direct-webfetch inertness, canonical citation retention, minimal-envelope stripping, persisted telemetry/details recovery, persisted JSONL hashes, and normal-Pi compaction continuation. Web suites pass (89 tests, 2 live tests skipped); offline extension loading and diff checks pass.
- Remaining risks or follow-ups: Shared child work budgets and persisted evidence provenance are intentionally deferred to Tasks 04 and 05.

## [x] 2026-08-13-research-context-isolation-04: Enforce shared child work budgets

**Delivers:** `standard` and `deep` Research have calibrated, mechanically enforced search, fetch, and returned-evidence byte limits across each invocation.

**Blocked by:** `2026-08-13-research-context-isolation-02`

**Context:**

- Budget hooks must activate only in a trusted Research child. Direct parent tools and generic subagents keep their existing limits and behavior.
- Calibrate and export exact standard/deep constants from existing web tool bounds and representative pilots. Deep must allow more work than standard; neither changes the 8 KiB/400-line parent result cap or creates extra agents.
- Pi preflights sibling tool calls sequentially but may execute them concurrently. Count reservations must therefore be race-safe. Returned bytes are known only at `tool_result`: trim delivery to the remaining allowance and block later calls rather than allowing unbounded overrun.

**Acceptance criteria:**

- [ ] Exact standard/deep maximum search calls, fetch calls, and delivered web-result bytes are documented in code/details with a calibration rationale and deterministic tests.
- [ ] A shared per-invocation ledger reserves search/fetch count at `tool_call`, including parallel siblings, and blocks over-limit calls before their underlying transport executes.
- [ ] `tool_result` accounts for actual textual result bytes, bounds the final allowed result to remaining valid UTF-8 bytes with an actionable notice, and blocks subsequent web calls when the byte budget is exhausted.
- [ ] `webResearch: disabled` exposes no web tools or web budget; `required` still preflights both tools; `auto` uses only parent-active capabilities.
- [ ] Resuming a Research ID starts a new invocation budget while retaining cumulative usage telemetry separately. Cancellation and failures release or finalize reservations deterministically.
- [ ] Details and child audit state report configured, reserved, consumed, truncated, blocked, and exhausted values without placing the ledger in parent model context.
- [ ] At, below, and above every standard/deep count and byte boundary, including concurrent calls, behavior is deterministic and blocked calls produce no transport activity.
- [ ] Generic subagent and direct `websearch`/`webfetch` tests show no budget-policy regression.

**Verification:**

- Use fake search/fetch transports and parallel tool-call batches to prove exact pre-execution blocking and byte truncation at UTF-8 boundaries.
- Exercise real standard and deep web calls and inspect effective tools, budget details, child transcript, and compact parent output.
- Exercise cancellation during parallel results and resume with a fresh invocation budget.
- Run focused Research/subagent tests, both complete web suites, offline loading, and repository mutation checks.

**Completion notes:**

- Changes: Added trusted-child-only standard/deep shared ledgers: standard permits 4 searches, 6 fetches, and 100 KiB delivered evidence; deep permits 8, 12, and 250 KiB. Calls reserve atomically before transport, valid UTF-8 result content is limited to the shared remaining allowance with an actionable notice, and later calls are blocked once byte/count limits are exhausted. In-memory children receive a parent-session marker for trusted hook activation. Parent finalization writes a durable zero-active-reservation audit snapshot if cancellation ends the child before `agent_end`. Per-invocation and cumulative evidence-free audit snapshots are persisted in child JSONL and exposed only in Research details.
- Decisions or deviations: The byte allowance reserves the truncation notice while calls are in flight, so concurrent dispatch cannot make a later delivered result overrun the cap. `webResearch: disabled` creates no budget entry or `workBudget` details; `auto` and `required` retain only preflight-approved parent-active tools.
- Verification results: Focused Research/subagent suites pass (51 tests), including standard/deep count and byte boundaries, 3-byte surrogate-safe UTF-8 trimming, parallel pre-transport reservation, persisted and in-memory trusted hook transport blocking, parent cancellation finalization, fresh resumed budgets, cumulative telemetry, disabled details, and direct/generic inertness. Both web suites pass (89 tests, 2 live tests skipped). Offline extension loading and `git diff --check` pass.
- Remaining risks or follow-ups: Task 05 must persist successful-fetch provenance and validate final citation structure.

## [x] 2026-08-13-research-context-isolation-05: Validate Research evidence and tighten routing

**Delivers:** Research cannot present unfetched web sources as inspected evidence, always returns the required compact structure, and is selected instead of direct tools for context-heavy work.

**Blocked by:** `2026-08-13-research-context-isolation-04`

**Context:**

- Build the successful-fetch ledger from actual child tool results and persisted child session evidence, not from the model's claims. Resumed calls may cite a URL fetched successfully in an earlier child turn.
- Mechanical validation covers structure and provenance. Contradiction resolution, primary-source preference, uncertainty, and source-quality judgment remain authoritative in `researcher.md`.
- Keep the parent result bounded even when validation fails. Full diagnostics and provenance remain in details.

**Acceptance criteria:**

- [ ] Successful `webfetch` calls persist canonical requested/final URL, status, retrieval time, and exact protected support excerpts in child non-context audit state; failed/inaccessible fetches are distinguishable.
- [ ] Final output validation requires `## Answer`, `## Findings`, `## Conflicts and limits`, and `## Sources` in order and rejects malformed or missing sections with a bounded actionable failure.
- [ ] Every web URL represented as inspected/cited resolves to a successful current or prior resumed `webfetch`; search-only, failed, inaccessible, or out-of-budget evidence must be labeled limited and cannot be represented as full-source review.
- [ ] Validation catches uncited material web claims within the response contract's supported deterministic scope and records any non-mechanical limits explicitly rather than claiming complete semantic proof.
- [ ] Validation and Research-ID metadata fit inside the existing 8 KiB/400-line cap, preserve an Answer-first head, and keep complete untruncated model output and evidence diagnostics in details.
- [ ] `researcher.md` remains the single workflow source, adds only continuation/parallel-independent-retrieval guidance needed by the runtime, and still uses exactly the pinned model and six read-only tools.
- [ ] Research tool metadata reserves direct web tools for one known URL or one narrow bounded lookup, routes iterative/multi-source/conflicting/source-sensitive work to Research, and tells the parent not to duplicate delegated investigation.
- [ ] No dedicated Oracle behavior, research skill, mutation capability, shell, nested delegation, or default persistent report artifact is introduced.

**Verification:**

- Exercise valid current-turn citations, prior-resumed citations, redirects/final URLs, search excerpts, inaccessible sources, failed fetches, missing sections, malformed Markdown URLs, and unsupported material claims.
- Run a real required-web Research call and independently compare every cited URL with recorded successful fetch evidence.
- Inspect registered tool metadata/system prompt and confirm narrow direct routing, no duplicated parent work, and no Oracle advertisement.
- Run focused Research/subagent tests, both web suites, offline loading, interactive rendering/failure checks, and repository mutation checks.

**Completion notes:**

- Changes: Added trusted-child fetch audit entries with canonical requested/final URLs, 2xx-only successful provenance, status, retrieval time, and bounded exact support excerpts. Research validates ordered required sections, resumed fetch provenance, malformed Markdown URLs, Answer-paragraph and Findings-bullet citations, and confines limited/failed/unfetched URLs to `Conflicts and limits`. Completed failures and oversized validated responses now retain Answer-first headings and their Research ID within the cap; full child output and diagnostics remain in details. Direct web routing and no-duplication guidance remain narrow; researcher guidance covers continuation, independent retrieval, Answer citations, and limited-source placement.
- Decisions or deviations: Validation is deliberately bounded: it mechanically checks headings, successful 2xx provenance, limited-URL placement, and citations for Answer/Findings claim units. It does not prove semantic entailment, source quality, or contradiction resolution. An oversized otherwise-valid response emits a bounded structured notice rather than head-truncating required trailing sections.
- Verification results: Focused Research/subagent/masking suites pass (53 tests). Both web suites pass (89 tests; 2 optional live tests skipped). Offline extension loading and `git diff --check` pass.
- Remaining risks or follow-ups: A configured authenticated real required-web Research smoke call remains evaluation work in Task 06.

## [ ] 2026-08-13-research-context-isolation-06: Run the context-first v2 evaluation

**Delivers:** A frozen, reproducible evaluation showing whether Research solves main-agent context bloat and preserves downstream parent quality, with its full efficiency premium reported separately.

**Blocked by:** `2026-08-13-research-context-isolation-03`, `2026-08-13-research-context-isolation-05`

**Context:**

- Create tracked `EVALUATION.md` before scored execution and commit it separately so exact prompts, packets, limits, ordering, scoring, and invalidation rules are demonstrably precommitted.
- Replace v1's trivial `example.com` packets and matched-total-compute rejection rule. Equal starting parent sessions, evidence capabilities, answer contract, and source/task packets remain required, but higher child compute does not by itself invalidate an isolation result.
- Primary outcomes are raw-evidence absence from the parent provider payload, exact parent growth, and correctness of a downstream parent decision. Answer/citation quality and the total token/cache/cost/call/latency premium remain mandatory.

**Acceptance criteria:**

- [ ] The frozen design contains exact direct/isolated prompts and packets, fixed model/effort, source and retrieval dates, tools, output cap, work budgets, case order, retries, invalidation rules, scoring rubric, and success thresholds.
- [ ] Cases cover at least 100 KiB of local/web synthesis evidence, conflicting primary sources, retrieved prompt injection, genuinely insufficient evidence, resumed continuation, and a downstream parent task that depends on the research.
- [ ] Direct and isolated arms start from equivalent fresh parent sessions. Any source/work-budget violation remains visible and invalidates the affected cell without silent retry.
- [ ] Captured `context` and provider payloads record exact parent-visible bytes and tokens. Every isolated cell proves zero raw unique-marker leakage and parent growth bounded by Research content plus fixed envelope overhead.
- [ ] Every cell records parent, child, and total requests/input/output/cache/cost, tool calls, elapsed time, child compaction/masking/budget events, and complete lossless final outputs/details.
- [ ] Outputs are scored for known-answer correctness, source quality, citation support/validity, unsupported material claims, appropriate insufficiency, instruction following, and answer/findings consistency; cited sources receive independent full-source audit.
- [ ] A matched downstream parent task is scored after each research arm to measure the practical benefit of preserved parent context.
- [ ] The report distinguishes observed evidence from judgment, reports losses and regressions, and describes cost/latency as an isolation premium rather than claiming tokens were eliminated.
- [ ] Any isolation, masking, budget, or validation defect found gets focused regression coverage and all affected cells are rerun under the same frozen design or a clearly versioned replacement.
- [ ] The task is checked only if the parent isolation gate and downstream-quality threshold pass. Efficiency may remain an explicit optimization target without invalidating successful isolation.

**Verification:**

- Retain exact tracked design/results and lossless ignored raw traces sufficient to reproduce every measurement and score.
- Independently inspect captured parent payloads, child JSONL, citation URLs, budget ledgers, and downstream answers.
- Run final focused Research/subagent/web suites, offline loading, authenticated local/web/resume/cancellation checks, interactive UI checks, normal child export/deletion, repository status, and `git diff --check`.

**Completion notes:**

- Changes: Committed `EVALUATION.md` is the frozen v2 design. Pending tracked `EVALUATION-v3.md` replaces only v2's impossible revision rule and requires repository-owned ignored raw artifacts; pending `EVALUATION-RESULTS.md` records a preflight-only stop. No scored cell or raw audit artifact exists.
- Decisions or deviations: Task 06 remains unchecked. v3 separates the implementation baseline from the later standalone design-seal and execution revisions. The observed Pi catalog does not resolve the pinned model, so no cell was launched. Authentication readiness is not treated as model resolution.
- Verification results: `pi --version` returned `0.84.1`; offline exact-model lookup returned no match; no-refresh authentication check reported ready. Git history confirmed that v2 was committed after its implementation baseline and that no implementation files changed between them. No evaluation suite or cell was run.
- Remaining risks or follow-ups: Commit the v3 design and repository ignore rule as its required standalone seal, create a fresh tracked preflight result at the sealed execution revision, and proceed only if the exact model resolves and every v3 preflight passes. Retain every future attempt and publish measured results only after all v3 gates are evaluated.

## [ ] 2026-08-13-research-context-isolation-07: Optimize the measured isolation premium

**Delivers:** Measured efficiency improvements for isolated Research without weakening the proven parent boundary, evidence quality, or read-only safety.

**Blocked by:** `2026-08-13-research-context-isolation-06`

**Context:**

- Optimize one variable at a time against the accepted v2 baseline. Candidates are stable resumed-session prompt-cache affinity, concurrent independent retrieval, fewer child model turns, and a cheaper standard model/reasoning configuration.
- Persistent child session identity should naturally improve cache affinity; verify actual `cacheRead`/`cacheWrite` rather than assuming it.
- Keep Sol/high if a cheaper standard route is not non-inferior. Rejecting an optimization with retained evidence is a valid result; changing the benchmark until it wins is not.

**Acceptance criteria:**

- [ ] Baseline and each candidate use the same accepted isolation cases, source/work budgets, answer cap, scoring, and parent-boundary assertions; only the declared variable changes.
- [ ] Resumed child calls demonstrate and report stable prompt-cache identity plus actual cache-read/write behavior across process restarts, or document a provider/runtime limitation without making unsupported savings claims.
- [ ] Independent searches/fetches may execute concurrently when permitted by the shared budget, while dependent discovery-to-fetch steps remain ordered and cancellation/failure behavior stays deterministic.
- [ ] Child-turn and handoff changes reduce redundant model requests or are rejected if they harm adaptive research, citations, or required response structure.
- [ ] Any cheaper standard model/reasoning route is adopted only if answer and citation quality are non-inferior under the frozen rubric; otherwise the exact Sol/high pin remains.
- [ ] At least one adopted configuration improves a measured cost, token, or latency dimension without worsening the parent isolation gate or quality thresholds, or the report demonstrates that all scoped candidates were safely rejected and preserves the accepted baseline.
- [ ] Updated details/UI continue to report exact model, reasoning, cache, child/total usage, masking, budgets, and lineage. Direct web and generic subagent behavior do not regress.
- [ ] Final documentation states the routing threshold, measured isolation benefit, remaining premium, and conditions under which direct narrow tools are still preferable.

**Verification:**

- Run paired repetitions of each candidate and baseline, retain raw usage and timing, and compare success-adjusted cost plus quality rather than output length alone.
- Rerun the >100 KiB provider-boundary marker test and downstream parent task after every adopted optimization.
- Exercise fresh/resumed local and web Research, concurrent retrieval, cancellation, compaction, budget exhaustion, citation validation, normal export/deletion, and process restart.
- Run all focused Research/subagent/web tests, offline extension loading, interactive rendering, repository mutation checks, and `git diff --check`.

**Completion notes:**

- Changes: Not implemented; no accepted v2 baseline exists.
- Decisions or deviations: Remains blocked by incomplete Task 06.
- Verification results: Not run; no candidate can be measured against an accepted isolation and quality baseline.
- Remaining risks or follow-ups: Run the frozen v2 evaluation first, then measure one optimization variable at a time without weakening the boundary.
