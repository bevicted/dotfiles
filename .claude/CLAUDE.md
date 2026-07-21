# No python3 for file edits

Do not use `python3 -c "..."` (or scripts) to edit, replace, or rewrite file contents. Use the Edit tool for in-place changes and the Write tool for full rewrites.

Python is fine for actual computation, data processing, or running real programs — just not as a workaround for file editing.

# Committing

Commit your work proactively (without being asked) in cohesive, self-contained commits — one logical change each, with a clear message. Never batch unrelated changes into a single commit. A request for different batching, or "don't commit", overrides this.

Don't commit a change whose correctness you can't verify. Leave it uncommitted and tell the user what needs checking. "Verified" means you exercised the actual behavior — not just that unit tests pass.

Commit to the branch that's currently checked out; don't create or switch branches unless asked. Branch choice is the user's.

Never push, and never ask to push — pushing is a user-only action.

# Commit signing — 1Password failure must not block work

All commits should be signed via the 1Password SSH key (configured in `~/.gitconfig` via `gpg.ssh.program = op-ssh-sign`). If signing fails because the 1Password unlock prompt was missed/timed out, **do not stop development and do not retry interactively**.

Workflow when signing fails:
1. Make the commit unsigned: `git -c commit.gpgsign=false commit ...` (one-off; do not edit `~/.gitconfig`).
2. Keep working — chain further unsigned commits the same way.
3. At end of task (or when user is back), retroactively sign the unsigned range:
   - Single commit: `git commit --amend -S --no-edit`
   - Range: `git rebase --exec 'git commit --amend --no-edit -S' <first-unsigned>^`
4. Tell the user which commits are unsigned so they can sign them when 1Password is unlocked.

Never disable signing globally, never switch keys, never silently skip the issue. The unsigned-fallback is only for the 1Password unlock-window race.
