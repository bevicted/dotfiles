# Research context isolation evaluation v4

**Status:** replacement design, not sealed or executed.
**Supersedes:** v3 execution eligibility. The inherited v2 source is committed blob `500840b6ec51b589134ea122d792249ea6372d01` at `3b018aa608dbf8bf437b3956decfbfd5b1da8db5`.
**Frozen implementation baseline:** `1687648ff44f86b3f10205e287c8eaa9cf2f822a`.

This replacement retains v3's v2 protocol and resolves only the retained v3 attempt's fixture-count, preflight-retention, and child-extension-isolation defects. It does not alter the cases, packets, prompts, caps, budgets, command order, no-retry rule, scoring, or strict context/provider leakage gates.

## 1. Inherited protocol and versioned audit path

The complete v4 protocol is the exact v2 source blob above, with every literal `audit/v2` path replaced by `audit/v4`, plus the precedence rules in this file. No other inherited text changes. If this file conflicts with v2 or v3, this file controls only on revision eligibility, audit-directory creation, fixture route count, preflight retention, or child-extension isolation. All other v2 requirements remain literal and mandatory.

The raw artifact directory is `.agents/2026-08-13-research-context-isolation/audit/v4/`, ignored by the existing repository `.gitignore` rule. Create its empty `preflight/` directory before the first preflight command only to retain lossless preflight records. Do not create a fixture, trace, session, envelope, score, citation audit, or usage calculation until the runtime preflight passes. Create the rest of `audit/v4/` only when proceeding to the fixture preflight and cells. Raw artifacts remain lossless and unredacted as v2 requires.

## 2. Implementation baseline, design seal, and execution revision

Let `I` be the frozen implementation baseline above, `D` the design-seal commit, and `E` the execution revision.

1. `D` must have `I` as its first parent. Its diff from `I` must contain exactly `.agents/2026-08-13-research-context-isolation/EVALUATION-v4.md`. It must retain the unchanged committed v2 blob named above. This standalone design-seal commit must exist before any scored invocation.
2. `E` must descend from `D`. Between `D` and `E`, only `.agents/2026-08-13-research-context-isolation/EVALUATION-RESULTS.md` may change before cells launch. This permits a tracked preflight-only result without changing the design or implementation.
3. At `E`, every tracked implementation path must have the same blob as `I`. The only tracked paths permitted to differ from `I` are `EVALUATION-v4.md` and `EVALUATION-RESULTS.md` in this task directory. Verify this mechanically with a path/blob comparison, not commit messages.
4. Run all v2 commands from the repository root at `E`, with a clean worktree except ignored `audit/v4/` artifacts created by this procedure. Record `I`, `D`, and `E` in `run-manifest.json` and the results report.

A mismatch is a preflight failure. Do not amend a baseline, substitute a checkout, or score a cell. The retained v3 attempt remains an invalid first attempt under its own design; it is not a v4 cell and cannot be retried. V4 begins with zero launched cells. Once a v4 cell launches, retain and score no retry exactly as v2 requires. Any later implementation change requires another separately fixed implementation revision and a new versioned replacement design with a new baseline and seal; it cannot be folded into v4.

## 3. Retained runtime preflight

For every command below, retain its exact expanded argv and selected environment-key names in `audit/v4/preflight/<name>.argv.json`, unmodified stdout in `<name>.stdout`, unmodified stderr in `<name>.stderr`, and exit status, start/end UTC, cwd, and signal in `<name>.status.json`. Retain empty stdout or stderr files. `run-manifest.json` may summarize these records but never substitutes for them. Store credential-bearing environment variables only as `present: true|false`; do not retain their values.

Before starting the fixture server, retain and require success for:

1. `git rev-parse I D E`, the Section 2 path/blob comparison, and the v2 blob-ID check.
2. `pi --version`, `node --version`, and the command used to identify the OS.
3. `PI_OFFLINE=1 pi --list-models 'openai-codex'`. Its output must contain one row whose provider is exactly `openai-codex` and whose model is exactly `gpt-5.6-sol`. Pi's catalog lists model IDs without reasoning suffixes, so `:high` must not be included in this fuzzy-search argument. An absent exact row fails preflight even if authentication is ready.
4. `PI_OFFLINE=1 pi auth check --model openai-codex/gpt-5.6-sol:high --json --no-refresh`, without credentials. It must report ready. Every scored command retains the inherited exact `--model openai-codex/gpt-5.6-sol:high` argument; the resulting session metadata and provider request must identify `gpt-5.6-sol` with reasoning level `high`.
5. `git -c core.excludesFile=/dev/null check-ignore -v --no-index .agents/2026-08-13-research-context-isolation/audit/v4/probe`. It must identify the repository `.gitignore` rule.
6. The child-extension argv/path and SHA-256 checks in Section 4.

After those checks pass, create the inherited fixture and retain its server stdout/stderr as v2 requires. Before any cell, run the fixed `fixture-manifest-inspection` command in Section 5 and retain its raw command records using the same layout.

A preflight-only result launches zero cells and cannot pass any Task 06 gate. A runtime-preflight stop retains every runtime-preflight record created through the failing check and creates no fixture or cell artifacts. A fixture-preflight stop retains all completed runtime-preflight records and its fixture-preflight records, and launches no cells. Retain either outcome rather than describing unmeasured values as zero.

## 4. Pinned child-extension isolation

The implementation baseline fixes each Research child invocation to this ordered argv fragment, with `<ROOT>` the canonical repository root:

```text
--no-extensions
--extension <ROOT>/.pi/agent/extensions/subagent/index.ts
--extension <ROOT>/.pi/agent/extensions/web-fetch/index.ts
--extension <ROOT>/.pi/agent/extensions/web-search/index.ts
```

The matching files and SHA-256 values at `I` are:

| Project-relative extension path | SHA-256 |
| --- | --- |
| `.pi/agent/extensions/subagent/index.ts` | `97ca43067226ff0ed72fc3a8d1d4a3c94421a4300665077b1e25f81f8282fd7e` |
| `.pi/agent/extensions/web-fetch/index.ts` | `557538e5cf7bb39a385e677e9c8d0a224be23ff69ce8529a60ca14c99844c5e1` |
| `.pi/agent/extensions/web-search/index.ts` | `a8caeb18b89cfbda07e2ecddac1b6b411476b8791265ec1d93071f9f9ad11ec9` |

Before the fixture server starts, run these exact commands from the canonical repository root. Retain their Section 3 records under the fixed names `child-extension-argv-paths` and `child-extension-sha256`; their stdout, not a derived policy file, is the primary evidence.

```sh
# child-extension-argv-paths
node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { childExtensionArgs } from "./.pi/agent/extensions/subagent/index.ts"; const root = fs.realpathSync(process.cwd()); const expectedPaths = [path.join(root, ".pi/agent/extensions/subagent/index.ts"), path.join(root, ".pi/agent/extensions/web-fetch/index.ts"), path.join(root, ".pi/agent/extensions/web-search/index.ts")]; const actual = childExtensionArgs(true); assert.equal(actual.length, 7); assert.equal(actual[0], "--no-extensions"); for (let index = 0; index < expectedPaths.length; index++) { assert.equal(actual[index * 2 + 1], "--extension"); assert.equal(fs.realpathSync(actual[index * 2 + 2]), expectedPaths[index]); } console.log(JSON.stringify({canonicalRoot: root, argv: actual, resolvedPaths: expectedPaths}));'

# child-extension-sha256
python3 -c 'import hashlib, json, sys; from pathlib import Path; root = Path.cwd().resolve(); expected = {".pi/agent/extensions/subagent/index.ts": "97ca43067226ff0ed72fc3a8d1d4a3c94421a4300665077b1e25f81f8282fd7e", ".pi/agent/extensions/web-fetch/index.ts": "557538e5cf7bb39a385e677e9c8d0a224be23ff69ce8529a60ca14c99844c5e1", ".pi/agent/extensions/web-search/index.ts": "a8caeb18b89cfbda07e2ecddac1b6b411476b8791265ec1d93071f9f9ad11ec9"}; actual = {relative: hashlib.sha256((root / relative).read_bytes()).hexdigest() for relative in expected}; assert actual == expected, {"expected": expected, "actual": actual}; print(json.dumps({"canonicalRoot": str(root), "sha256": actual}, sort_keys=True))'
```

The first command must emit the seven-element argv fragment whose first element is `--no-extensions`, followed by exactly three `--extension`/path pairs in the table order. It executes `childExtensionArgs(true)` rather than accepting a hand-authored argv, and `--no-extensions` verifies that user-global extensions cannot be discovered. The second command must emit exactly the table hashes. A nonzero status, unexpected stdout JSON, missing path, path outside the canonical root, wrong argv order, missing `--no-extensions`, undeclared extension, or hash mismatch fails runtime preflight.

Record in `audit/v4/preflight/child-extension-policy.json` the canonical root, resolved paths, SHA-256 values, ordered argv fragment, and source location `childExtensionArgs(true)` in `.pi/agent/extensions/subagent/index.ts`. This is a derived cross-reference only: it must reproduce the two fixed command outputs and never substitutes for their raw records. The inherited parent command extension lists remain unchanged; this policy applies only to spawned isolated Research children.

For every immutable isolated child-session copy required by v2, parse the copied JSONL before and after its recorded SHA-256 check. Its custom entries may have only these `customType` values: `research-child`, `research-context`, `research-work-budget`, and `research-fetch-evidence`. It must contain no `plannotator` entry and no other extension-owned custom entry. Record the custom-type sequence, child-session ID, policy-file SHA-256, and child-copy SHA-256 beside that phase's existing child-session artifacts. For C5, apply this to both fresh and continuation copies, preserving their separate hashes and the same child-session ID requirement.

A missing policy record, path/hash/argv mismatch, missing `--no-extensions`, undeclared child extension, forbidden child custom entry, malformed child JSONL, or child-copy hash mismatch invalidates the affected isolated phase and cell. This is additional to, and does not replace, every inherited session-lineage, child-details, masking, budget, provenance, context, and provider-payload gate.

## 5. Ten-route fixture preflight

Section 2 of v2 contains ten `DOCS` routes. Its phrase requiring a manifest with "the nine routes above" is replaced with this literal requirement: `fixture-manifest.json` must contain exactly these ten routes, in this order, and no others:

```text
/c1-a.txt
/c1-b.txt
/c1-c.txt
/c2-operations.txt
/c2-legal.txt
/c3-injection.txt
/c4-insufficient.txt
/c5-a.txt
/c5-b.txt
/c5-c.txt
```

Run this exact command as `fixture-manifest-inspection` after the fixture writes its manifest and before any cell:

```sh
python3 -c 'import json; from pathlib import Path; manifest = json.loads(Path(".agents/2026-08-13-research-context-isolation/audit/v4/fixture-manifest.json").read_text(encoding="utf-8")); expected = ["/c1-a.txt", "/c1-b.txt", "/c1-c.txt", "/c2-operations.txt", "/c2-legal.txt", "/c3-injection.txt", "/c4-insufficient.txt", "/c5-a.txt", "/c5-b.txt", "/c5-c.txt"]; assert list(manifest) == expected, {"expected": expected, "actual": list(manifest)}; c1 = [manifest[route]["bytes"] for route in expected[:3]]; assert c1 == [40960, 40960, 40960], c1; assert sum(c1) == 122880, c1; print(json.dumps({"routes": list(manifest), "c1Bytes": c1, "c1TotalBytes": sum(c1)}))'
```

The command must exit zero and emit the exact ordered route list, C1 byte list, and total shown by its code. It rejects missing, extra, reordered, or mis-sized manifest entries. Each C1 route remains exactly 40,960 bytes and their bodies remain 122,880 bytes in total. All fixture generator text, URLs, packets, prompts, source order, access-log requirements, and every other fixture rule in v2 remain unchanged.

## 6. Final disposition

This file is intentionally unsealed until committed under Section 2. The prior v3 design, results, raw artifacts, and invalid disposition remain unchanged. Task 06 remains unchecked unless a future fully valid v4 run supplies all inherited required raw artifacts and measurements, the retained preflight records above, and all strict v2 gates.
