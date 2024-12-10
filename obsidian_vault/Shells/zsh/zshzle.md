zsh command line editor

### man

[arch man](https://man.archlinux.org/man/zshzle.1)

#### important sections

Enabled by default:

> If the **ZLE** option is set (**which it is by default in interactive shells**) and the shell input is attached to the terminal, the user is able to edit command lines.

> [!warning]
> VISUAL and EDITOR env vars control keybinds
> > In addition to these names, either `emacs` or `viins` is also linked to the name `main`.  If one of the `VISUAL` or `EDITOR` environment variables contain the string `vi` when the shell starts up then it will be `viins`, otherwise it will be `emacs`.  `bindkey`'s `-e` and `-v` options provide a convenient way to override this default choice.


