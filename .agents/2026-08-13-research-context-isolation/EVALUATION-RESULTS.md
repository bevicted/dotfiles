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
