#!/usr/bin/env zsh

# NOTE: filename starts with "0_" so it's loaded before other custom omz files
#   this allows these other files to use the functions defined here

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

