# Repo-level enforcement (optional)

The `/zig-016` skill arms the current agent on demand. These templates make a repo enforce Zig
0.16 on **every** agent automatically. Install only what you want — they stack.

| File | Install to | Effect | Reaches |
|---|---|---|---|
| `CLAUDE.snippet.md` | append to repo `CLAUDE.md` | soft guidance, auto-loaded | main + custom subagents + teammates (not built-in Explore/Plan) |
| `rules-zig-016.md` | `.claude/rules/zig-016.md` | same, scoped to `**/*.zig` | same, only when touching .zig |
| `validate-zig.sh` + `settings.hook.json` | script anywhere + merge JSON into `.claude/settings.json` | **hard block** of stale idioms on Write/Edit | all agents incl. subagents |
| `zig-016-builder.agent.md` | `.claude/agents/zig-016-builder.md` | specialized subagent | when invoked |

## Hook setup

```sh
chmod +x "$HOME/.claude/skills/zig-016/enforcement/validate-zig.sh"
# then merge settings.hook.json into your settings.json (project or global)
```

Requires `jq`. The script self-skips non-`.zig` targets and fails open if `jq` is absent, so it
can never wedge your workflow. Exit code 2 denies the Write/Edit with guidance on stderr.

Layers of defense, in order of trust: **compiler + std grep** (authoritative) > **CLAUDE.md/rules**
(bias) > **hook** (deterministic backstop). The hook catches only the listed patterns — it is a
safety net, not a substitute for compiling.
