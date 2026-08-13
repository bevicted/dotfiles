# Research context isolation evaluation v3

**Status:** replacement design, not sealed or executed.
**Supersedes:** v2 execution eligibility only. The v2 source is the committed blob `500840b6ec51b589134ea122d792249ea6372d01` at `3b018aa608dbf8bf437b3956decfbfd5b1da8db5`.
**Frozen implementation baseline:** `b33613e0977c08a8ef0feb34f0b20bd32310440f`.

This replacement resolves v2's impossible requirement that the checkout be both the implementation baseline and the later commit that first introduced v2. It does not modify v2 or weaken its prompts, limits, evidence checks, invalidation, scoring, or gates.

## 1. Inherited protocol and versioned audit path

The complete v3 protocol is the exact v2 source blob above, with every literal `audit/v2` path replaced by `audit/v3`, plus the precedence rules in this file. No other inherited text changes. If this file conflicts with v2 on revision eligibility, ignored-artifact setup, or preflight, this file controls. All other v2 requirements remain literal and mandatory.

The raw artifact directory is `.agents/2026-08-13-research-context-isolation/audit/v3/`. It is ignored by the repository rule added with this design. It is created only after the sealing and runtime preflights pass. Raw artifacts remain lossless and unredacted as v2 requires.

## 2. Satisfiable revision rule

Let `I` be the frozen implementation baseline above, `D` the design-seal commit, and `E` the execution revision.

1. `D` must have `3b018aa608dbf8bf437b3956decfbfd5b1da8db5` as its first parent. Its diff from that parent must contain exactly `.gitignore` and this file. It must contain the unchanged committed v2 blob named above. This is the required standalone design-seal commit; it must exist before any scored invocation.
2. `E` must descend from `D`. Between `D` and `E`, only `EVALUATION-RESULTS.md` may change before cells launch. This permits a tracked preflight-only result without changing implementation or design.
3. At `E`, every tracked implementation path must have the same blob as `I`. The only allowed paths that differ between `I` and `E` are `.gitignore`, `EVALUATION.md`, `EVALUATION-v3.md`, and `EVALUATION-RESULTS.md`. Verify this mechanically with a path comparison, not by trusting commit messages.
4. Run all v2 commands from the repository root at `E`, with a clean worktree except ignored `audit/v3/` artifacts created by the run. Record `I`, `D`, and `E` in `run-manifest.json` and in the results report.

A mismatch is a preflight failure. Do not amend the baseline, substitute a checkout, or score any cell. A later implementation change requires a new versioned design and a new baseline; it cannot be folded into v3.

## 3. Added runtime preflight

Before starting the fixture server or creating `audit/v3/`, retain a preflight-only result with:

1. `git rev-parse I D E`, the path-comparison result in Section 2, and the v2 blob ID.
2. `pi --version`, `node --version`, and OS identifier.
3. `PI_OFFLINE=1 pi --list-models 'openai-codex'` output and exit status. The output must contain one row whose provider is exactly `openai-codex` and whose model is exactly `gpt-5.6-sol`. Pi's catalog lists model IDs without reasoning suffixes, so `:high` must not be included in this fuzzy-search argument. An absent exact row fails preflight even if authentication is ready.
4. `PI_OFFLINE=1 pi auth check --model openai-codex/gpt-5.6-sol:high --json --no-refresh` output and exit status, without credentials. It must report ready. Every scored command must retain the inherited exact `--model openai-codex/gpt-5.6-sol:high` argument; the resulting session metadata and provider request must identify `gpt-5.6-sol` with reasoning level `high`.
5. `git -c core.excludesFile=/dev/null check-ignore -v --no-index .agents/2026-08-13-research-context-isolation/audit/v3/probe`, which must identify the repository `.gitignore` rule. This disables any user-global excludes file for this reproducibility check.

A preflight-only result is not an evaluation run: it launches zero cells, creates no fixture, trace, session, envelope, score, citation audit, or usage calculation, and cannot pass any Task 06 gate. Retain it rather than describing unmeasured values as zero.

## 4. Attempts and reruns

No v2 or v3 cell has launched before this replacement. Therefore there is no original cell attempt to retain or rerun. Once execution begins, v2 Section 8 applies unchanged: retain every first attempt, score no retry, and rerun every affected direct/isolated pair only after recording a separately fixed implementation revision and using a versioned replacement design.

## 5. Current disposition

This file is intentionally unsealed until committed under Section 2. The accompanying preflight result records the observed catalog failure and explicitly records that no cells were launched. Task 06 remains unchecked and fails its gates unless a future fully valid v3 run supplies all required raw artifacts and measurements.
