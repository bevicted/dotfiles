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

## tools

- [fd](https://github.com/sharkdp/fd)
- [fzf](https://github.com/junegunn/fzf)
- [mangohud](https://github.com/flightlessmango/MangoHud)
- [p10k](https://github.com/romkatv/powerlevel10k)
- [rg](https://github.com/BurntSushi/ripgrep)
- [timeshift](https://github.com/linuxmint/timeshift)

## browser

- [arkenfox](https://github.com/arkenfox/user.js/)

### Addons

- [1password](https://addons.mozilla.org/en-US/firefox/addon/1password-x-password-manager/)
- [sidebery](https://addons.mozilla.org/en-US/firefox/addon/sidebery/)
- [skip redirect](https://addons.mozilla.org/en-US/firefox/addon/skip-redirect/)
- [ublacklist](https://addons.mozilla.org/en-US/firefox/addon/ublacklist/)
- [ublock origin](https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/)
- [unpaywall](https://addons.mozilla.org/en-US/firefox/addon/unpaywall/)

#### YT

- [return dislikes](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
- [sponsorblock](https://addons.mozilla.org/en-US/firefox/addon/sponsorblock/)

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

