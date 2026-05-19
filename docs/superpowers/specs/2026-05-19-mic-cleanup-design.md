# Mic cleanup via PipeWire filter-chain — design

Date: 2026-05-19
Status: approved (pending spec review)

## Problem

Onboard analog microphone (`alsa_input.pci-0000_00_1f.3.analog-stereo`)
sounds raw, harsh, and noisy. Want a cleaned-up voice input delivered
through the dotfiles, declaratively, the same way the rest of the repo
works (stow + Makefile package lists). Must remain portable across other
machines that deploy these dotfiles even though their mic hardware differs.

## Goal

A single virtual capture source — "Cleaned Mic" — produced by a PipeWire
filter-chain, automatically set as the default input so every app
(Discord, browser meets, OBS, etc.) gets the processed signal with no
per-app configuration. The raw hardware mic stays selectable.

## Non-goals

- No GUI tooling (EasyEffects rejected — leaks GUI state, less stow-pure).
- No per-app routing rules.
- No auto-tuning. Defaults are conservative; retuning is a manual edit.

## Processing chain

One filter-chain node, hardware mic → virtual source:

```
raw mic → RNNoise (denoise + VAD gate) → high-pass 90 Hz
        → high-shelf -3 dB @ 6 kHz (tame harshness)
        → SC4 compressor (level voice) → "Cleaned Mic"
```

**Mono chain.** The whole graph is mono (voice). Every node uses its
mono variant; mixing mono/stereo nodes makes the filter.graph fail to
link. `audio.channels = 1`, `audio.position = [ MONO ]` on both
`capture.props` and `playback.props`.

| Stage | filter.graph node | Notes |
|-------|-------------------|-------|
| Denoise + gate | `type = ladspa`, `plugin = "librnnoise_ladspa"`, `label = noise_suppressor_mono` | control `"VAD Threshold (%)"`; doubles as soft gate — covers "noise" + "gate" in one stage |
| Rumble/pop removal | `type = builtin`, `label = bq_highpass` | control ports `"Freq"`, `"Q"`, `"Gain"`. No dependency |
| Harshness tame | `type = builtin`, `label = bq_highshelf` | control ports `"Freq"`, `"Q"`, `"Gain"`. No dependency |
| Leveling | `type = ladspa`, `plugin = "sc4m_1916"`, `label = sc4m` | mono SC4 (`sc4m_1916.so`, audio ports `Input`/`Output`); controls `"Attack time (ms)"`, `"Release time (ms)"`, `"Threshold level (dB)"`, `"Ratio (1:n)"`, `"Knee radius (dB)"`, `"Makeup gain (dB)"`. (`sc4_1882`/`sc4` is the stereo variant — not used.) |

The chain has >1 node, so `filter.graph` **must** include an explicit
`links` array wiring stage outputs to the next stage's input (auto-link
only works for a single node). Serial order as in the diagram above.

Conservative starting params (exact values pinned during implementation
after plugin introspection — see Risks):

- RNNoise `"VAD Threshold (%)"`: ~50 (moderate gating, avoids word-clipping)
- High-pass: `"Freq"` 90, `"Q"` ~0.7
- High-shelf: `"Freq"` 6000, `"Gain"` -3, `"Q"` ~0.7
- SC4: `"Ratio (1:n)"` ~3, `"Threshold level (dB)"` ~-18,
  slow-ish attack/release, modest `"Makeup gain (dB)"`

Base the actual `.conf` on the PipeWire-shipped example
`/usr/share/pipewire/filter-chain/source-rnnoise.conf` (proven-correct
I/O props) rather than writing the node block from scratch.

## Hardware binding (portability)

Do **not** hardcode the PCI source name. No machine-specific device
string in any tracked file. The same config must work unchanged on any
machine deploying these dotfiles regardless of sound card or USB mic.

**Concrete binding pattern (committed, not deferred).** Self-capture
loop avoidance and hardware pickup use the proven shipped
`source-rnnoise.conf` pattern:

- `capture.props { node.passive = true ... }` — passive capture stream.
  It is never itself a default-eligible source and transparently rides
  the real hardware default; it does not capture the virtual source.
- `playback.props { media.class = Audio/Source ... node.name = "..." }`
  — exposes "Cleaned Mic" as a source.

This pattern is the documented-correct way; the design commits to it
rather than leaving it to the plan.

## Default input routing

The earlier draft's mechanism was wrong: `default.configured.audio.source`
is **not** a settable config key. It is runtime metadata written by
`wpctl set-default` and persisted in mutable state
(`~/.local/state/wireplumber/...`) — not stow-able, and overwritten by
WirePlumber's default-nodes logic.

Declarative, stow-pure mechanism instead: a WirePlumber SPA-JSON rule in
`51-cleaned-mic-default.conf` that biases default selection toward the
virtual source — raise the virtual node's `priority.session` and/or
exclude physical `Audio/Source` nodes (`device.api = alsa`) from being
chosen as the configured default, so apps only ever land on "Cleaned
Mic". The raw mic stays manually selectable. Exact rule keys are pinned
in the implementation plan against the installed WirePlumber 0.5.x;
the *requirement* is: default routing is achieved by a tracked config
file, never by mutable runtime state.

Race note: on first boot the virtual source may not exist when defaults
are first computed. Verify post-install (and after a clean reboot, not
just a service restart) that apps default to "Cleaned Mic" and the chain
captures hardware audio (no feedback loop).

## Files added to the repo

| Repo path | Stows to | Purpose |
|-----------|----------|---------|
| `.config/pipewire/pipewire.conf.d/99-input-denoise.conf` | `~/.config/pipewire/pipewire.conf.d/` | filter-chain node defining the virtual source + processing graph |
| `.config/wireplumber/wireplumber.conf.d/51-cleaned-mic-default.conf` | `~/.config/wireplumber/wireplumber.conf.d/` | set "Cleaned Mic" as the default audio input |

Both live under `.config/`, which stows normally — no `.stow-local-ignore`
change needed for them. (`docs` was added to `.stow-local-ignore` so this
spec directory is not symlinked into `$HOME`.)

## Packages added

| Package | Repo file | Reason |
|---------|-----------|--------|
| `noise-suppression-for-voice` | `pkgs/aur` | provides `librnnoise_ladspa.so` (RNNoise LADSPA) |
| `swh-plugins` | `pkgs/pacman` | provides SC4 compressor LADSPA (mono `sc4m_1916.so`) |
| `ladspa` | `pkgs/pacman` | provides `analyseplugin` (note British spelling — Arch package is `ladspa`, not Debian's `ladspa-sdk`) for the mandatory label/port introspection step |

Package-list files are newline-separated and consumed via `$(shell cat)`
in the Makefile — **no `#` comments** (a comment line would be passed to
`pacman`/`yay` as a package name). Append plain package names only.

Picked up automatically by `make aur` / `make pacman` (Makefile builds the
package lists from these files via `cat` — no Makefile edit required).

## Activation

After `make link` + package install:

```
systemctl --user restart pipewire wireplumber
```

(or relog). The restart is synchronous from the shell's view, but app
audio re-enumeration is not instant — already-running apps (Discord etc.)
must be restarted or re-pick the input to see "Cleaned Mic". A clean
reboot is the most representative test (covers the first-boot default
race). Raw hardware mic remains selectable in `pavucontrol` / app
settings.

If only one of the two plugin packages installed, the filter-chain node
fails to load entirely → "Cleaned Mic" never appears and the (now
default-biased) routing has no target. Failure mode is loud, not silent:
no virtual source in `wpctl status`. Mitigation = the post-install
verification step below; do not assume success.

## Tuning later

Every parameter (VAD threshold, EQ frequencies/gains, compressor
ratio/attack/release/makeup) is a plain number in
`99-input-denoise.conf`. The committed config must carry an inline
comment header naming each control port and unit (param names like
`"VAD Threshold (%)"` are not guessable), so retuning is edit-a-number
not reverse-engineer-the-graph. Edit, restart the user services, done.
Defaults are portable and conservative; "optimal" values are mic/room
specific and intentionally left to manual tweaking. A skeleton template
is in the appendix — exact strings filled from introspection during
implementation.

## Risks and mitigations

1. **LADSPA name drift (config won't load).** The filter-chain config
   references plugins by exact strings: the `.so` filename, the plugin
   **label** inside it (e.g. `noise_suppressor_mono` vs
   `noise_suppressor_stereo`), and **control port names** (e.g.
   `"VAD Threshold (%)"`). These differ between builds/versions of
   `noise-suppression-for-voice` and `swh-plugins`. A wrong string makes
   the whole filter-chain node fail to load → no "Cleaned Mic" source
   (mic effectively missing — visible and fast to diagnose, not silent
   long-term).
   - **Mitigation (mandatory implementation step):** after installing the
     packages, introspect the actual labels/control ports —
     `analyseplugin` (from `ladspa`) on `librnnoise_ladspa.so` and on
     `sc4m_1916.so` (mono variant), cross-checked against the shipped
     `/usr/share/pipewire/filter-chain/source-rnnoise.conf` — and write
     the *verified* exact strings into the config. Do not guess. The
     implementation plan must gate config-finalization on this
     introspection.
   - **Recovery (documented):** if a future package update renames a
     port, mic disappears; re-run `analyseplugin`, fix the string,
     restart user services.

2. **Hardware-default binding edge cases.** If no hardware mic is present
   at service start, or default selection races, the chain may fail to
   link. Mitigation: verify post-install that the chain captures hardware
   audio and that apps see the virtual source as default; document the
   restart command as the standard fix.

3. **Tuning not portable.** Gate/EQ tuned for this harsh onboard mic may
   be suboptimal on a different mic on another machine. Accepted:
   defaults are conservative and safe; retuning is a single-file edit.

4. **Stow whole-dir folding pollutes the repo.** `~/.config/pipewire`
   and `~/.config/wireplumber` don't exist yet, so `make link` folds
   them into single symlinks pointing at the repo dirs. If any tool
   later writes generated state under those paths, the writes land
   inside the git working tree via the symlink. Mitigation: PipeWire
   reads `*.conf.d/` and writes runtime state to `/run`; WirePlumber
   writes state to `~/.local/state` — so this should not happen. Verify
   (see below). If state ever appears, add a targeted `.gitignore` rule.

## Verification (post-implementation)

- `pw-cli ls Node` / `wpctl status` shows the "Cleaned Mic" source and it
  is the configured default input.
- Filter-chain node is in the `running` state (not `error`).
- Recording a test clip through the default input shows audible noise
  reduction vs the raw source.
- Config contains no machine-specific device string (portability check).
- `git status` clean after `systemctl --user restart pipewire
  wireplumber` and after a reboot (stow-fold pollution check).
- Routing achieved purely by tracked config — no reliance on
  `~/.local/state/wireplumber` mutable state.

## Appendix: config skeleton (strings filled at implementation)

Derived from `/usr/share/pipewire/filter-chain/source-rnnoise.conf`.
Plugin labels/ports below are the VERIFIED strings from
`analyseplugin` (Task 3, `/tmp/mic-cleanup-introspect.txt`):
- RNNoise mono: `librnnoise_ladspa` label `noise_suppressor_mono`,
  audio ports `Input`/`Output`, control `"VAD Threshold (%)"` (0–99).
- SC4 mono: `sc4m_1916` label `sc4m`, audio ports `Input`/`Output`
  (the stereo `sc4_1882`/`sc4` is NOT used in a mono chain).
- Builtin biquad: labels `bq_highpass`/`bq_highshelf`, audio ports
  `In`/`Out`, controls `"Freq"`/`"Q"`/`"Gain"`.

```
# ~/.config/pipewire/pipewire.conf.d/99-input-denoise.conf
# Mono voice cleanup chain. Tunable params flagged [TUNE].
context.modules = [
  { name = libpipewire-module-filter-chain
    args = {
      node.description = "Cleaned Mic"
      media.name       = "Cleaned Mic"
      filter.graph = {
        nodes = [
          # [TUNE] "VAD Threshold (%)" : 0..99, higher = more gating
          { type = ladspa  plugin = "librnnoise_ladspa"
            label = noise_suppressor_mono  name = rnnoise
            control = { "VAD Threshold (%)" = 50.0 } }
          # [TUNE] "Freq" Hz high-pass
          { type = builtin label = bq_highpass name = hp
            control = { "Freq" = 90.0 "Q" = 0.7 } }
          # [TUNE] "Gain" dB cut to tame harshness
          { type = builtin label = bq_highshelf name = hs
            control = { "Freq" = 6000.0 "Q" = 0.7 "Gain" = -3.0 } }
          # [TUNE] SC4 mono leveling
          { type = ladspa  plugin = "sc4m_1916"  label = sc4m  name = comp
            control = { "Ratio (1:n)" = 3.0 "Threshold level (dB)" = -18.0
                        "Makeup gain (dB)" = 6.0 } }
        ]
        links = [
          { output = "rnnoise:Output" input = "hp:In" }
          { output = "hp:Out"          input = "hs:In" }
          { output = "hs:Out"          input = "comp:Input" }
        ]
      }
      capture.props  = { node.passive = true
                         audio.channels = 1  audio.position = [ MONO ] }
      playback.props = { media.class = Audio/Source
                         node.name = "effect_input.cleaned-mic"
                         audio.channels = 1  audio.position = [ MONO ] }
    }
  }
]
```
