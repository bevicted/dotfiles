#!/bin/env bash

git config --global branch.sort -committerdate
git config --global merge.conflictStyle zdiff3

# aliases
git config --global alias.sb 'blame -wCCC'

