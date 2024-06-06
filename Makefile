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
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

.PHONY: link
link:
	stow -t "${HOME}" .
	sudo stow -d ./bin -t "/usr/local/bin" .
	sudo ln -s /home/bevicted/dev/dotfiles/usr/etc/X11/xorg.conf.d/10-extensions.conf /etc/X11/xorg.conf.d

