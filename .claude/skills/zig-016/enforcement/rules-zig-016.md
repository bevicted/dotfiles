---
paths:
  - "**/*.zig"
---

# Zig 0.16.0 rules (auto-loads when touching .zig files)

Target is **Zig 0.16.0**. Your training data is older; verify, do not recall.

- Grep real signatures in `/usr/lib/zig/std` before using an API.
- Compile before declaring done: `zig ast-check FILE.zig`, then `zig build` / `zig test`.
- Banned 0.15 idioms -> 0.16: `std.io`->`std.Io`; `@Type`->`@Int`/`@Struct`/...;
  `@intFromFloat`->`@round`/`@floor`/`@ceil`/`@trunc`; `fixedBufferStream`->`std.Io.Reader/Writer.fixed`;
  `std.fs.cwd`->`std.Io.Dir.cwd`; managed `ArrayList().init`->`.empty`+`append(gpa,x)`;
  `std.Thread.Pool`->`std.Io.async`/`Group`; `std.os.environ`->`init.environ_map`; `@cImport`->`b.addTranslateC`.
- Full detail: `$HOME/.claude/skills/zig-016/reference/api-deltas.md`.

<!-- NOTE: the `paths:` front-matter for .claude/rules/ is supported by recent Claude Code.
     Confirm your version honors it (docs: Memory / rules). If not, fold this into CLAUDE.md instead. -->
