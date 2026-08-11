SHELL = /usr/bin/env bash

ARKEN_TMP_REPO_PATH := /tmp/arkenfox
ARKEN_USER_PATH := $(HOME)/.mozilla/firefox/user.arkenfox
LOCAL_BIN_PATH := $(HOME)/.local/bin

COMMON_PKGS := $(shell cat pkgs/common)
ARCH_PKGS   := $(COMMON_PKGS) $(shell cat pkgs/pacman)
HYPR_PKGS   := $(shell cat pkgs/pacman-hypr)
NVIDIA_PKGS := $(shell cat pkgs/pacman-nvidia)
BREW_PKGS   := $(COMMON_PKGS) $(shell cat pkgs/brew)
BREW_CASKS  := $(shell cat pkgs/brew-cask)
AUR_PKGS    := $(shell cat pkgs/aur)
GAMING_PKGS := $(shell cat pkgs/pacman-gaming)
AUR_GAMING_PKGS := $(shell cat pkgs/aur-gaming)
GO_PKGS     := $(shell cat pkgs/go)

PACMAN_INSTALL := sudo pacman --needed -S
YAY_INSTALL    := yay --needed --answerclean None --answerdiff None -S

.PHONY: self-installers
self-installers:
	command -v rustup >/dev/null 2>&1 || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

.PHONY: arch-init
arch-init: self-installers pacman aur tpm go-install zsh link agents gsettings

# herdr (terminal workspace manager), pi (coding agent), plannotator
# (annotate/review UI). Each ships an installer that drops a binary in
# ~/.local/bin and self-updates afterwards, so only a missing one is fetched.
# pi needs the nodejs/npm from pkgs/common, hence the ordering after `pacman`.
# opencode is packaged (pacman extra + homebrew core) so it rides pkgs/common
# instead; only its herdr integration is wired here.
#
# plannotator needs a per-agent plugin on top of its binary. Claude Code's is
# declared in .claude/settings.json and opencode's in .config/opencode/
# opencode.jsonc, both tracked here. Pi's cannot be: `pi install` writes to
# ~/.pi/agent/settings.json, which also holds mutable state (theme,
# lastChangelogVersion), and only *project* settings auto-install missing
# packages on startup. Hence the one imperative line; it is idempotent.
#
# Must run AFTER `link`: ~/.claude is a stow symlink into this repo, and both
# the plannotator installer and `herdr integration install` write there. Run
# before `link` they would create real files under ~/.claude and stow would
# then refuse to link .claude/settings.json.
.PHONY: agents
agents:
	command -v herdr >/dev/null 2>&1 || curl -fsSL https://herdr.dev/install.sh | sh
	command -v pi >/dev/null 2>&1 || curl -fsSL https://pi.dev/install.sh | sh
	command -v plannotator >/dev/null 2>&1 || curl -fsSL https://plannotator.ai/install.sh | bash -s -- --non-interactive
	herdr integration install claude
	herdr integration install pi
	herdr integration install opencode
	pi install npm:@plannotator/pi-extension

.PHONY: pacman
pacman:
	$(PACMAN_INSTALL) $(ARCH_PKGS)

.PHONY: aur
aur:
	command -v yay >/dev/null 2>&1 || $(MAKE) yay
	$(YAY_INSTALL) $(AUR_PKGS)

.PHONY: yay
yay:
	mkdir -p $(HOME)/dev/aur/
	git clone https://aur.archlinux.org/yay.git $(HOME)/dev/aur/yay
	cd $(HOME)/dev/aur/yay && makepkg -si
	yay -Y --gendb
	yay -Syu --devel
	yay -Y --devel --save

.PHONY: hypr
hypr:
	$(PACMAN_INSTALL) $(HYPR_PKGS)

# https://wiki.hypr.land/Nvidia/
# Open kernel modules (nvidia-open-dkms) — recommended for Turing/Ampere+ (16xx, 20xx, and later).
# Required for 50xx series. Arch handles /etc/modprobe.d/nvidia.conf (modeset=1),
# suspend services, and NVreg_PreserveVideoMemoryAllocations kernel param.
.PHONY: hypr-nvidia
hypr-nvidia:
	$(PACMAN_INSTALL) $(NVIDIA_PKGS)
	sudo sed -i -E '/nvidia_drm/! s/^MODULES=\(\)/MODULES=(nvidia nvidia_modeset nvidia_uvm nvidia_drm)/; /nvidia_drm/! s/^MODULES=\((.+)\)/MODULES=(\1 nvidia nvidia_modeset nvidia_uvm nvidia_drm)/' /etc/mkinitcpio.conf
	sudo mkinitcpio -P
	@echo
	@echo "Reboot, then verify: cat /sys/module/nvidia_drm/parameters/modeset (expect Y)"

.PHONY: gaming
gaming:
	$(PACMAN_INSTALL) $(GAMING_PKGS)
	$(YAY_INSTALL) $(AUR_GAMING_PKGS)

.PHONY: docker-setup
docker-setup:
	sudo systemctl enable --now docker.service
	sudo usermod -aG docker $(USER)
	@echo
	@echo "Log out and back in (or run 'newgrp docker') for group change to take effect."

.PHONY: gsettings
gsettings:
	gsettings set org.gnome.desktop.interface color-scheme 'prefer-dark'

.PHONY: zsh
zsh:
	chsh -s '/usr/bin/zsh'

# After cloning, press <ctrl+a>I in tmux to install plugins.
.PHONY: tpm
tpm:
	git clone https://github.com/tmux-plugins/tpm ~/.config/tmux/plugins/tpm

.PHONY: go-install
go-install:
	for pkg in $(GO_PKGS); do go install "$$pkg" || exit 1; done

.PHONY: link
link:
	stow --verbose --restow --target=$(HOME) .
	mkdir -p $(LOCAL_BIN_PATH)
	stow --verbose --restow --dir ./bin --target $(LOCAL_BIN_PATH) .
	$(MAKE) allowed-signers

# Assemble ~/.ssh/allowed_signers from the tracked public entries plus an
# optional local .work file (gitignored). Result is a plain file, not a stow
# symlink, so `cat >>` from per-machine setup stays safe across `make link`.
.PHONY: allowed-signers
allowed-signers:
	cat $(HOME)/.ssh/allowed_signers.public > $(HOME)/.ssh/allowed_signers
	[ -f $(HOME)/.ssh/allowed_signers.work ] && cat $(HOME)/.ssh/allowed_signers.work >> $(HOME)/.ssh/allowed_signers || true

.PHONY: link-delete
link-delete:
	stow --verbose --target=$(HOME) --delete .
	stow --verbose --dir ./bin --target $(LOCAL_BIN_PATH) --delete .

# One-time cleanup for systems linked before bin moved to ~/.local/bin.
.PHONY: link-delete-legacy-bin
link-delete-legacy-bin:
	sudo stow --verbose --dir ./bin --target /usr/local/bin --delete .

# Firefox profile must already exist at $(ARKEN_USER_PATH) before running.
# Create it via: firefox -p
.PHONY: arkenfox
arkenfox:
	rm -rf $(ARKEN_TMP_REPO_PATH)
	mkdir -p $(ARKEN_TMP_REPO_PATH)
	git clone --depth 1 --no-tags --single-branch --branch master https://github.com/arkenfox/user.js.git $(ARKEN_TMP_REPO_PATH)
	mv -f $(ARKEN_TMP_REPO_PATH)/user.js $(ARKEN_USER_PATH)
	mv -f $(ARKEN_TMP_REPO_PATH)/updater.sh $(ARKEN_USER_PATH)
	mv -f $(ARKEN_TMP_REPO_PATH)/prefsCleaner.sh $(ARKEN_USER_PATH)
	rm -rf $(ARKEN_TMP_REPO_PATH)
	$(MAKE) arkenfox-apply

.PHONY: arkenfox-apply
arkenfox-apply:
	$(ARKEN_USER_PATH)/updater.sh -s -u
	$(ARKEN_USER_PATH)/prefsCleaner.sh -s

.PHONY: brew
brew:
	command -v brew >/dev/null 2>&1 || /bin/bash -c "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
	brew update
	brew upgrade
	brew install $(BREW_PKGS)
	brew install --cask $(BREW_CASKS)
	brew tap hashicorp/tap
	brew install hashicorp/tap/terraform

# https://gist.github.com/bbqtd/a4ac060d6f6b9ea6fe3aabe735aa9d95
# Fix osx tmux colors.
.PHONY: osx-shims
osx-shims:
	curl -LO https://invisible-island.net/datafiles/current/terminfo.src.gz && gunzip terminfo.src.gz
	/usr/bin/tic -xe tmux-256color terminfo.src
	rm terminfo.src
	sudo sh -c 'echo /usr/local/opt/bash/bin/bash >> /etc/shells'
