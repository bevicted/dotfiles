.PHONY: arch-packages
arch-packages:
	sudo pacman -S \
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
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		obisidian \
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

.PHONY: arch-aur-packages
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
		coreutils \
		bash \
		stow \
		vim \
		neovim \
		tmux \
		ripgrep \
		fzf \
		fd \
		sad \
		entr \
		parallel \
		jq \
		yq \
		git-delta \
		podman \
		kubectl \
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		python \
		go
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

.PHONY: common
common:
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

.PHONY: link
link:
	stow -t "${HOME}" .
	sudo stow -d ./bin -t /usr/local/bin .
	sudo stow -d ./etc/X11/xorg.conf.d -t /etc/X11/xorg.conf.d .

