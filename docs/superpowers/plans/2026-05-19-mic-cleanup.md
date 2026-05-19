# Mic Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a declarative PipeWire filter-chain that turns the raw/harsh/noisy onboard mic into a clean "Cleaned Mic" virtual source set as the default input, deployed through the dotfiles repo.

**Architecture:** One `libpipewire-module-filter-chain` config (mono graph: RNNoise → high-pass → high-shelf → SC4 compressor) exposed as `Audio/Source`, plus a WirePlumber rule biasing default-input selection to it. Pure config files stowed via the existing Makefile/stow flow. No GUI, no machine-specific device strings.

**Tech Stack:** PipeWire 1.6.x filter-chain, LADSPA (`librnnoise_ladspa.so`, `sc4_1882.so`), PipeWire builtin biquads, WirePlumber 0.5.x SPA-JSON rules, GNU Stow, Makefile package lists.

**Spec:** `docs/superpowers/specs/2026-05-19-mic-cleanup-design.md` — read it before starting.

**Verification model:** This is config, not compiled code — there is no unit-test harness. "Tests" here are exact verification commands with expected output. The discipline still holds: define the expected observable result, make a change, confirm the result. Never claim a task done without running its verification command and seeing the expected output.

**Hard ordering constraint:** Plugin labels and control-port names are NOT guessable and vary by build. Tasks 4–5 (writing the configs) MUST consume the verified strings captured in Task 3. Do not write config strings from memory.

---

### Task 1: Commit existing scaffolding

Spec doc and the `.stow-local-ignore` `docs` entry already exist uncommitted in the working tree. Lock them in first so later commits are clean.

**Files:**
- Already present: `docs/superpowers/specs/2026-05-19-mic-cleanup-design.md`
- Already present: `docs/superpowers/plans/2026-05-19-mic-cleanup.md` (this file)
- Already modified: `.stow-local-ignore` (added `docs`)

- [ ] **Step 1: Confirm working-tree state**

Run: `git status --porcelain && git diff .stow-local-ignore`
Expected: `docs/superpowers/...` listed as untracked; `.stow-local-ignore` diff shows a single added `docs` line between `bin` and `etc`.

- [ ] **Step 2: Verify `docs` ignore actually takes effect**

Run: `stow -n -v --restow . 2>&1 | grep -c docs`
Expected: `0` (stow never descends into `docs/`).

- [ ] **Step 3: Commit**

```bash
git add .stow-local-ignore docs/superpowers/specs/2026-05-19-mic-cleanup-design.md docs/superpowers/plans/2026-05-19-mic-cleanup.md
git commit -m "docs: mic cleanup spec + plan; stow-ignore docs/"
```

- [ ] **Step 4: Confirm clean**

Run: `git status --porcelain`
Expected: empty.

---

### Task 2: Add packages to the dotfiles package lists

**Files:**
- Modify: `pkgs/aur`
- Modify: `pkgs/pacman`

- [ ] **Step 1: Inspect current package files**

Run: `cat pkgs/aur; echo "---"; cat pkgs/pacman`
Expected: newline-separated plain package names, no `#` comments. Note last line / trailing newline.

- [ ] **Step 2: Append `noise-suppression-for-voice` to `pkgs/aur`**

Use the Edit tool. Add `noise-suppression-for-voice` on its own line at the end, preserving the file's existing newline style. NO comment text on the line (Makefile passes lines verbatim to `yay`).

- [ ] **Step 3: Append `swh-plugins` and `ladspa-sdk` to `pkgs/pacman`**

Use the Edit tool. Add two lines at the end: `swh-plugins` and `ladspa-sdk`, each on its own line, no comments.

- [ ] **Step 4: Verify the Makefile will consume them**

Run: `make -np 2>/dev/null | grep -E 'AUR_PKGS|ARCH_PKGS' | head -4`
Expected: `noise-suppression-for-voice` appears in the AUR_PKGS expansion; `swh-plugins` and `ladspa-sdk` appear in the ARCH_PKGS expansion.

- [ ] **Step 5: Commit**

```bash
git add pkgs/aur pkgs/pacman
git commit -m "pkgs: add rnnoise/sc4/ladspa-sdk for mic cleanup"
```

---

### Task 3: Install plugins and capture verified labels/ports (introspection gate)

This task produces the ground-truth strings every later config depends on. Output is recorded in a scratch notes file used only during implementation (not committed, not stowed).

**Files:**
- Create (scratch, gitignored-by-location — keep in `/tmp`): `/tmp/mic-cleanup-introspect.txt`

- [ ] **Step 1: Install the packages via the canonical targets**

Run: `make pacman` then `make aur`
Expected: `swh-plugins`, `ladspa-sdk`, `noise-suppression-for-voice` install without error. If `make aur` prompts, allow the build.

- [ ] **Step 2: Confirm the plugin .so files exist**

Run: `ls -1 /usr/lib/ladspa/ | grep -E 'rnnoise|sc4'`
Expected: at least `librnnoise_ladspa.so` and `sc4_1882.so` present. Record exact filenames.

- [ ] **Step 3: Introspect RNNoise**

Run: `analyzeplugin /usr/lib/ladspa/librnnoise_ladspa.so`
Expected: lists plugin label(s). Record the exact mono label (`noise_suppressor_mono` or build variant) and the exact VAD control port string (e.g. `VAD Threshold (%)`) into `/tmp/mic-cleanup-introspect.txt`.

- [ ] **Step 4: Introspect SC4**

Run: `analyzeplugin /usr/lib/ladspa/sc4_1882.so`
Expected: label `sc4` (confirm) and exact control port strings for ratio, threshold, attack, release, knee, makeup gain, plus the audio input/output port names. Record all into the notes file.

- [ ] **Step 5: Capture the shipped reference config**

Run: `cat /usr/share/pipewire/filter-chain/source-rnnoise.conf`
Expected: a working filter-chain example. Record its `capture.props`/`playback.props` structure and node port-naming convention into the notes file — Tasks 4–5 mirror this exact structure.

- [ ] **Step 6: Determine builtin biquad port names**

Run: `grep -rn 'bq_highpass\|bq_highshelf\|"Freq"\|"Gain"\|"Q"' /usr/share/pipewire/ 2>/dev/null | head`
Expected: confirms builtin biquad label spelling and control port names (`Freq`, `Q`, `Gain`). Record. If not found in shipped files, note that builtin biquad ports are `Freq`/`Q`/`Gain` per PipeWire builtin filter docs and proceed.

- [ ] **Step 7: Checkpoint**

The notes file now contains, verbatim: rnnoise mono label + VAD port; sc4 label + all control/audio port names; builtin biquad label + ports; the shipped config's I/O props block. No commit (scratch only). Do not proceed without all of these.

---

### Task 4: Create the filter-chain config

Build from the skeleton in the spec appendix, substituting Task 3's verified strings for every `<...>` and confirming each label/port against the notes file.

**Files:**
- Create: `.config/pipewire/pipewire.conf.d/99-input-denoise.conf`

- [ ] **Step 1: Write the config**

Create `.config/pipewire/pipewire.conf.d/99-input-denoise.conf` using the spec-appendix skeleton as the structure, with these rules:
- Every `plugin`, `label`, and `control` key string is copied from `/tmp/mic-cleanup-introspect.txt`, not from memory or the skeleton's placeholders.
- `links` array wires `rnnoise → hp → hs → comp` using the exact port names the shipped reference config / `analyzeplugin` reported (RNNoise and SC4 LADSPA port names differ from builtin `In`/`Out`; use what introspection showed).
- `capture.props` mirrors the shipped `source-rnnoise.conf` exactly: include `node.passive = true`, `audio.channels = 1`, `audio.position = [ MONO ]`.
- `playback.props`: `media.class = Audio/Source`, `node.name = "effect_input.cleaned-mic"`, `node.description = "Cleaned Mic"`, `audio.channels = 1`, `audio.position = [ MONO ]`.
- Top-of-file comment header lists each `[TUNE]` control port with its unit and valid range, so future tuning is edit-a-number (spec "Tuning later" requirement).

- [ ] **Step 2: Lint the SPA-JSON syntax**

Run: `pw-config -n pipewire -c 99-input-denoise.conf 2>&1 | tail -20` (or `pw-config paths` then validate by load in Step 4 if `pw-config` lacks file-check). At minimum: visually confirm balanced braces/brackets and that every node has a unique `name`.
Expected: no parse error reported.

- [ ] **Step 3: Activate and load**

Run: `cp/stow not yet — load directly for fast iteration:` create the dir if needed and symlink/copy is via stow later; for this step run `mkdir -p ~/.config/pipewire/pipewire.conf.d && cp .config/pipewire/pipewire.conf.d/99-input-denoise.conf ~/.config/pipewire/pipewire.conf.d/ && systemctl --user restart pipewire`

Note: this temporary copy is replaced by the stow symlink in Task 6; it exists only to test the config before committing.

- [ ] **Step 4: Verify the node loaded and is running, not errored**

Run: `wpctl status | grep -i 'cleaned mic'` and `pw-cli ls Node 2>/dev/null | grep -A2 -i 'cleaned-mic'`
Expected: a source named "Cleaned Mic" appears. Then `pw-dump | python3 -c "import json,sys; [print(n['info']['state']) for n in json.load(sys.stdin) if n.get('info',{}).get('props',{}).get('node.name')=='effect_input.cleaned-mic']"` — Expected: `running` or `suspended` (NOT `error`). If `error` or absent: a label/port string is wrong — re-check against `/tmp/mic-cleanup-introspect.txt`, fix, restart, repeat. Do not proceed on error.

- [ ] **Step 5: Verify it captures real audio (no feedback loop)**

Run: speak into the mic and `pw-record --target effect_input.cleaned-mic /tmp/test-clean.wav` for ~5s (Ctrl-C to stop), then `ls -l /tmp/test-clean.wav` and play back: `pw-play /tmp/test-clean.wav`
Expected: audible voice with noticeably reduced background noise vs raw mic. Silence/empty = feedback loop or wrong capture binding → revisit `capture.props node.passive`.

- [ ] **Step 6: Commit**

```bash
git add .config/pipewire/pipewire.conf.d/99-input-denoise.conf
git commit -m "feat: pipewire filter-chain mic cleanup source"
```

---

### Task 5: Create the WirePlumber default-routing rule

Bias default-input selection to the virtual source via tracked config — never via `wpctl set-default` mutable state.

**Files:**
- Create: `.config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf`

- [ ] **Step 1: Write the routing rule**

Create `.config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf` as a WirePlumber 0.5.x SPA-JSON `node.rules` config:
- Match `node.name = "effect_input.cleaned-mic"` → `update-props { priority.session = 2000 }` (raise so default-nodes logic prefers it).
- Match `media.class = "Audio/Source"` AND `device.api = "alsa"` → `update-props { priority.session = 500 }` (demote raw physical mics below the virtual source) — keep them selectable, just not auto-default.
- Add a header comment explaining this replaces the rejected `default.configured.audio.source` approach (spec "Default input routing").

- [ ] **Step 2: Activate**

Run: `mkdir -p ~/.config/wireplumber/wireplumber.conf.d && cp .config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf ~/.config/wireplumber/wireplumber.conf.d/ && systemctl --user restart wireplumber`
(Temporary copy — replaced by stow symlink in Task 6.)

- [ ] **Step 3: Verify default input is the virtual source**

Run: `wpctl status | sed -n '/Sources:/,/Filters:/p'`
Expected: "Cleaned Mic" marked with the default `*` under Sources; raw alsa mic present but not default.

- [ ] **Step 4: Fallback check (documented, not committed state)**

If "Cleaned Mic" is NOT default after restart: priority alone insufficient on this WirePlumber build. Record this in the spec's Default routing section as a known limitation and document the one-time user action `wpctl set-default <id>` as fallback (acknowledged mutable state, not tracked). Only add this note if the priority rule actually fails — verify first.

- [ ] **Step 5: Commit**

```bash
git add .config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf
git commit -m "feat: wireplumber rule defaulting input to Cleaned Mic"
```

---

### Task 6: Deploy via stow and full end-to-end verification

Replace the temporary hand-copies with real stow symlinks and verify the canonical deploy path works.

**Files:**
- No new files. Exercises `make link`.

- [ ] **Step 1: Remove temporary hand-copies**

Run: `rm -f ~/.config/pipewire/pipewire.conf.d/99-input-denoise.conf ~/.config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf` and remove the now-empty temp dirs only if empty: `rmdir -p --ignore-fail-on-non-empty ~/.config/pipewire/pipewire.conf.d ~/.config/wireplumber/wireplumber.conf.d 2>/dev/null || true`
Expected: paths cleared so stow can create clean symlinks (no "existing target" conflict).

- [ ] **Step 2: Deploy via the canonical target**

Run: `make link`
Expected: completes without stow conflict. `~/.config/pipewire` and `~/.config/wireplumber` now exist as symlinks (or folded trees) pointing into the repo.

- [ ] **Step 3: Verify symlinks resolve into the repo**

Run: `readlink -f ~/.config/pipewire/pipewire.conf.d/99-input-denoise.conf; readlink -f ~/.config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf`
Expected: both resolve to paths under `dev/dotfiles/.config/...`.

- [ ] **Step 4: Restart services and re-verify end to end**

Run: `systemctl --user restart pipewire wireplumber` then re-run Task 4 Step 4, Task 4 Step 5, and Task 5 Step 3.
Expected: same results — "Cleaned Mic" present, node not in error, clean audio captured, virtual source is default.

- [ ] **Step 5: Stow-fold pollution check**

Run: `git status --porcelain`
Expected: empty. If PipeWire/WirePlumber wrote state under the stowed dirs (non-empty status), add a targeted `.gitignore` rule for that exact subpath, commit it, and note it in the spec's risk 4.

- [ ] **Step 6: Reboot check (manual, documented)**

Note in the task record: a clean reboot is the definitive test for the first-boot default race (spec Default routing "Race note"). Ask the user to reboot at their convenience and confirm "Cleaned Mic" is still the default input and apps capture clean audio. This is a post-merge acceptance check, not a blocker for the commits above.

- [ ] **Step 7: Final state confirmation**

Run: `git log --oneline -6 && git status --porcelain`
Expected: commits for scaffolding, pkgs, filter-chain, wireplumber rule (+ any .gitignore fix) present; working tree clean.

---

## Self-Review

**Spec coverage:**
- Processing chain (mono RNNoise→HP→HS→SC4, explicit links) → Task 4.
- Generic hardware binding / `node.passive` / no device string → Task 4 Step 1+5.
- Default routing via tracked WirePlumber rule, not mutable state → Task 5.
- Packages via Makefile lists incl. `ladspa-sdk` → Task 2.
- Introspection gate before config finalization → Task 3 (hard ordering constraint stated in header).
- Stow paths + `docs` ignore → Task 1, Task 6.
- Stow-fold pollution risk + `git status` clean → Task 6 Step 5.
- Partial-install loud-failure mode → Task 4 Step 4 (error/absent path).
- Tuning param discoverability (comment header) → Task 4 Step 1.
- Reboot/first-boot race verification → Task 6 Step 6.
All spec sections mapped.

**Placeholder scan:** No "TBD"/"implement later". The only `<...>` are deliberate introspection-gated substitutions, explicitly bound to Task 3's notes file and the spec appendix — content is specified, the exact string is environment-derived by design (spec risk 1).

**Consistency:** `effect_input.cleaned-mic` node.name and "Cleaned Mic" description used identically across Tasks 4, 5, 6. Verification commands reuse the same node.name throughout.
