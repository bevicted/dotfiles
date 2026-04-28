# File creation

Never use `cat <<EOF > file` heredocs or `echo > file` redirects to create/overwrite files. Use the Write tool for new files and Edit tool for modifications. Heredoc-based file writes trigger obfuscation permission prompts.

Heredoc only acceptable when piping into a command that consumes stdin without writing a file (e.g. `gh pr create --body "$(cat <<EOF...)"`).

# Prefer dedicated tools over bash utilities

Use the dedicated tool, not the bash equivalent. The bash versions are denied in `~/.claude/settings.json` and will fail anyway.

| Instead of bash | Use tool |
|-----------------|----------|
| `cat` (read whole file) | Read |
| `grep`, `rg` | Grep |
| `find`, `ls` (recursive) | Glob |
| `sed`, `awk` (for edits) | Edit |
| `echo > file`, `cat <<EOF > file` | Write |

Reach for Read/Grep/Glob/Edit/Write first. Only fall back to Bash for shell-only operations (process management, git, package managers, build tools, pipe-trimming with `head`/`tail`, etc.).

`head`/`tail` allowed — common in pipes (`git log | head`, `ls -t | tail`).

# No python3 for file edits

Do not use `python3 -c "..."` (or scripts) to edit, replace, or rewrite file contents. Use the Edit tool for in-place changes and the Write tool for full rewrites.

Python is fine for actual computation, data processing, or running real programs — just not as a workaround for file editing.
