# .dotfiles

there are many like it, but this one is mine

## usage

clone the repo and symlink applicable configs, install tools where needed

e.g.:

```sh
ln -s ~/Projects/.dotfiles/.config/nvim ~/.config/nvim
```

add the bin folder to your path in your rc file:

```sh
PATH=~/Projects/.dotfiles/bin:$PATH
```

## nvim

- https://github.com/neovim/neovim
- https://github.com/nvim-telescope/telescope.nvim
- https://github.com/nvim-treesitter/nvim-treesitter
- https://github.com/VonHeikemen/lsp-zero.nvim
- https://github.com/nvim-lualine/lualine.nvim
- https://github.com/theprimeagen/harpoon
- https://github.com/mbbill/undotree
- https://github.com/tpope/vim-fugitive
- https://github.com/nvim-tree/nvim-tree.lua
- https://github.com/lewis6991/gitsigns.nvim
- https://github.com/LionC/nest.nvim
- https://github.com/folke/trouble.nvim
- https://github.com/folke/which-key.nvim
- https://github.com/Eandrju/cellular-automaton.nvim

### themes

- https://github.com/folke/tokyonight.nvim
- https://github.com/romgrk/doom-one.vim
- https://github.com/rose-pine/neovim

### resources

- https://github.com/mhinz/vim-galore
- https://theprimeagen.github.io/vim-fundamentals

## cli

- https://github.com/alacritty/alacritty
- https://github.com/tmux/tmux
- https://github.com/ohmyzsh/ohmyzsh
- https://github.com/romkatv/powerlevel10k
- https://github.com/zsh-users/zsh-syntax-highlighting/tree/master
- https://github.com/dylanaraps/neofetch
- https://github.com/aome510/spotify-player
- https://cli.github.com/

### tools

- https://github.com/i3/i3
- https://github.com/davatorium/rofi
- https://github.com/BurntSushi/ripgrep
- https://github.com/sharkdp/fd
- https://github.com/junegunn/fzf
- https://github.com/sharkdp/bat
- https://github.com/ogham/exa
- https://github.com/dandavison/delta
- https://github.com/flightlessmango/MangoHud
- https://github.com/linuxmint/timeshift

## browser

- https://github.com/arkenfox/user.js/
- https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/
- https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/
- https://addons.mozilla.org/en-US/firefox/addon/skip-redirect/

## general

- https://github.com/ryanoasis/nerd-fonts

## settings

disable PC speaker beep

```sh
sudo rmmod pcspkr
echo "blacklist pcspkr" | sudo tee /etc/modprobe.d/nobeep.conf
```

## instructions

- https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent
- https://docs.github.com/en/authentication/managing-commit-signature-verification/generating-a-new-gpg-key

