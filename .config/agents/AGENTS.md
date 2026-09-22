# Global agent guidance

- Be concise and succinct.
- Avoid characters not available on a standard keyboard (em/en-dashes, arrow symbols, etc.). Use ,.;- or ASCII representations like `-> -| _|_` instead.
- Do not glaze. The user is not always correct; verify, validate, and push back if necessary.
- Never guess. When you cannot cite at least a single source for what you're talking about, either research online or admit to not knowing. Saying that you do not know or at least not sure, is 10 times better than confidently stating a guess/inference for it.
- Avoid slop words unless alternatives are inappropriate.

# Scope control

- Treat the user's request as the scope: choose the smallest verified solution, omit unrequested work, ask before any material expansion of scope, and stop once the requested outcome is verified.
- Material expansion includes new infrastructure, abstractions, dependencies, hardening, or validation unrelated to the changed behavior.
- When a change is backward-incompatible, ask whether compatibility, migration, or versioning work is required instead of adding it by default.
- Report optional improvements instead of implementing them.

# Coding

- If you need a paragraph-long comment to justify why the workaround is OK, the code is wrong - fix the code.
- Prefer simple but correct solutions.

# Committing

Commit proactively in cohesive, self-contained units. One logical change per commit. Never batch unrelated changes. User can override batching or say "don't commit".

Only commit changes verified by exercising the affected behavior; a test counts if it demonstrates that behavior. For bugs: reproduce -> fix -> verify the reproducer passes. Reuse valid verification evidence, including from subagents; rerun only affected or missing checks. Leave unverified changes uncommitted and report what remains unchecked.

Stage files without bypassing Git's ignore rules. Never use `git add -f` or `git add --force` unless the user explicitly asks to track the exact ignored path. If a path does not stage, inspect it with `git check-ignore -v -- <path>`; leave ignored paths untracked and report them.

Commit to current branch. Don't create or switch branches unless asked.

Never push. Never ask to push. Pushing is user-only.

# Commit signing - 1Password timeout recovery

Commits must be signed via 1Password SSH key (`gpg.ssh.program = op-ssh-sign`). If signing fails (missed/timed-out unlock prompt), DO NOT block work.

**Recovery workflow:**

1. Commit unsigned: `git -c commit.gpgsign=false commit ...` (one-off flag; never edit `~/.gitconfig`)
2. Continue work - chain additional unsigned commits same way
3. At task end (or when user returns), retroactively sign unsigned range:
   - Single: `git commit --amend -S --no-edit`
   - Multiple: `git rebase --exec 'git commit --amend --no-edit -S' <first-unsigned>^`
4. Report which commits are unsigned

Never disable signing globally. Never switch keys. Never ignore the unsigned state. This fallback is only for 1Password unlock race.
