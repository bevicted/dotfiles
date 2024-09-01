#!/usr/bin/env bash

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
