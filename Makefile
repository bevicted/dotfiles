UNAME_S := $(shell uname -s)

define packages
alacritty \
base-devel \
coreutils \
entr \
fd \
fzf \
git \
git-delta \
go \
jq \
kubectl \
man \
minikube \
neovim \
nodejs \
npm \
obsidian \
parallel \
podman \
python \
ripgrep \
sad \
stow \
timeshift \
tmux \
ttf-jetbrains-mono-nerd \
vim \
xorg-xrandr \
xsel \
yq \
zsh
endef

.PHONY: tpm
tpm:
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

.PHONY: link
link:
	stow --verbose --restow --target=$$HOME .
	sudo stow --verbose --restow --dir ./bin --target /usr/local/bin .
	sudo stow --verbose --restow --dir ./etc/X11/xorg.conf.d --target /etc/X11/xorg.conf.d .

.PHONY: link-delete
link-delete:
	stow --verbose --target=$$HOME --delete  sf.

.PHONY: arkenfox
arkenfox:
	$$HOME/.mozilla/firefox/user.arkenfox/updater.sh
	$$HOME/.mozilla/firefox/user.arkenfox/prefsCleaner.sh

.PHONY: arch-pkgs
arch-packages:
	sudo pacman --needed -S ${packages}

.PHONY: arch-aur-pkgs
ifeq (, $(shell command -v yay 2> /dev/null))
arch-aur-packages: arch-yay
else
arch-aur-packages:
endif
	yay -S golangci-lint

.PHONY: arch-yay
arch-yay:
	mkdir -p ~/dev/aur/
	git clone https://aur.archlinux.org/yay.git ~/dev/aur/yay
	cd ~/dev/aur/yay && makepkg -si
	yay -Y --gendb
	yay -Syu --devel
	yay -Y --devel --save

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
		podman \
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
