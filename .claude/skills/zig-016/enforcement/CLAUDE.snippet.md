<!-- Paste into a repo's CLAUDE.md to auto-arm every agent (main + custom subagents +
     teammates) with Zig 0.16 rules WITHOUT invoking the /zig-016 skill. Built-in Explore
     and Plan subagents intentionally skip CLAUDE.md — don't trust their Zig API specifics. -->

# Zig 0.16.0

This project targets **Zig 0.16.0** (a large breaking release: `std.Io` interface, "Juicy Main",
fs/net/process take an `io` parameter). Model training data mostly predates it — do not write
Zig from memory.

**Before presenting Zig code as correct:**
1. Grep the real signature in the installed std — `grep -rn "pub fn <name>" /usr/lib/zig/std/<file>.zig` (`zig env` → `std_dir`).
2. Compile it — `zig ast-check FILE.zig` (fast) or `zig build` / `zig test` (full). Fix from the real error.

**Never use these 0.15 idioms:** `std.io.*` (→ `std.Io.*`), `@Type` (→ `@Int`/`@Struct`/…),
`@intFromFloat` (→ `@round`/`@floor`/`@ceil`/`@trunc`), `fixedBufferStream` (→ `std.Io.Reader/Writer.fixed`),
`std.fs.cwd`/`std.fs.Dir`/`std.fs.File` (→ `std.Io.Dir`/`std.Io.File`), managed `ArrayList().init`
(→ `.empty` + `append(gpa, x)`), `std.Thread.Pool` (→ `std.Io.async`/`Group`), `std.os.environ`
(→ `init.environ_map`), `readToEndAlloc`, `@cImport` (→ `b.addTranslateC`).

Full cheat sheet: `$HOME/.claude/skills/zig-016/reference/api-deltas.md`.
Verified exemplars to copy from: `$HOME/.claude/skills/zig-016/examples/`.
