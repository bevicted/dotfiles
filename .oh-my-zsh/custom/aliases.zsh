#!/usr/bin/env zsh

# tool replacements
alias_command_if_exists 'vim' 'nvim'
alias_command_if_exists 'ls' 'exa --long --classify --all --group-directories-first --binary --time-style=long-iso'
alias_command_if_exists 'cat' 'bat --paging=never'
alias_command_if_exists 'cat' 'batcat --paging=never'
alias_command_if_exists 'grep' 'rg'
alias_command_if_exists 'find' 'fd'
alias_command_if_exists 'find' 'fdfind'

# shortcuts
alias ic='ibmcloud'
alias v='nvim .'
alias c='code .'

