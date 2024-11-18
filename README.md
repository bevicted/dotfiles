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

## Docs

links to docs I find myself revisiting

- [archwiki](https://archlinux.org)
  - [Display Power Management Signaling](https://wiki.archlinux.org/title/Display_Power_Management_Signaling)

## cli

- https://github.com/romkatv/powerlevel10k

### tools

- https://github.com/BurntSushi/ripgrep
- https://github.com/sharkdp/fd
- https://github.com/junegunn/fzf
- https://github.com/sharkdp/bat
- https://github.com/flightlessmango/MangoHud
- https://github.com/linuxmint/timeshift

## browser

- https://github.com/arkenfox/user.js/
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

