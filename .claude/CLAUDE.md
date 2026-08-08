# General guidance

- Be concise and succinct.
- Avoid characters not available on a standard keyboard (em/en-dashes, arrow symbols, etc.). Use ,.;- or ASCII representations like `-> -| _|_` instead.
- Do not glaze. The user is not always correct; verify, validate, and push back if necessary.
- Avoid slop words unless alternatives are inappropriate.

# Coding

- If you need a paragraph-long comment to justify why the workaround is OK, the code is wrong - fix the code.
- Prefer simple but correct solutions.

# Committing

Commit proactively in cohesive, self-contained units. One logical change per commit. Never batch unrelated changes. User can override batching or say "don't commit".

Only commit verified changes. Leave unverified work uncommitted and report what needs checking. "Verified" = exercised actual behavior, not just passing tests.

Commit to current branch. Don't create or switch branches unless asked.

Never push. Never ask to push. Pushing is user-only.

# Commit signing — 1Password timeout recovery

Commits must be signed via 1Password SSH key (`gpg.ssh.program = op-ssh-sign`). If signing fails (missed/timed-out unlock prompt), DO NOT block work.

**Recovery workflow:**
1. Commit unsigned: `git -c commit.gpgsign=false commit ...` (one-off flag; never edit `~/.gitconfig`)
2. Continue work — chain additional unsigned commits same way
3. At task end (or when user returns), retroactively sign unsigned range:
   - Single: `git commit --amend -S --no-edit`
   - Multiple: `git rebase --exec 'git commit --amend --no-edit -S' <first-unsigned>^`
4. Report which commits are unsigned

Never disable signing globally. Never switch keys. Never ignore the unsigned state. This fallback is only for 1Password unlock race.
