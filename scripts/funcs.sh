#!/usr/bin/env bash

command_exists() {
    command -v "$1" &>/dev/null
    return $?
}

alias_command_if_exists() {
    if command_exists "${2%% *}"; then
        alias "$1"="$2"
    fi
}

git_main_branch() {
    command git rev-parse --git-dir &>/dev/null || return
    local ref
    for ref in refs/{heads,remotes/{origin,upstream}}/{main,trunk,mainline,default,stable,master}; do
        if command git show-ref -q --verify "${ref}"; then
            echo "${ref:t}"
            return 0
        fi
    done
    echo master
    return 1
}

gbmv() {
    if [[ -z "$1" || -z "$2" ]]; then
        echo "Usage: $0 old_branch new_branch"
        return 1
    fi
    git branch -m "$1" "$2"
    if git push origin :"$1"; then
        git push --set-upstream origin "$2"
    fi
}

get_subcommands() {
    help_text=$("$@" --help)
    if [ -n "$(echo "${help_text}" | rg '^COMMANDS:$')" ]; then
        echo "${help_text#*COMMANDS:}" | rg --trim --color=never '^    \S+$'
    fi
}

map_command() {
    if [[ $# -eq 0 ]]; then
        echo 'at least one arg is required'
        return 1
    fi
    target_commands=("$*")
    idx=1
    while true; do
        target_command=${target_commands[idx]}
        if [ -z "${target_command}" ]; then
            break
        fi
        read -rA target_command_args <<<"${target_command}"
        while read -rA subcommand; do
            if [ -n "${subcommand}" ]; then
                target_commands+=("${target_command_args} ${subcommand}")
            fi
        done <<<"$(get_subcommands "${target_command_args[@]}")"
        idx=$((idx + 1))
    done
    echo "$(
        IFS=$'\n'
        echo "${target_commands[*]}" | sort
    )"
}

get_alias() {
    alias "$1" | cut -d\' -f2
}
