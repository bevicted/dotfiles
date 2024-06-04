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
		ripgrep \
		fzf \
		alacritty \
		ttf-jetbrains-mono-nerd \
		nodejs \ # needed for some Mason LSPs
		npm \ # needed for some Mason LSPs
		go

.PHONY: stow
stow:
	stow -t "${HOME}" .

