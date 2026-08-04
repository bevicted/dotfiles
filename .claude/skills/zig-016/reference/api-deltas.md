# Zig 0.16.0 — breaking API/syntax deltas

Source: <https://ziglang.org/download/0.16.0/release-notes.html> (verified against a real 0.16.0
install: raw release-notes text + `zig env` std source + compiled exemplars). Old → new throughout.

> Reminder: this is a fast-path, not an oracle. When in doubt, grep `/usr/lib/zig/std` and compile.

## I/O as an interface ("Writergate" pt. 2) — the biggest change

All input/output takes an `Io` instance now.

- `std.io` → `std.Io`. Deleted: `GenericReader`, `AnyReader`, `GenericWriter`, `AnyWriter`,
  `null_writer`, `CountingReader` → use `std.Io.Reader` / `std.Io.Writer`.
- `std.io.fixedBufferStream(data).reader()` → `var r: std.Io.Reader = .fixed(data);`
  writer → `var w: std.Io.Writer = .fixed(buf);` (get bytes with `w.buffered()`).
- `std.leb.readUleb128/readIleb128` → `std.Io.Reader.takeLeb128`.
- fs / net / process all take `io`: `file.close()` → `file.close(io)`.
- Need an `Io` and don't have one? `var t: std.Io.Threaded = .init_single_threaded; const io = t.io();`
  (workaround only — prefer accepting an `io` parameter).
- Tests: `const io = std.testing.io;`.

## "Juicy Main"

```zig
pub fn main(init: std.process.Init) !void {
    const gpa = init.gpa;              // general-purpose allocator (leak-checked in debug)
    const io = init.io;               // default Io implementation
    const arena = init.arena;         // *std.heap.ArenaAllocator, freed at process exit
    // also: init.environ_map (*Environ.Map), init.preopens, init.minimal.{args, environ}
}
```

- Lighter first param: `pub fn main(init: std.process.Init.Minimal)` (raw args + environ only).
- Empty `pub fn main() !void` still legal, but then no CLI args / env access.
- Args: `const args = try init.minimal.args.toSlice(init.arena.allocator());` or `init.args.iterate()`.
- **Env is non-global now.** `std.os.environ` and global env access are gone. Use `init.environ_map`,
  or pass `*const std.process.Environ.Map` to functions that need it.
- stdout: `try std.Io.File.stdout().writeStreamingAll(io, "...");`.
- Process: `std.process.spawn(io, .{ .argv = ..., .stdout = .pipe, ... })`,
  `std.process.run(gpa, io, .{...})`, `std.process.replace(io, .{ .argv = argv })` (was `execv`).

## Builtins

- **`@Type` removed** → 8 builtins:
  `@Int(.unsigned, 10)`, `@EnumLiteral()`, `@Tuple(&.{ u32, f64 })`,
  `@Pointer(.one, .{ .@"const" = true }, u32, null)`, `@Fn(...)`, `@Struct(...)`, `@Union(...)`, `@Enum(...)`.
  No `@Float`/`@Array`/`@Optional`/`@ErrorUnion`/`@ErrorSet`/`@Opaque` — use `?T`, `E!T`, `[N]T`,
  `error{...}`, `opaque{}`. `std.meta.Int`/`Tuple` deprecated (use `@Int`/`@Tuple`).
- **`@intFromFloat` deprecated** → `@floor`/`@ceil`/`@round`/`@trunc` now convert float→int directly.
- Unary float builtins (`@sqrt`, `@sin`, `@cos`, `@floor`, ...) now forward the result type:
  `const x: f64 = @sqrt(@floatFromInt(N));` compiles.
- Small int → float now coerces implicitly if every value fits the significand
  (e.g. `u24` → `f32`); larger still needs `@floatFromInt`.

## Language

- Returning `&local` from a function is now a compile error ("address of expired local").
- Packed struct/union may no longer contain pointer fields → use `usize` + `@ptrFromInt`/`@intFromPtr`.
- Packed unions: explicit backing int required and all fields must be the same bit width;
  `packed union(u16) {...}` now allowed.
- extern types need an explicit backing/tag: `enum(u8)`, `packed struct(u8)`, `packed union(u8)`.
- `switch` prongs may use packed struct/union (compared by backing int), decl literals, and
  result-type expressions.
- `*u8` and `*align(1) u8` are now distinct types (still coerce to each other).
- `@cImport` deprecated → build-system `b.addTranslateC(...)`.

## std containers & misc

- Managed containers removed — **unmanaged is the default**; pass the allocator to each method.
  `var l: std.ArrayList(u8) = .empty; try l.append(gpa, x); l.deinit(gpa);`
- `ArrayHashMap`/`AutoArrayHashMap`/`StringArrayHashMap` (+ `...Unmanaged`) →
  `array_hash_map.{Auto, String, Custom}`.
- `PriorityQueue` / `PriorityDequeue`: init with `.empty`; `add*` → `push*`, `remove*` → `pop*`.
- `std.Thread.Pool` **removed** → `std.Io.async` / `std.Io.Group`.
- `std.Thread.{Mutex,Condition,RwLock,Semaphore,Futex}` / `ResetEvent` / `WaitGroup` →
  `std.Io.{Mutex,Condition,RwLock,Semaphore,Futex,Event,Group}`.
- `ThreadSafeAllocator` removed; `ArenaAllocator` is now thread-safe + lock-free. `std.once` removed.
  `SegmentedList` removed.
- `std.mem` "index of" renamed to **"find"** (confirmed from `/usr/lib/zig/std/mem.zig`):
  `find`, `findLast`, `findPos`, `findScalar`, `findScalarLast`, `findScalarPos`, `findAny`,
  `findLastAny`, `findAnyPos`, `findNone`, `findLastNone`, `findNonePos`, `findDiff`,
  `findSentinel`, `findMin`, `findMax`. New cut family: `cut`, `cutLast`, `cutScalar`,
  `cutScalarLast`, `cutPrefix`, `cutSuffix` (return an optional tuple of the two halves).
- fmt: `{D}` specifier removed → `w.print("{f}", .{std.Io.Duration{ .nanoseconds = ns }})`.
  `std.fmt.format` → `std.Io.Writer.print`; `Formatter` → `Alt`; `FormatOptions` → `Options`;
  `bufPrintZ` → `bufPrintSentinel`.
- File read: `cwd().readFileAlloc(gpa, name, 1234)` →
  `std.Io.Dir.cwd().readFileAlloc(io, name, gpa, .limited(1234))`
  (error `FileTooBig` → `StreamTooLong`). `file.readToEndAlloc(gpa, 1234)` →
  `var fr = file.reader(io, &.{}); const s = try fr.interface.allocRemaining(gpa, .limited(1234));`
- Time: `std.time.Instant`/`Timer`/`timestamp` → `std.Io.Timestamp` (`.now`).
- Entropy: `std.crypto.random` / `posix.getrandom` → `io.random(&buf)` / `io.randomSecure(&buf)`.
- Error renames: `RenameAcrossMountPoints`/`NotSameFileSystem` → `CrossDevice`;
  `SharingViolation` → `FileBusy`; `EnvironmentVariableNotFound` → `EnvironmentVariableMissing`.

## Build system

- `--fork=[path]` — local package override across the whole dependency tree.
- Dependencies fetch into a project-local `zig-pkg/` dir; each dep in `build.zig.zon` now needs a
  `fingerprint`, and the name must be an enum literal (`.foo`), not a string.
- `--test-timeout 500ms` — per-unit-test timeout.
- `--error-style verbose|minimal|verbose_clear|minimal_clear` (replaces `--prominent-compile-errors`;
  old flag's equivalent is `--error-style minimal`). Env: `ZIG_BUILD_ERROR_STYLE`.
- `--multiline-errors indent|newline|none`. Env: `ZIG_BUILD_MULTILINE_ERRORS`.
- Temp files: `Build.addTempFiles` / `addMutateFiles` / `tmpPath`; `RemoveDir` and `makeTempPath` removed.
- `@cImport` → `b.addTranslateC(.{...})` + `translate_c.createModule()` as an import.
