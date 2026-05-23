SHELL = /usr/bin/env bash

ARKEN_TMP_REPO_PATH := /tmp/arkenfox
ARKEN_USER_PATH := $(HOME)/.mozilla/firefox/user.arkenfox

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

.PHONY: self-installers
self-installers:
	command -v rustup >/dev/null 2>&1 || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

.PHONY: arch-init
arch-init: self-installers pacman aur tpm go-install zsh link gsettings

.PHONY: pacman
pacman:
	$(PACMAN_INSTALL) $(ARCH_PKGS)

.PHONY: aur
aur:
	command -v yay >/dev/null 2>&1 || $(MAKE) yay
	yay --needed -S $(AUR_PKGS)

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
	yay --needed -S $(AUR_GAMING_PKGS)

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
	sudo stow --verbose --restow --dir ./bin --target /usr/local/bin .

.PHONY: link-delete
link-delete:
	stow --verbose --target=$(HOME) --delete .
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
