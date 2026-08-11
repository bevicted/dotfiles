# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Personal dotfiles deployed with GNU Stow. The repo root mirrors `$HOME` - a file at `./.zshrc` becomes `~/.zshrc`, `./.config/hypr/hyprland.conf` becomes `~/.config/hypr/hyprland.conf`. `bin/` is stowed separately into `~/.local/bin`.

## Common commands

The `Makefile` is the canonical entry point — prefer `make <target>` over invoking the underlying tools directly.

- `make link` - `stow --restow` everything into `$HOME`, including a separate `bin/` package into `~/.local/bin`. Run this after adding/renaming files at the repo root.
- `make link-delete` - remove all current stow symlinks.
- `make link-delete-legacy-bin` - remove the old `bin/` links from `/usr/local/bin`. Run this once on systems that used the previous system-wide target.
- `make arch-init` — full bootstrap on Arch (`self-installers` + `pacman` + `aur` + `tpm` + `go-install` + `zsh` + `link` + `agents` + `gsettings`).
- `make agents` — install the herdr + pi + plannotator stack via their own installers, then wire herdr's agent-state integrations for claude, pi, and opencode plus plannotator's pi extension. Ordered after `link` in `arch-init` on purpose; see the target comment. opencode itself comes from `pkgs/common`, not from an installer.
- `make arkenfox` — fetch/refresh the arkenfox `user.js` toolchain into `~/.mozilla/firefox/user.arkenfox/` and apply it. Note the comment in the target: the Firefox profile must already exist at that path (create via `firefox -p`) before running.
- `make arkenfox-apply` — re-apply the existing arkenfox `user-overrides.js` without re-fetching the upstream toolchain.
- `make osx-packages` / `make osx-shims` — macOS equivalents of the Arch package targets.

There is no test/lint/build pipeline — this is config, not code.

## Things to know before editing

### Stow ignore list
`.stow-local-ignore` controls what stow will *not* link. If you add a top-level file that shouldn't end up in `$HOME` (docs, repo metadata, build outputs), add it there or stow will create a symlink to it.

### `bin/` is stowed separately
Files under `bin/` are linked into `~/.local/bin` via the second `stow` invocation in the `link` target. They need to be executable and self-contained shell scripts. `bin/op-ssh-sign` is referenced from `.gitconfig` (`gpg.ssh.program`) - renaming it will break commit signing.

### Git identity is per-remote, not global
`.gitconfig` sets `user.useConfigOnly = true` and has no default `user.email`. Identity is selected via `includeIf "hasconfig:remote.*.url:..."` rules pointing at `.gitconfig.github`, `.gitconfig.codeberg`, and (untracked) `.gitconfig.work`. Consequence: in a fresh clone with no matching remote, `git commit` will refuse to run until an include matches. When adding support for a new forge, add both the `https://` and `git@` URL forms — both must be covered or one clone style will silently fall through.

### `.zshrc` sources from `scripts/`
`.zshrc` sources `scripts/funcs.sh` (shell helpers like `command_exists`, `git_main_branch`) and `scripts/aliases.sh` (the large `g*` git alias set, `k`/`d`/`dc`/`t` shortcuts). Both files run in every interactive shell — keep them fast and side-effect-free at source time. `~/work.sh` is sourced if present but is gitignored.

### Firefox config is selectively tracked
`.gitignore` excludes nearly everything under `.mozilla/firefox/` except the arkenfox toolchain inputs: `user.arkenfox/user-overrides.js` and `user.arkenfox/chrome/userChrome.css`. Don't add other files under that path expecting them to be tracked — check `.gitignore` first.

### Global agent instructions
`.config/agents/AGENTS.md` is the canonical user-global instruction file. Agent harnesses do not yet share one global lookup path, so tracked relative symlinks expose it at each supported location:

- `.claude/CLAUDE.md` for Claude Code
- `.config/opencode/AGENTS.md` for opencode
- `.pi/agent/AGENTS.md` for pi
- `.codex/AGENTS.md` for Codex

Edit only the canonical file. Keep the symlinks relative so they remain portable when stowed.

### `.claude/` in this repo == `~/.claude/`
Because of the stow layout, `.claude/CLAUDE.md` here becomes Claude Code's user-global instructions file. Only `CLAUDE.md`, `settings.json`, `statusline.sh`, `commands/`, and selected `skills/` content under `.claude/` are tracked (see `.gitignore`); everything else is local state.

`~/.claude` is the stow symlink itself, so anything that writes into it lands in this working tree. `make agents` does exactly that: the plannotator installer drops `skills/plannotator-*` (gitignored - installer output), and `herdr integration install claude` writes `hooks/herdr-agent-state.sh` (gitignored) plus a `SessionStart` hook block into the *tracked* `settings.json`. That block holds an absolute `$HOME` path, so a first bootstrap on a new machine rewrites it; commit or discard the diff deliberately.

### Where each agent's plannotator plugin is declared
plannotator's binary is one thing, its per-agent plugin another. Claude Code's lives in `.claude/settings.json` (`enabledPlugins` + `extraKnownMarketplaces`), opencode's in `.config/opencode/opencode.jsonc` (`plugin` array; opencode installs it into `~/.cache/opencode/packages/` on startup). Both are tracked, so a fresh `make link` is enough.

Pi's is not trackable. `pi install` records packages in `~/.pi/agent/settings.json`, which also holds state pi rewrites on its own (`theme`, `lastChangelogVersion`), and pi only auto-installs missing packages for *project* settings, not user settings. So `make agents` runs `pi install npm:@plannotator/pi-extension` instead.
