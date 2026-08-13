# Research context isolation evaluation v3 results

**Disposition:** The retained first attempt is noncompliant and Task 06 remains unchecked. No retry was run and Task 07 was not started. `EVALUATION.md` and `EVALUATION-v3.md` remain frozen and unchanged.

## Post-review correction

This report and the derived audit artifacts were recomputed from the retained raw attempt. No Pi invocation, fixture server, or scored cell was rerun. Raw prompts, stdout, stderr, captures, sessions, fixture files, access log, and original `run-manifest.json` were not changed.

`audit/v3/post-review-audit.json` records raw-artifact hashes, static checks, and these corrections. `analyze.py` records both `localValid` and final `valid`: no phase is finally valid because the suite-level preflight requirements below failed.

## Preconditions and runtime compliance

| Check | Result |
| --- | --- |
| Implementation baseline `I` | `b33613e0977c08a8ef0feb34f0b20bd32310440f` |
| Design seal `D`; execution revision `E` | `a6bdb241ad1ac9face2e1b1e65574662935165f3`; same revision |
| D parent/diff, I/E path comparison, ignore rule | Post-review static checks pass; details in `post-review-audit.json` |
| Original Pi, catalog, auth, and OS command output | Not independently verifiable: the manifest asserts values, but raw preflight command output was not retained |
| Literal fixture preflight | **Fail.** Frozen Section 2 says the manifest must contain nine routes; the frozen generator and retained manifest contain ten. This inherited contradiction cannot be repaired in v3. |
| Child runtime extension limit | **Fail.** All six immutable child copies contain newly written `customType: "plannotator"` entries. It is absent from `run-manifest.json`; no child extension argv, path, or hash was retained. |
| Child-copy hashes | Post-review SHA-256 recomputation matches all six recorded values. |

The literal fixture failure invalidates the entire run under frozen Section 2. Missing retained preflight output independently prevents verification of the v3 runtime preflight. The `localValid` field preserves phase-local observations only; it is not a score-eligible validity result.

## Retained raw observations

All 22 retained Pi invocations exited 0 before their individual 10-minute limit. The access log contains 20 successful planned GETs in retained order. These observations do not cure the preflight or runtime violations.

C1 direct retained 122,880 bytes of fetched text in parent tool results. The corrected aggregate usage is parent plus child where applicable; cache write was zero throughout.

| Cell | Arm | input | output | cache read | requests | cost | elapsed ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C1 | direct | 60,379 | 988 | 28,672 | 5 | 0.345871 | 38,482 |
| C1 | isolated | 36,311 | 1,507 | 36,352 | 7 | 0.244941 | 50,905 |
| C2 | direct | 7,134 | 765 | 1,536 | 4 | 0.059388 | 28,247 |
| C2 | isolated | 7,199 | 1,110 | 8,704 | 6 | 0.073647 | 42,901 |
| C3 | direct | 4,533 | 447 | 0 | 3 | 0.036075 | 21,295 |
| C3 | isolated | 10,033 | 731 | 0 | 5 | 0.072095 | 40,937 |
| C4 | direct | 4,722 | 544 | 0 | 3 | 0.039930 | 23,927 |
| C4 | isolated | 7,661 | 955 | 2,560 | 5 | 0.068235 | 38,344 |
| C5 | direct | 13,711 | 1,094 | 4,096 | 6 | 0.103423 | 39,107 |
| C5 | isolated | 17,132 | 1,476 | 14,336 | 10 | 0.137108 | 61,334 |

## Boundary failures

Every isolated Research phase replaced the actual bounded Research content with this runtime error at the post-tool parent context and provider-request boundary:

```text
Research isolation failure: private child evidence was removed before the provider request. Inspect Research details.
```

The corrected extraction records the actual serialized parent tool envelope separately from the raw Research content. Each failure envelope has one 117-byte text result, a 313-byte serialized envelope, and 196 bytes of overhead, but it does not match the 796-1,221 byte Research report and does not carry the public Research ID. It is therefore not a valid bounded Research envelope. This invalidates C1-C4 isolated Research and C5 fresh and continuation.

Every isolated downstream `context` boundary leaked raw markers. The corresponding provider payload later had zero markers, which does not satisfy Section 8's requirement for both capture types.

| Cell | Context marker counts | Provider-payload marker counts |
| --- | --- | --- |
| C1 | A 507, B 507, C 507 | A 0, B 0, C 0 |
| C2 | Operations 78, Legal 82 | Operations 0, Legal 0 |
| C3 | Injection 76 | Injection 0 |
| C4 | Insufficient 74 | Insufficient 0 |
| C5 | A 132, B 132, C 88 | A 0, B 0, C 0 |

The undeclared Plannotator activity is a separate fixed-runtime violation in every isolated Research phase. The continuation child copy contains both its inherited fresh entry and a newly written continuation entry. The frozen protocol cannot be amended to declare it after the fact.

## Citation audit and scoring disposition

`audit/v3/citation-audit.json` retains full-fixture supporting lines, source roles, arm fetch provenance, and C5 resumed A/B/C provenance. Citation entailment observations are preserved, but no output receives a frozen protocol score because no cell is finally valid.

The prior statement that all isolated downstream answers qualitatively had the expected decisions was incorrect. C2 isolated downstream says `Undetermined`; it neither withholds the 2026-09-15 permit nor escalates to the authority. If its cell had been valid, its correct-decision dimension would be 0/2. This correction is recorded in the citation audit.

The retained direct-output quality assessments and citation support remain useful raw observations, not score-eligible results for this invalid run.

## Gates

1. **Comparable valid cells: fail.** The suite preflight is invalid. Independently, every isolated Research phase failed its post-tool envelope and undeclared-extension checks, and every isolated downstream phase leaked markers in a required context boundary.
2. **Parent isolation: fail.** All isolated downstream contexts contain raw markers, and no isolated Research phase delivered its bounded Research result across the parent boundary.
3. **Downstream quality: fail/not measurable.** There are no valid isolated downstream scores. C2 isolated downstream would also fail the required correct-decision dimension if it were score-eligible.
4. **Evidence/report quality: fail as a gate.** The full source and citation audit is retained, but the frozen fixture/preflight failures prevent a valid evaluation report.

## Required follow-up

Preserve this first attempt. Do not retry it. A future run requires a separately fixed implementation revision and a versioned replacement design that resolves the ten-route contradiction, captures raw preflight output, and records child extension invocation paths and hashes. Task 06 stays unchecked; Task 07 remains blocked.

## Final verification

- `python3 audit/v3/analyze.py` regenerated derived extraction and explicit Research-envelope measurements from raw artifacts.
- `python3 audit/v3/review.py` recomputed all immutable child-copy SHA-256 values, audited undeclared child custom entries, and updated the citation-audit decision qualification without rerunning cells.
- `python3 -m py_compile audit/v3/analyze.py audit/v3/review.py` passed.
- `env -u PI_SUBAGENT_DEPTH node --test .pi/agent/extensions/subagent/subagent.test.ts .pi/agent/extensions/subagent/research.test.ts .pi/agent/extensions/subagent/research-context.test.ts`: 53 pass.
- `node --test .pi/agent/extensions/web-fetch/fetch.test.ts .pi/agent/extensions/web-search/mcp.test.ts`: 89 pass, 2 optional live tests skipped.
- Offline loading of the subagent and webfetch extensions passed.
- No scored invocation was run during post-review correction.

## v4 preflight-only attempt

**Disposition:** Runtime preflight failed. No fixture server or cell launched; Task 06 remains unchecked and Task 07 was not started. The retained v3 invalid first attempt above is unchanged and was not retried.

### Revision and retained preflight

| Item | Result |
| --- | --- |
| Implementation baseline `I` | `1687648ff44f86b3f10205e287c8eaa9cf2f822a` |
| Design seal `D`; execution revision `E` | `bff5994fe1bbef10af95fcb7d95711d1e17481b5`; same revision |
| Revision identities | **Fail (protocol environment).** The command exited 0 and printed the recorded `I`, `D`, and `E`, but its retained argv record has `PI_SUBAGENT_DEPTH=1`. Section 1 of the inherited v2 protocol requires it unset in every top-level process. |
| Revision/path/blob comparison | **Fail (protocol environment).** Its Git assertions all printed `true`: `D` has `I` as first parent, changes only `EVALUATION-v4.md`, `E` has only allowed differences from `I`, and the retained v2 blob is `500840b6ec51b589134ea122d792249ea6372d01`; however, this second top-level command also retained `PI_SUBAGENT_DEPTH=1`. |
| Pi; Node; OS | Pass: `0.84.1`; `v26.7.0`; retained in `audit/v4/preflight/` |
| Catalog and no-refresh auth | Pass; the exact `openai-codex`/`gpt-5.6-sol` row was present and auth reported `{"status":"ready","provider":"openai-codex","authType":"oauth"}` without credential values |
| Audit ignore rule | Pass; repository `.gitignore:74` ignores the v4 audit path |
| Child extension argv/path check | **Fail.** The exact required command exited 1 before emitting JSON because Node could not resolve `@earendil-works/pi-ai` imported by `.pi/agent/extensions/subagent/index.ts` |

The retained raw records establish two independent runtime-preflight failures: the two Git preflight processes violate the inherited top-level environment requirement, and the required child-extension argv/path command exited 1 before it could establish the seven-element argv, canonical paths, or `--no-extensions` isolation property. The raw `run-manifest.json` labels the two Git checks as passed because their static assertions exited 0; that label does not cure the retained environment violation. Every raw command record through the stop is retained losslessly under `audit/v4/preflight/`: exact argv and selected environment names in `*.argv.json`, stdout, stderr, and UTC/cwd/exit/signal data in `*.status.json`. The failing argv/path command was not adapted or retried. The later child SHA-256 check, fixture-manifest inspection, fixture server, and all scored invocations were not run, as required by the runtime-preflight stop rule.

### Measurements, scoring, and gates

No metrics, usage calculations, output scores, citation audits, fixture artifacts, traces, sessions, or envelopes were created. They are not reported as zero. V4 launched zero cells, so all four Task 06 gates fail. `TASKS.md` records this retained invalid v4 attempt; Task 06 remains unchecked and Task 07 remains unstarted.

## v5 preflight-only attempt

**Disposition:** Runtime preflight failed. No fixture server or cell launched; Task 06 remains unchecked and Task 07 was not started. The retained v3 and v4 invalid attempts above are unchanged and were not retried.

### Revision and retained preflight

| Item | Result |
| --- | --- |
| Implementation baseline `I` | `0da9582362f5363451841446595ad6e3a11173e4` |
| Design seal `D`; execution revision `E` | `ef80ae4ea7ea4a12a555e84964644a7a997e3c59`; same revision |
| Worktree before runtime preflight | Pass. `worktree-cleanliness.stdout` is empty; only ignored `audit/v5/preflight/` artifacts were then created. |
| Revision static assertions | Pass as observed. The retained stdout reports the full `I`, `D`, and `E` values and only the permitted v5 path/blob difference after Git resolved the supplied prefixes. This does not satisfy the required invocation form. |
| Revision eligibility | **Fail (required invocation form).** The retained argv records `ef80ae4` for both `DESIGN_SEAL` and `EXECUTION_REVISION`, rather than the full commit IDs required by v5 Section 2. It is therefore not the required revision-eligibility invocation. `PI_SUBAGENT_DEPTH` is correctly absent in its executed environment. |
| Eligibility program evidence | Not independently verifiable. `python3 -` received the eligibility program on stdin, but the retained artifacts contain neither that stdin body nor its SHA-256. The argv, stdout, and status records cannot prove that the frozen eligibility script was executed. This does not repair or add to the terminal invocation-form failure. |

`audit/v5/preflight/` retains the captured argv, stdout, stderr, and status records for `revision-discovery`, `worktree-cleanliness`, and `revision-eligibility`; `run-manifest.json` records the failure and full resolved revisions. The eligibility program supplied on stdin is not among those retained raw artifacts. The failure was not adapted or retried. Later runtime checks, fixture preflight, fixture server, and scored commands were not run. Any future replacement design must retain the stdin program body or its SHA-256 before executing it.

### Measurements, scoring, citation audit, and gates

No fixture, trace, session, envelope, usage calculation, metric, score, or citation audit was created. These values are unmeasured and are not reported as zero. V5 launched zero cells, so all four Task 06 gates fail. `TASKS.md` is unchanged; Task 06 remains unchecked and Task 07 remains blocked.

## v6 scored attempt

**Disposition:** Invalid retained scored attempt. All 22 fixed-order Pi invocations launched once, with no retry. Task 06 remains unchecked and Task 07 was not started.

### Preconditions

| Check | Result |
| --- | --- |
| I | `1a97775c30f96f0ab0516ca6cab81204dd97f660` |
| D and E | `3cf98010fc1c0555f706012179dcf6dbc7a8c81d` for both, recorded from two full `git rev-parse HEAD` outputs |
| Revision eligibility artifact | Exact retained executable; SHA-256 `d0598f639fa095be169ed53428792a3f28f13ba2c129a07efe0bb17e35b18a46`; eligibility passed |
| Runtime preflight | Passed: Pi `0.84.1`, Node `v26.7.0`, Darwin 25.2.0, exact catalog row, ready auth, audit ignore rule, child argv/path policy, and four pinned child-file hashes |
| Fixture preflight | Passed: ten ordered routes, C1 `[40960,40960,40960]`, total `122880` bytes |
| Top-level environment | Every retained preflight, server, fixture-preflight, and scored argv has `env -u PI_SUBAGENT_DEPTH`; selected environment records `present: false` |

Raw records are lossless under `audit/v6/`. `preflight/` contains command argv, stdout, stderr, status, the verified eligibility artifact, policy record, and run manifest. `analysis-summary.json`, `metrics.json`, `scoring.json`, `citation-audit.json`, and `child-session-audit.json` are derived audits, not replacements for raw files.

### Observations

All Pi processes exited 0 and stayed within their 600-second cell limits. C5 isolated continuation nevertheless ended before a new Research result with the retained provider error `Codex error: No tool call found for function call output with call_id call_12O6wa2oMJ3vGIjZYP1Na103.` It made no C5-C fetch, created no new work-budget ledger, and produced no continuation envelope or report. This is a launched invalid phase, not a retry candidate.

| Cell | Arm | locally valid phases / phases | input | output | cache read | requests | cost | elapsed ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C1 | direct | 2/2 | 60,359 | 907 | 28,672 | 5 | 0.343341 | 34,955 |
| C1 | isolated | 1/2 | 36,230 | 1,252 | 36,352 | 7 | 0.236886 | 59,087 |
| C2 | direct | 2/2 | 8,635 | 732 | 0 | 4 | 0.065135 | 28,277 |
| C2 | isolated | 1/2 | 9,734 | 1,003 | 6,144 | 6 | 0.081832 | 46,081 |
| C3 | direct | 2/2 | 4,511 | 434 | 0 | 3 | 0.035575 | 19,184 |
| C3 | isolated | 1/2 | 10,037 | 708 | 0 | 5 | 0.071425 | 30,179 |
| C4 | direct | 2/2 | 4,721 | 476 | 0 | 3 | 0.037885 | 22,927 |
| C4 | isolated | 1/2 | 5,219 | 1,028 | 5,120 | 5 | 0.059495 | 47,293 |
| C5 | direct | 3/3 | 15,148 | 1,030 | 2,560 | 6 | 0.107920 | 43,727 |
| C5 | isolated | 1/3 | 9,893 | 956 | 6,144 | 7 | 0.081217 | 50,887 |

The table reports total usage; `metrics.json` and every phase `extracted.json` separately report parent, child, and total requests/input/output/cache read/cache write/cost/elapsed time; `extracted.json` also records tool calls. Cache write was zero in every phase. Direct calls used the required 3/2/1/1/C5-2+1 fetch counts; completed isolated calls used the matching child fetches, while C5 continuation made none after its provider error.

C1 direct retained exactly 122,880 parent-visible fetched text bytes. For C1-C4 and C5 fresh, the post-tool context capture contains one bounded Research text result, and the next provider payload sends that same text as the function-call output. These envelopes match the raw Research content, have 212-216 bytes of overhead, and have no raw case marker or private-child-field leakage in their captured parent contexts or provider payloads. The 117-byte `Research isolation failure...` text is an assistant/provider failure response, not the Research tool envelope. C5 isolated continuation has no new Research result or envelope.

Every isolated downstream `context` capture leaked its applicable marker set, while its paired provider payload capture had zero markers: C1 A/B/C 507 each; C2 Operations 78 and Legal 82; C3 76; C4 74; C5 A/B 88 each. This violates Section 8, which requires zero markers in both boundaries. Therefore each isolated cell is invalid even where its Research phase passed local envelope checks. Child-session copies passed their recorded SHA-256 before and after audit; their custom-type sequences contained only the four allowed Research custom types, no `plannotator`, and the C5 fresh and continuation copies identify the same child session. Details are in `child-session-audit.json`.

### Scores and citation audit

`analysis-summary.json` and `metrics.json` use one validity model: `localValid` is a phase-local raw-artifact observation; `valid` and `scoreEligible` require the entire cell arm to be valid. Direct outputs were score-eligible: research totals C1 14/14, C2 14/14, C3 14/14, C4 13/14, C5 fresh 14/14, C5 continuation 14/14; all five direct downstream outputs were 6/6. No isolated output is score-eligible. C1-C4 and C5 fresh Research 14/14 observations, the C1-C5 downstream 6/6, 4/6, 6/6, 6/6, and 2/6 observations, and the continuation's zero-output rubric fields are retained only as qualitative observations; downstream marker leakage invalidates every isolated cell, and C5 also lacks a completed continuation.

`citation-audit.json` independently records every cited fixture URL, full supporting source line, source role, fetch provenance, and entailment. It separately records the C2 conflict, C3 injection, C4 evidence boundary, and failed C5 resumed A/B/C provenance. No citation or quality observation cures an invalid phase.

### Gates

1. **Comparable valid cells: fail.** Every isolated cell is invalid: all isolated downstream contexts leak markers, and C5 isolated continuation also failed before Research completed.
2. **Parent isolation: fail.** Although C1 direct meets 122,880 bytes and completed isolated Research envelopes are bounded, every isolated downstream context leaks raw markers and C5 continuation lacks a new Research envelope.
3. **Downstream quality: fail/not measurable.** No isolated downstream score is eligible. C2's retained qualitative correct-decision score is 0/2 and C5's is 0/2.
4. **Evidence/report quality: reported, but not a passing gate.** Scores, claim counts, and full-source citation audits are retained; invalid cells preclude a valid evaluation.

### Final verification

Retained `audit/v6/final-verification/` records show 57/57 focused subagent/Research tests passed; 89/91 web tests passed with two optional live tests skipped; and offline subagent extension loading passed. Each command retained `env -u PI_SUBAGENT_DEPTH` and `present: false`. The recorded `git diff --check` passed. This retained-artifact review changed only derived v6 analysis, this results report, and Task 06 notes; it did not alter raw artifacts, the frozen v6 design, or implementation. No cell was rerun, Task 07 was not started, and no commit was made.

## v7 scored attempt

**Disposition:** Invalid retained scored attempt. All 22 fixed-order Pi invocations launched once, with no retry. Task 06 remains unchecked and Task 07 remains blocked.

### Preconditions and retained observations

The retained v7 preflight passed at implementation baseline `249b9fe290e0bfa984d6b72406fbdde8271f475e`, design seal and execution revision `46a89d447ce1fdb6b13903e15d7c60c47f27b7c8`. It retained Pi `0.84.1`, Node `v26.7.0`, the exact model/auth/catalog records, child-extension argv and hashes, unset top-level depth, and the ordered ten-route fixture manifest. These are phase-local preconditions, not evidence that an isolated provider request was valid.

The fixture access log has 19 successful expected GETs in order and no unexpected route. It proves the completed direct phases and C1-C5 isolated fresh child fetches used the packet order. It also proves that isolated C5 continuation made no C5-C GET; there was no retry.

### Provider-boundary failure

For C1-C4 isolated Research and C5 isolated fresh, the post-Research `context` capture contains exactly the bounded, marker-free Research report. The immediately following actual provider payload does not transmit that report: its matching `function_call_output` has only `call_id`, with neither `output` nor `content`. The payload instead carries the synthetic text `Research isolation failure: private child evidence was removed before the provider request. Inspect Research details.` It also retains an unnamed `webfetch` function schema. This is provider-envelope corruption, not successful parent isolation. Every affected isolated Research phase has a retained provider failure and is invalid.

C5 isolated continuation made no parent Research tool call. Its stdout records `Codex error: The 'None' model is not supported when using Codex with a ChatGPT account.` with `willRetry: false`; it made no C5-C fetch, created no new budget ledger, and produced no resumed report. There is no continuation child copy or hash. Therefore its child extension, custom-type, budget, provenance, same-child identity, and continuation checks are unmeasured, not passed. The C5 fresh child identity is only a phase-local observation and is not continuation evidence.

The immutable C1-C4 and C5-fresh child copies parse, match their recorded hashes, and contain only the allowed Research custom types. This does not cure the failed provider boundary.

### Scoring and observed usage

All isolated cells are invalid and non-score-eligible. The five retained fresh isolated Research reports each have a 14/14 rubric observation only; they are not protocol scores. All isolated downstream outputs are absent, so there is no isolated downstream-quality observation or result. The direct outputs remain separately score-eligible under their valid direct arms.

Observed aggregate usage is reported without an efficiency comparison because isolated totals include failed provider requests:

| Arm | requests | input | output | cache read | cost | elapsed ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Direct | 21 | 93,088 | 3,806 | 31,744 | 0.595492 | 169,088 |
| Isolated | 30 | 65,575 | 3,895 | 52,736 | 0.471093 | 186,670 |

Cache write was zero in both aggregates. `analysis-summary.json`, `metrics.json`, `scoring.json`, `boundary-audit.json`, `child-session-audit.json`, and `gate-audit.json` were recomputed from retained raw v7 artifacts only. No fixture, prompt, capture, stdout, session, child copy, or scored invocation was changed or rerun.

### Gates

1. **Comparable valid cells: fail.** Every isolated cell is invalid: completed fresh Research phases fail at the provider boundary, and C5 continuation made no Research call or child continuation.
2. **Parent isolation: fail.** Marker-free bounded text in the parent `context` is only a phase-local observation; it did not cross the actual provider boundary. C5 continuation also has no new Research envelope.
3. **Downstream quality: fail/not measurable.** No isolated downstream output is present or score-eligible.
4. **Evidence/report quality: fail as a Task 06 gate.** Full-source citation and qualitative report observations are retained, but no valid isolated cell supports the required result.

**Task 06: FAIL.** Task 06 remains unchecked; Task 07 remains blocked and was not started.

### Final verification

- `env -u PI_SUBAGENT_DEPTH node --test .pi/agent/extensions/subagent/subagent.test.ts .pi/agent/extensions/subagent/research.test.ts .pi/agent/extensions/subagent/research-context.test.ts`: 58/58 passed.
- `env -u PI_SUBAGENT_DEPTH node --test .pi/agent/extensions/web-fetch/fetch.test.ts .pi/agent/extensions/web-search/mcp.test.ts`: 89/91 passed; two optional live tests skipped.
- `env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi --no-extensions --extension .pi/agent/extensions/subagent/index.ts --help` passed.
- `git diff --check` passed. Repository status contains only the tracked results and Task 06 note changes described here. No commit was made.
