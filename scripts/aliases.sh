#!/usr/bin/env bash

alias c='claude --worktree'
alias d='docker'
alias dc='docker compose'
alias e='$EDITOR .'
alias k='kubectl'
alias o='xdg-open'
alias p='podman'
alias t='terraform'

if ls --version &>/dev/null; then
    alias lsa='ls --almost-all --color --classify --group-directories-first --human-readable -1 --time-style=long-iso'
elif gls --version &>/dev/null; then
    alias lsa='gls --almost-all --color --classify --group-directories-first --human-readable -1 --time-style=long-iso'
else
    alias lsa='ls -AFGh1'
fi

# git

alias g='git'
alias ga='git add'
alias gb='git branch -vv'
alias gbg='LANG=C git branch -vv | grep ": gone\]"'
alias gbgD='LANG=C git branch --no-color -vv | grep ": gone\]" | cut -c 3- | awk '\''{print $1}'\'' | xargs git branch -D'
alias gbgd='LANG=C git branch --no-color -vv | grep ": gone\]" | cut -c 3- | awk '\''{print $1}'\'' | xargs git branch -d'
alias gbi='git bisect'
alias gbib='git bisect bad'
alias gbig='git bisect good'
alias gbir='git bisect reset'
alias gbis='git bisect start'
alias gbl='git blame -wCCC'
alias gc='git commit --verbose --signoff'
alias gcl='git clone --recurse-submodules'
alias gclean='git clean --interactive -d'
alias gco='git checkout'
alias gcom='git checkout $(git_main_branch)'
alias gcp='git cherry-pick'
alias gd='git diff'
alias gdm='git diff $(git_main_branch)'
alias gf='git fetch'
alias gfa='git fetch --all --prune --jobs=10'
alias gl='git log --stat'
alias glg='git log --graph --pretty="%Cred%h%Creset -%C(auto)%d%Creset %s %Cgreen(%ar) %C(bold blue)<%an>%Creset"'
alias glga='git log --graph --pretty="%Cred%h%Creset -%C(auto)%d%Creset %s %Cgreen(%ar) %C(bold blue)<%an>%Creset" --all'
alias glp='git log --stat --patch'
alias gm='git merge'
alias gmm='git merge $(git_main_branch)'
alias gmom='git merge origin/$(git_main_branch)'
alias gmum='git merge upstream/$(git_main_branch)'
alias gp='git push -v'
alias gpF='git push -v --force-with-lease --force-if-includes'
alias gpl='git pull'
alias grb='git rebase'
alias grbm='git rebase $(git_main_branch)'
alias grbom='git rebase origin/$(git_main_branch)'
alias grbum='git rebase upstream/$(git_main_branch)'
alias gre='git reset'
alias grf='git reflog'
alias grm='git rm'
alias grt='cd "$(git rev-parse --show-toplevel || echo .)"'
alias grv='git revert'
alias gs='git status --short --branch'
alias gst='git stash'
alias gt='git tag'
alias gtfo='git checkout origin/$(git_main_branch) -- '
alias gwipe='git reset --hard && git clean --force -df'

# gw completion: own subcommands on the first word, then hand off to git's
# native `git worktree` completer (branches, paths, flags) for the rest.
if [[ -n "${ZSH_VERSION:-}" ]]; then
	_gw() {
		local -a subcmds=(
			'add:create worktree + branch <suffix>, jump in'
			'rm:remove worktree <suffix>, kill its tmux session'
			'remove:remove worktree <suffix>, kill its tmux session'
			'prune:prune stale worktrees + kill their dead tmux sessions'
			'ls:list worktrees'
			'list:list worktrees'
			'sess:fzf-pick a worktree and sessionize it'
			'sessionize:fzf-pick a worktree and sessionize it'
			'mv:move worktree <src> <dst>'
			'move:move worktree <src> <dst>'
			'lock:lock worktree <suffix>'
			'unlock:unlock worktree <suffix>'
		)
		if (( CURRENT == 2 )); then
			_describe -t commands 'gw command' subcmds
			return
		fi
		case "${words[2]}" in
			sess|sessionize|ls|list) return ;;
		esac
		# Rewrite the line as `git worktree <cmd> ...` and defer to _git.
		words=(git worktree "${words[@]:1}")
		(( CURRENT += 1 ))
		_git
	}
	compdef _gw gw
fi
