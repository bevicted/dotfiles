.PHONY: arch-packages
arch-packages:
	sudo pacman -S \
		zsh \
		git \
		xorg-xrandr \
		man \
		stow \
		vim \
		neovim \
		tmux \
		ripgrep \
		fzf \
		timeshift \
		alacritty \
		ttf-jetbrains-mono-nerd \
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		go

.PHONY: stow
stow:
	stow -t "${HOME}" .
	sudo stow -d ./bin -t "/usr/local/bin" .

