UNAME_S := $(shell uname -s)
ARKEN_TMP_REPO_PATH := /tmp/arkenfox
ARKEN_USER_PATH := ${HOME}/.mozilla/firefox/user.arkenfox

define packages
entr \
fd \
fzf \
ghostty \
git \
go \
jq \
kubectl \
man \
neovim \
nodejs \
npm \
parallel \
ripgrep \
shellcheck \
stow \
tldr \
tmux \
ttf-jetbrains-mono-nerd \
unzip \
vim \
yq \
zig \
zsh
endef

.PHONY: arch-init
arch-init: arch-pkgs arch-aur-pkgs tpm gopkgs zsh link

.PHONY: zsh
zsh:
	chsh -s '/usr/bin/zsh'

.PHONY: tpm
tpm:
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
	# <ctrl+a>I to install packages

.PHONY: link
link:
	stow --verbose --restow --target=${HOME} .
	sudo stow --verbose --restow --dir ./bin --target /usr/local/bin .
	sudo stow --verbose --restow --dir ./etc/X11/xorg.conf.d --target /etc/X11/xorg.conf.d .

.PHONY: link-delete
link-delete:
	stow --verbose --target=${HOME} --delete sf.

.PHONY: arkenfox
arkenfox:
	# currently I need to manually create the firefox profile with the USER_PATH selected as the dir
	# has to be done before this make target is ran
	# firefox -p

	rm -rf ${ARKEN_TMP_REPO_PATH}
	mkdir -p ${ARKEN_TMP_REPO_PATH}
	git clone --depth 1 --no-tags --single-branch --branch master https://github.com/arkenfox/user.js.git ${ARKEN_TMP_REPO_PATH}
	mv -f ${ARKEN_TMP_REPO_PATH}/user.js ${ARKEN_USER_PATH}
	mv -f ${ARKEN_TMP_REPO_PATH}/updater.sh ${ARKEN_USER_PATH}
	mv -f ${ARKEN_TMP_REPO_PATH}/prefsCleaner.sh ${ARKEN_USER_PATH}
	rm -rf ${ARKEN_TMP_REPO_PATH}

	${ARKEN_USER_PATH}/updater.sh
	${ARKEN_USER_PATH}/prefsCleaner.sh

.PHONY: arch-pkgs
arch-pkgs:
	sudo pacman --needed -S ${packages}
	rustup --version || curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

.PHONY: arch-aur-pkgs
ifeq (, $(shell command -v yay 2> /dev/null))
arch-aur-pkgs: arch-yay
else
arch-aur-pkgs:
endif
	yay -S 1password 1password-cli golangci-lint

.PHONY: arch-yay
arch-yay:
	mkdir -p ${HOME}/dev/aur/
	git clone https://aur.archlinux.org/yay.git ${HOME}/dev/aur/yay
	cd ${HOME}/dev/aur/yay && makepkg -si
	yay -Y --gendb
	yay -Syu --devel
	yay -Y --devel --save

.PHONY: hypr
hypr:
	sudo pacman --needed -S hyprlock hypridle swaync waybar

.PHONY: osx-packages
osx-packages:
	brew install \
		bash \
		coreutils \
		entr \
		fd \
		fzf \
		go
		jq \
		kubectl \
		neovim \
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		parallel \
		python \
		ripgrep \
		sad \
		stow \
		tmux \
		vim \
		yq \
	brew install --cask \
		alacritty \
		font-jetbrains-mono-nerd-font

.PHONY: osx-shims
osx-shims:
	# https://gist.github.com/bbqtd/a4ac060d6f6b9ea6fe3aabe735aa9d95
	# fix osx tmux colors
	curl -LO https://invisible-island.net/datafiles/current/terminfo.src.gz && gunzip terminfo.src.gz
	/usr/bin/tic -xe tmux-256color terminfo.src
	rm terminfo.src
	sudo sh -c 'echo /usr/local/opt/bash/bin/bash >> /etc/shells'

.PHONY: gopkgs
gopkgs:
	go install github.com/charmbracelet/mods@latest
	go install mvdan.cc/sh/v3/cmd/shfmt@latest
