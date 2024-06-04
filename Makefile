.PHONY: arch-packages
arch-packages:
	sudo pacman -S \
		zsh \
		git \
		xorg-zrandr \
		man \
		stow \
		alacritty

.PHONY: stow
stow:
	stow -t "${HOME}" .

