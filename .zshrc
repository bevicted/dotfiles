ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"
[ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
[ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "${ZINIT_HOME}/zinit.zsh"

# p10k
zinit ice depth=1; zinit light romkatv/powerlevel10k

## Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
## Initialization code that may require console input (password prompts, [y/n]
## confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

## To customize prompt, run `p10k configure` or edit ~/.p10k.zsh.
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

# Completion
zinit light zsh-users/zsh-completions
autoload -U compinit && compinit
zstyle ':completion.*' matcher-list 'm:{a-z}={A-Za-z}'
# set list-colors to enable filename colorizing
zstyle ':completion.*' list-colors "${(s.:.)LS_COLORS}"
zinit cdreplay -q

# Funcs
command_exists() {
    command -v "$1" &> /dev/null
    return $?
}

alias_command_if_exists() {
  if command_exists "${2%% *}"
  then
    alias "$1"="$2"
  fi
}

# fzf
if command_exists 'fzf'
then
  # need to be loaded after compinit but before widget wrappers, such as zsh-autosuggestions
  zinit light Aloxaf/fzf-tab

  # disable sort when completing `git checkout`
  zstyle ':completion:*:git-checkout:*' sort false
  # set descriptions format to enable group support
  # NOTE: don't use escape sequences here, fzf-tab will ignore them
  zstyle ':completion:*:descriptions' format '[%d]'
  # set list-colors to enable filename colorizing
  zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
  # force zsh not to show completion menu, which allows fzf-tab to capture the unambiguous prefix
  zstyle ':completion:*' menu no
  # preview directory's content
  zstyle ':fzf-tab:complete:(cd|cat):*' fzf-preview 'ls --almost-all --color --classify --group-directories-first $realpath'
  # switch group using `<` and `>`
  zstyle ':fzf-tab:*' switch-group '<' '>'
  zstyle ':fzf-tab:*' fzf-bindings 'ctrl-y:accept'

  eval "$(fzf --zsh)"
fi

# Autosuggest
zinit light zsh-users/zsh-autosuggestions
bindkey '^y' autosuggest-accept
# Syntax Highlight
zinit light zsh-users/zsh-syntax-highlighting

# Keybinds
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward

# ZSH options
## History
HISTSIZE=5000
SAVEHIST=$HISTSIZE
HISTFILE=~/.zsh_history
HISTDUP=erase
setopt APPEND_HISTORY
setopt SHARE_HISTORY
setopt HIST_IGNORE_SPACE
setopt HIST_IGNORE_DUPS
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_SAVE_NO_DUPS
setopt HIST_FIND_NO_DUPS

## Other
setopt globdots

# Aliases
## snippets
zinit snippet OMZP::git

## Shortcuts
alias p='podman'
alias k='kubectl'
alias t='terraform'
alias v='nvim .'
alias ls='ls --almost-all --color --classify --group-directories-first --human-readable -1 --time-style=long-iso'
alias ic='ibmcloud'
alias iks='ic ks'

## Tool replacements
alias_command_if_exists 'docker' 'podman'
alias_command_if_exists 'vim' 'nvim'
alias_command_if_exists 'grep' 'rg'
alias_command_if_exists 'find' 'fd'
alias_command_if_exists 'find' 'fdfind'

# Vars
export VISUAL=nvim
export EDITOR=nvim
export GPG_TTY="${tty}"

# Work
if [ -f "$HOME/work.sh" ]; then
    source "$HOME/work.sh"
fi

# PATH
if [[ "$OSTYPE" == "darwin"* ]]
then
  # Make all GNU flavor commands available, may override same-name BSD flavor commands
  # For x86 Mac
  export PATH="/usr/local/opt/coreutils/libexec/gnubin:${PATH}"
  export MANPATH="/usr/local/opt/coreutils/libexec/gnuman:${MANPATH}"

  # For M1 Mac
  # export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:${PATH}"
  # export MANPATH="/opt/homebrew/opt/coreutils/libexec/gnuman:${MANPATH}"
fi

# Pop me into tmux if it exists, current shell is interactive and is not already inside tmux
if command_exists 'tmux' && \
  [ -n "$PS1" ] && \
  [[ ! "$TERM" =~ screen ]] && \
  [[ ! "$TERM" =~ tmux ]] && \
  [ -z "$TMUX" ]
then
  exec tmux
fi

