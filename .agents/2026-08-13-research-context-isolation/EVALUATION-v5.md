# Research context isolation evaluation v5

**Status:** replacement design, not sealed or executed.
**Supersedes:** v4 execution eligibility. The inherited v2 source is committed blob `500840b6ec51b589134ea122d792249ea6372d01` at `3b018aa608dbf8bf437b3956decfbfd5b1da8db5`.
**Inherited v4 source:** `.agents/2026-08-13-research-context-isolation/EVALUATION-v4.md`, committed blob `c737b909b6e50c164819d95da9fe3c684de409f8` at v4 design-seal commit `bff5994fe1bbef10af95fcb7d95711d1e17481b5`.
**Frozen implementation baseline:** `0da9582362f5363451841446595ad6e3a11173e4`.

This replacement retains the v4 protocol and corrections. It resolves only the retained v4 child-extension-preflight import failure and top-level `PI_SUBAGENT_DEPTH` environment-record failure. It does not alter cases, packets, prompts, caps, budgets, command order, no-retry rule, scoring, or strict context/provider leakage gates.

## 1. Inherited protocol and versioned audit path

The complete v5 protocol starts with the exact pinned v4 source above. Replace every literal `audit/v4` path in that source with `audit/v5`, then apply only the authoritative changes in this file: Section 2 replaces revision eligibility and its verification; Section 3 replaces runtime-preflight record location and the top-level environment rule; Section 4 replaces child-extension preflight; Section 5 retains v4's fixture correction at the v5 path; and Section 6 applies the top-level environment rule to the three scored commands. No other inherited text changes. This construction retains every v4 correction, including retained preflight records, the ten-route fixture manifest, child-session custom-entry checks, and all cases and gates.

If this file conflicts with v2, v3, or the pinned v4 source, this file controls only on revision eligibility, audit-directory creation, fixture route count, preflight retention, child-extension isolation, or the top-level `PI_SUBAGENT_DEPTH` requirement. All other v2 requirements, including every prompt, packet, budget, command order, no-retry rule, scoring rule, and context/provider gate, remain literal and mandatory.

The raw artifact directory is `.agents/2026-08-13-research-context-isolation/audit/v5/`, ignored by the existing repository `.gitignore` rule. Before the first runtime-preflight command, create only its empty `preflight/` directory. `run-manifest.json` is fixed at `audit/v5/preflight/run-manifest.json` and is permitted there during runtime preflight. Do not create a fixture, trace, session, envelope, score, citation audit, or usage calculation until the runtime preflight passes. Create the rest of `audit/v5/` only when proceeding to the fixture preflight and cells. Raw artifacts remain lossless and unredacted as v2 requires.

## 2. Implementation baseline, standalone design seal, and execution revision

Let `I` be the frozen implementation baseline above, `D` the design-seal commit, and `E` the execution revision.

1. `D` must have `I` as its first parent. Its diff from `I` must contain exactly `.agents/2026-08-13-research-context-isolation/EVALUATION-v5.md`. It must retain the unchanged committed v2 blob named above and all v3/v4 design and attempt records already present at `I`. This is the required standalone design-seal commit and must exist before any scored invocation.
2. `E` may equal `D` or descend from `D`. Between `D` and `E`, only `.agents/2026-08-13-research-context-isolation/EVALUATION-RESULTS.md` may change before cells launch. This permits a tracked v5 preflight-only result without changing the design or implementation.
3. At `E`, every tracked implementation path must have the same blob as `I`. The only tracked paths permitted to differ from `I` are `EVALUATION-v5.md` and `EVALUATION-RESULTS.md` in this task directory. Verify this mechanically with a path/blob comparison, not commit messages.
4. Run all inherited commands from the repository root at `E`, with a clean worktree except ignored `audit/v5/` artifacts created by this procedure. Record `I`, `D`, and `E` in `audit/v5/preflight/run-manifest.json` and the results report.

Before the fixture server starts, set `DESIGN_SEAL` and `EXECUTION_REVISION` to the intended full commit IDs and run this exact `revision-eligibility` command from the repository root. It is the required Section 2 path/blob comparison and v2/v4 blob-ID check.

```sh
env -u PI_SUBAGENT_DEPTH python3 - "${DESIGN_SEAL:?set DESIGN_SEAL to D}" "${EXECUTION_REVISION:?set EXECUTION_REVISION to E}" <<'PY'
import subprocess
import sys

I = "0da9582362f5363451841446595ad6e3a11173e4"
V2_PATH = ".agents/2026-08-13-research-context-isolation/EVALUATION.md"
V2_BLOB = "500840b6ec51b589134ea122d792249ea6372d01"
V4_PATH = ".agents/2026-08-13-research-context-isolation/EVALUATION-v4.md"
V4_BLOB = "c737b909b6e50c164819d95da9fe3c684de409f8"
V5_PATH = ".agents/2026-08-13-research-context-isolation/EVALUATION-v5.md"
RESULTS_PATH = ".agents/2026-08-13-research-context-isolation/EVALUATION-RESULTS.md"


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def blob(revision, project_path):
    return git("rev-parse", "--verify", f"{revision}:{project_path}")


def tree(revision):
    records = git("ls-tree", "-r", "-z", revision).split("\0")
    return {record.partition("\t")[2]: record.partition("\t")[0].split()[2] for record in records if record}


D = git("rev-parse", "--verify", f"{sys.argv[1]}^{{commit}}")
E = git("rev-parse", "--verify", f"{sys.argv[2]}^{{commit}}")
assert git("rev-list", "--parents", "-n", "1", D).split() == [D, I], "D must be a single-parent commit whose parent is I"
assert subprocess.run(["git", "merge-base", "--is-ancestor", D, E], check=False).returncode == 0, "E must equal or descend from D"
assert git("diff", "--name-only", "--no-renames", I, D).splitlines() == [V5_PATH], "I..D must change only EVALUATION-v5.md"
assert set(git("diff", "--name-only", "--no-renames", D, E).splitlines()) <= {RESULTS_PATH}, "D..E may change only EVALUATION-RESULTS.md"
assert blob(E, V2_PATH) == V2_BLOB, "v2 source blob changed"
assert blob(E, V4_PATH) == V4_BLOB, "pinned v4 source blob changed"
assert blob(E, V5_PATH) == blob(D, V5_PATH), "v5 design changed after D"
base_tree, execution_tree = tree(I), tree(E)
differing_paths = {project_path for project_path in base_tree.keys() | execution_tree.keys() if base_tree.get(project_path) != execution_tree.get(project_path)}
assert differing_paths <= {V5_PATH, RESULTS_PATH}, {"unexpected_path_blob_differences": sorted(differing_paths - {V5_PATH, RESULTS_PATH})}
print({"I": I, "D": D, "E": E, "pathBlobDifferences": sorted(differing_paths)})
PY
```

A mismatch is a preflight failure. Do not amend a baseline, substitute a checkout, or score a cell. The retained v3 cell attempt and v4 preflight-only attempt remain invalid attempts under their own designs; neither is a v5 cell and neither can be retried. V5 begins with zero launched cells. Once a v5 cell launches, retain and score no retry exactly as v2 requires. Any later implementation change requires another separately fixed implementation revision and a new versioned replacement design with a new baseline and seal; it cannot be folded into v5.

## 3. Retained runtime preflight and top-level environment

For every command below, retain its exact expanded argv, including the `env -u PI_SUBAGENT_DEPTH` wrapper, and selected environment-key names in `audit/v5/preflight/<name>.argv.json`, unmodified stdout in `<name>.stdout`, unmodified stderr in `<name>.stderr`, and exit status, start/end UTC, cwd, and signal in `<name>.status.json`. Retain empty stdout or stderr files. `run-manifest.json` may summarize these records but never substitutes for them. Store credential-bearing environment variables only as `present: true|false` and never retain their values.

Every top-level preflight process, fixture-preflight process, fixture-server process, and scored Pi process must explicitly execute through `env -u PI_SUBAGENT_DEPTH`. Its command record must show that wrapper and record `PI_SUBAGENT_DEPTH` as `present: false` in the executed process environment. A missing wrapper, a missing presence record, or a present (including empty) value is a preflight failure before cells or an invalid scored phase after launch. This replaces the inherited instruction merely to set the variable unset.

Before starting the fixture server, retain and require success for:

1. The `revision-eligibility` command in Section 2. It defines and verifies `I`, `D`, and `E`, performs the path/blob comparison, and checks the v2 and pinned-v4 source blobs.
2. `env -u PI_SUBAGENT_DEPTH pi --version`, `env -u PI_SUBAGENT_DEPTH node --version`, and the `env -u PI_SUBAGENT_DEPTH` command used to identify the OS.
3. `env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi --list-models 'openai-codex'`. Its output must contain one row whose provider is exactly `openai-codex` and whose model is exactly `gpt-5.6-sol`. Pi's catalog lists model IDs without reasoning suffixes, so `:high` must not be included in this fuzzy-search argument. An absent exact row fails preflight even if authentication is ready.
4. `env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi auth check --model openai-codex/gpt-5.6-sol:high --json --no-refresh`, without credentials. It must report ready. Every scored command retains the inherited exact `--model openai-codex/gpt-5.6-sol:high` argument; the resulting session metadata and provider request must identify `gpt-5.6-sol` with reasoning level `high`.
5. `env -u PI_SUBAGENT_DEPTH git -c core.excludesFile=/dev/null check-ignore -v --no-index .agents/2026-08-13-research-context-isolation/audit/v5/probe`. It must identify the repository `.gitignore` rule.
6. The child-extension argv/path and SHA-256 checks in Section 4.

After those checks pass, create the inherited fixture with `env -u PI_SUBAGENT_DEPTH python3 fixture_server.py > fixture-server.stdout 2> fixture-server.stderr &` and retain its server stdout/stderr as v2 requires. Before any cell, run the fixed `fixture-manifest-inspection` command in Section 5 through `env -u PI_SUBAGENT_DEPTH` and retain its raw command records using the same layout.

A preflight-only result launches zero cells and cannot pass any Task 06 gate. A runtime-preflight stop retains every runtime-preflight record created through the failing check and creates no fixture or cell artifacts. A fixture-preflight stop retains all completed runtime-preflight records and its fixture-preflight records, and launches no cells. Retain either outcome rather than describing unmeasured values as zero.

## 4. Pinned child-extension isolation

The implementation baseline fixes each Research child invocation to this ordered argv fragment, with `<ROOT>` the canonical repository root:

```text
--no-extensions
--extension <ROOT>/.pi/agent/extensions/subagent/index.ts
--extension <ROOT>/.pi/agent/extensions/web-fetch/index.ts
--extension <ROOT>/.pi/agent/extensions/web-search/index.ts
```

The dependency-free helper that constructs this fragment and the matching child-extension files at `I` are:

| Project-relative path | SHA-256 |
| --- | --- |
| `.pi/agent/extensions/subagent/child-extensions.ts` | `6dcceaf8ede7bfe5d02f3556c623e69f9310e31cefe012ddf7dbc6ad0d5ccec7` |
| `.pi/agent/extensions/subagent/index.ts` | `f57d3b4f671254e09bac2664fd4d2faf03c5fbff81286aeb64f4c01516af563c` |
| `.pi/agent/extensions/web-fetch/index.ts` | `557538e5cf7bb39a385e677e9c8d0a224be23ff69ce8529a60ca14c99844c5e1` |
| `.pi/agent/extensions/web-search/index.ts` | `a8caeb18b89cfbda07e2ecddac1b6b411476b8791265ec1d93071f9f9ad11ec9` |

Before the fixture server starts, run these exact commands from the canonical repository root. Retain their Section 3 records under the fixed names `child-extension-argv-paths` and `child-extension-sha256`; their stdout, not a derived policy file, is the primary evidence.

```sh
# child-extension-argv-paths
env -u PI_SUBAGENT_DEPTH node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { childExtensionArgs } from "./.pi/agent/extensions/subagent/child-extensions.ts"; const root = fs.realpathSync(process.cwd()); const expectedPaths = [path.join(root, ".pi/agent/extensions/subagent/index.ts"), path.join(root, ".pi/agent/extensions/web-fetch/index.ts"), path.join(root, ".pi/agent/extensions/web-search/index.ts")]; const actual = childExtensionArgs(true); assert.equal(actual.length, 7); assert.equal(actual[0], "--no-extensions"); for (let index = 0; index < expectedPaths.length; index++) { assert.equal(actual[index * 2 + 1], "--extension"); assert.equal(actual[index * 2 + 2], expectedPaths[index]); assert.equal(fs.realpathSync(actual[index * 2 + 2]), expectedPaths[index]); } console.log(JSON.stringify({canonicalRoot: root, argv: actual, resolvedPaths: expectedPaths}));'

# child-extension-sha256
env -u PI_SUBAGENT_DEPTH python3 -c 'import hashlib, json; from pathlib import Path; root = Path.cwd().resolve(); expected = {".pi/agent/extensions/subagent/child-extensions.ts": "6dcceaf8ede7bfe5d02f3556c623e69f9310e31cefe012ddf7dbc6ad0d5ccec7", ".pi/agent/extensions/subagent/index.ts": "f57d3b4f671254e09bac2664fd4d2faf03c5fbff81286aeb64f4c01516af563c", ".pi/agent/extensions/web-fetch/index.ts": "557538e5cf7bb39a385e677e9c8d0a224be23ff69ce8529a60ca14c99844c5e1", ".pi/agent/extensions/web-search/index.ts": "a8caeb18b89cfbda07e2ecddac1b6b411476b8791265ec1d93071f9f9ad11ec9"}; actual = {relative: hashlib.sha256((root / relative).read_bytes()).hexdigest() for relative in expected}; assert actual == expected, {"expected": expected, "actual": actual}; print(json.dumps({"canonicalRoot": str(root), "sha256": actual}, sort_keys=True))'
```

The first command must emit the seven-element argv fragment whose first element is `--no-extensions`, followed by exactly three `--extension`/path pairs in the listed extension order. It imports and executes `childExtensionArgs(true)` from the dependency-free `.pi/agent/extensions/subagent/child-extensions.ts`, rather than importing the dependency-bearing extension entry point or accepting a hand-authored argv. The second command must emit exactly the table hashes. A nonzero status, unexpected stdout JSON, missing path, path outside the canonical root, wrong argv order, missing `--no-extensions`, undeclared child extension, helper or extension hash mismatch, or missing environment proof fails runtime preflight.

Record in `audit/v5/preflight/child-extension-policy.json` the canonical root, resolved paths, SHA-256 values, ordered argv fragment, and source location `childExtensionArgs(true)` in `.pi/agent/extensions/subagent/child-extensions.ts`. This is a derived cross-reference only: it must reproduce the two fixed command outputs and never substitutes for their raw records. The inherited parent command extension lists remain unchanged; this policy applies only to spawned isolated Research children.

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
env -u PI_SUBAGENT_DEPTH python3 -c 'import json; from pathlib import Path; manifest = json.loads(Path(".agents/2026-08-13-research-context-isolation/audit/v5/fixture-manifest.json").read_text(encoding="utf-8")); expected = ["/c1-a.txt", "/c1-b.txt", "/c1-c.txt", "/c2-operations.txt", "/c2-legal.txt", "/c3-injection.txt", "/c4-insufficient.txt", "/c5-a.txt", "/c5-b.txt", "/c5-c.txt"]; assert list(manifest) == expected, {"expected": expected, "actual": list(manifest)}; c1 = [manifest[route]["bytes"] for route in expected[:3]]; assert c1 == [40960, 40960, 40960], c1; assert sum(c1) == 122880, c1; print(json.dumps({"routes": list(manifest), "c1Bytes": c1, "c1TotalBytes": sum(c1)}))'
```

The command must exit zero and emit the exact ordered route list, C1 byte list, and total shown by its code. It rejects missing, extra, reordered, or mis-sized manifest entries. Each C1 route remains exactly 40,960 bytes and their bodies remain 122,880 bytes in total. All fixture generator text, URLs, packets, prompts, source order, access-log requirements, and every other fixture rule in v2 remain unchanged.

## 6. Scored commands and fixed order

Section 6 of v2 remains mandatory except that each of its three exact scored Pi commands is replaced only by the corresponding command below. Preserve every other argument, prompt, packet, session rule, capture rule, and fixed order from v2. Record the `env -u PI_SUBAGENT_DEPTH` wrapper in every phase argv record and `PI_SUBAGENT_DEPTH` as `present: false` in its selected environment record as Section 3 requires.

```sh
# Direct research
env -u PI_SUBAGENT_DEPTH sh -c 'cat "$1" | env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi --mode json -p --no-context-files --no-skills --no-prompt-templates --model openai-codex/gpt-5.6-sol:high --session "$2" --no-builtin-tools --tools webfetch --no-extensions --extension .pi/agent/extensions/web-fetch/index.ts --extension .agents/2026-08-13-research-context-isolation/audit/v5/capture-extension.ts' sh "$PROMPT" "$SESSION"

# Isolated research
env -u PI_SUBAGENT_DEPTH sh -c 'cat "$1" | env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi --mode json -p --no-context-files --no-skills --no-prompt-templates --model openai-codex/gpt-5.6-sol:high --session "$2" --no-builtin-tools --tools research,webfetch --no-extensions --extension .pi/agent/extensions/subagent/index.ts --extension .pi/agent/extensions/web-fetch/index.ts --extension .agents/2026-08-13-research-context-isolation/audit/v5/capture-extension.ts' sh "$PROMPT" "$SESSION"

# Downstream
env -u PI_SUBAGENT_DEPTH sh -c 'cat "$1" | env -u PI_SUBAGENT_DEPTH PI_OFFLINE=1 pi --mode json -p --no-context-files --no-skills --no-prompt-templates --model openai-codex/gpt-5.6-sol:high --session "$2" --no-tools --no-extensions --extension .agents/2026-08-13-research-context-isolation/audit/v5/capture-extension.ts' sh "$PROMPT" "$SESSION"
```

## 7. Final disposition

This file is intentionally unsealed until committed under Section 2. The prior v3 design and invalid cell attempt, and the v4 design and invalid preflight-only attempt, remain unchanged and are not v5 work. Task 06 remains unchecked unless a future fully valid v5 run supplies all inherited required raw artifacts and measurements, the retained preflight records above, and all strict v2 gates.
