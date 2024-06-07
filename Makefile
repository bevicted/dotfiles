.PHONY: arch-packages
arch-packages:
	sudo pacman -S \
		zsh \
		git \
		xorg-xrandr \
		coreutils \
		xsel \
		man \
		stow \
		vim \
		neovim \
		tmux \
		ripgrep \
		fzf \
		fd \
		timeshift \
		alacritty \
		ttf-jetbrains-mono-nerd \
		git-delta \
		podman \
		kubectl \
		minikube \
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		python \
		go

.PHONY: osx-packages
osx-packages:
	brew install \
		coreutils \
		stow
	brew install --cask \
		font-jetbrains-mono-nerd-font

.PHONY: osx-shims
osx-shims:
	# https://gist.github.com/bbqtd/a4ac060d6f6b9ea6fe3aabe735aa9d95
	# fix osx tmux colors
	curl -LO https://invisible-island.net/datafiles/current/terminfo.src.gz && gunzip terminfo.src.gz
	/usr/bin/tic -xe tmux-256color terminfo.src
	rm terminfo.src

.PHONY: common
common:
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

.PHONY: link
link:
	stow -t "${HOME}" .
	sudo stow -d ./bin -t /usr/local/bin .
	sudo stow -d ./etc/X11/xorg.conf.d -t /etc/X11/xorg.conf.d .

