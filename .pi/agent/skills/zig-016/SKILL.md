---
name: zig-016
description: >
  Write correct Zig 0.16.0 code and offset stale training data (models default to
  0.15/older idioms). Arms the current agent with the ground-truth workflow (grep the
  installed std source, verify with the compiler), the 0.16 breaking-change cheat sheet,
  verified-compiling exemplars, and TigerBeetle's TigerStyle house-style guide.
  Invoke when writing/reviewing Zig or when a build hits a 0.16 API change.
  Trigger: /skill:zig-016, "zig 0.16", "help me write zig".
---

# Zig 0.16

Zig 0.16.0 is a large breaking release ("Writergate" I/O interface; fs/net/process migrated
to `Io`; "Juicy Main"). Models, including you, are mostly trained on 0.15 and older and will
silently emit stale idioms (`std.io`, `@Type`, managed `ArrayList`, `std.fs.cwd`, `@intFromFloat`).
This skill exists to counteract that.

## The one rule that matters: trust the toolchain, not your memory

Your weights are stale. The installed compiler and its std source are not. Ground every
non-trivial Zig claim in one of these before presenting code as done:

1. **Grep the real signature** from the installed std (never recall it):
   ```
   zig env                                   # -> std_dir (usually /usr/lib/zig/std)
   grep -rn "pub fn <name>" /usr/lib/zig/std/<file>.zig
   ```
   Example that resolved a real gap: `grep -rn "pub fn find" /usr/lib/zig/std/mem.zig`.

2. **Verify with the compiler** (0.16 error messages are precise and name the fix):
   ```
   zig ast-check FILE.zig          # fast: syntax + invalid builtins (e.g. @Type)
   zig build / zig test / zig build-exe FILE.zig   # full: catches API mismatches
   ```
   Write -> compile -> read the real error -> fix. Do not declare Zig code correct on memory alone.

Everything below is a fast-path so you grep/compile *less*, not a replacement for it.

## On invocation, do this

1. Confirm the target: `zig version` (this skill assumes 0.16.x). If the project is on a
   different version, say so and stop applying these deltas.
2. Load the [API delta cheat sheet](reference/api-deltas.md) into your working context.
3. Prefer patterns from the [verified exemplars](examples/README.md). Every file compiles
   or tests green on 0.16. Pattern-match these instead of reconstructing from memory.
4. For anything not covered, grep std and/or the vendored
   [release notes](reference/release-notes.md). Grep the release notes; do not read the
   whole 150KB file. Then compile.

## Banned 0.15 patterns (quick lint)

If any of these appear in Zig you are about to write, it is almost certainly wrong for 0.16:

| Stale (0.15) | 0.16 |
|---|---|
| `std.io.` | `std.Io.` |
| `std.io.fixedBufferStream(x).reader()/.writer()` | `var r: std.Io.Reader = .fixed(x);` / `var w: std.Io.Writer = .fixed(buf);` |
| `@Type(.{...})` | `@Int` / `@Struct` / `@Union` / `@Enum` / `@Tuple` / `@Pointer` / `@Fn` / `@EnumLiteral` |
| `@intFromFloat(x)` | `@round` / `@floor` / `@ceil` / `@trunc` |
| `std.fs.cwd()` / `std.fs.Dir` / `std.fs.File` | `std.Io.Dir.cwd()` / `std.Io.Dir` / `std.Io.File` |
| `file.close()` (no arg) | `file.close(io)` |
| `readToEndAlloc` / `readFileAlloc(a,name,N)` | `file.reader(io,&.{}).interface.allocRemaining(...)` / `Io.Dir.cwd().readFileAlloc(io,name,gpa,.limited(N))` |
| managed `ArrayList(T){}` / `.init(a)` | unmanaged default: `var l: std.ArrayList(T) = .empty;` + `l.append(gpa, x)` |
| `std.Thread.Pool` | `std.Io.async` / `std.Io.Group` |
| `std.os.environ` (global env) | `init.environ_map` (Juicy Main) |
| `pub fn main() !void` needing args/env | `pub fn main(init: std.process.Init) !void` |

Full detail with old->new for every change: `reference/api-deltas.md`.

## House style: TigerStyle

The rest of this skill guards *correctness*: does it compile on 0.16. For *quality* (how the Zig
should read), apply TigerBeetle's **TigerStyle**, which optimizes for safety, then performance, then
developer experience, in that order. When writing new Zig or reviewing it beyond 0.16 compatibility,
load `reference/tiger-style.md` (vendored; epigraph quotes cut, rest verbatim) and grep it for the
topic at hand (assertions, the 70-line function limit, naming, batching, off-by-one) rather than
reading the whole file.

## Maintenance

When a newer Zig lands, this whole skill can be regenerated the same way it was built: fetch the
release notes, verify every claim against a fresh install, re-compile the exemplars. Never edit
the cheat sheet from memory; re-derive from the toolchain.
