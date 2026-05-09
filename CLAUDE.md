# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal dotfiles deployed with GNU Stow. The repo root mirrors `$HOME` — a file at `./.zshrc` becomes `~/.zshrc`, `./.config/hypr/hyprland.conf` becomes `~/.config/hypr/hyprland.conf`. `bin/` is the one exception: it stows into `/usr/local/bin` (system-wide) rather than `$HOME`.

## Common commands

The `Makefile` is the canonical entry point — prefer `make <target>` over invoking the underlying tools directly.

- `make link` — `stow --restow` everything into `$HOME`, plus `sudo stow` `bin/` into `/usr/local/bin`. Run this after adding/renaming files at the repo root.
- `make link-delete` — remove all stow symlinks.
- `make arch-init` — full bootstrap on Arch (`arch-pkgs` + `arch-aur-pkgs` + `tpm` + `gopkgs` + `zsh` + `link` + `gsettings`).
- `make arkenfox` — fetch/refresh the arkenfox `user.js` toolchain into `~/.mozilla/firefox/user.arkenfox/` and apply it. Note the comment in the target: the Firefox profile must already exist at that path (create via `firefox -p`) before running.
- `make arkenfox-apply` — re-apply the existing arkenfox `user-overrides.js` without re-fetching the upstream toolchain.
- `make osx-packages` / `make osx-shims` — macOS equivalents of the Arch package targets.

There is no test/lint/build pipeline — this is config, not code.

## Things to know before editing

### Stow ignore list
`.stow-local-ignore` controls what stow will *not* link. If you add a top-level file that shouldn't end up in `$HOME` (docs, repo metadata, build outputs), add it there or stow will create a symlink to it.

### `bin/` is double-stowed
Files under `bin/` are linked into `/usr/local/bin` via the second `stow` invocation in the `link` target. They need to be executable and self-contained shell scripts. `bin/op-ssh-sign` is referenced from `.gitconfig` (`gpg.ssh.program`) — renaming it will break commit signing.

### Git identity is per-remote, not global
`.gitconfig` sets `user.useConfigOnly = true` and has no default `user.email`. Identity is selected via `includeIf "hasconfig:remote.*.url:..."` rules pointing at `.gitconfig.github`, `.gitconfig.codeberg`, and (untracked) `.gitconfig.work`. Consequence: in a fresh clone with no matching remote, `git commit` will refuse to run until an include matches. When adding support for a new forge, add both the `https://` and `git@` URL forms — both must be covered or one clone style will silently fall through.

### `.zshrc` sources from `scripts/`
`.zshrc` sources `scripts/funcs.sh` (shell helpers like `command_exists`, `git_main_branch`) and `scripts/aliases.sh` (the large `g*` git alias set, `k`/`d`/`dc`/`t` shortcuts). Both files run in every interactive shell — keep them fast and side-effect-free at source time. `~/work.sh` is sourced if present but is gitignored.

### Firefox config is selectively tracked
`.gitignore` excludes nearly everything under `.mozilla/firefox/` except the arkenfox toolchain inputs: `user.arkenfox/user-overrides.js` and `user.arkenfox/chrome/userChrome.css`. Don't add other files under that path expecting them to be tracked — check `.gitignore` first.

### `.claude/` in this repo == `~/.claude/`
Because of the stow layout, `.claude/CLAUDE.md` here becomes `~/.claude/CLAUDE.md` — Claude Code's user-global instructions file. Edits affect all projects on the machine, not just this repo. Only `CLAUDE.md` and `skills/` under `.claude/` are tracked (see `.gitignore`); everything else is local state.
