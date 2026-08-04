# Verified Zig 0.16.0 exemplars

Every file here was compiled/tested green against a real Zig 0.16.0 install. Prefer copying these
patterns over reconstructing from memory. If you change one, re-verify with the command shown.

| File | Shows | Verify with |
|---|---|---|
| `hello.zig` | Juicy Main, `std.Io.File.stdout().writeStreamingAll(io, ...)` | `zig build-exe hello.zig` |
| `args_env.zig` | CLI args via `init.minimal.args.toSlice`, env count via `init.environ_map` | `zig build-exe args_env.zig` |
| `read_file.zig` | `std.Io.Dir.cwd().readFileAlloc(io, name, gpa, .limited(N))` | `zig build-exe read_file.zig` |
| `arraylist_writer.zig` | unmanaged `ArrayList` (`.empty` + `append(gpa,…)`), `std.Io.Writer.fixed`+`print`+`buffered`, `std.Io.Reader.fixed`+`takeDelimiterExclusive` | `zig test arraylist_writer.zig` |
| `meta_types.zig` | `@Int`/`@Tuple`, float→int via `@round`, implicit small-int→float coercion | `zig test meta_types.zig` |

Re-verify all at once:
```sh
cd "$HOME/.claude/skills/zig-016/examples"
for f in hello args_env read_file; do zig build-exe "$f.zig" -femit-bin=/tmp/zx_$f && echo "OK $f"; done
for f in arraylist_writer meta_types; do zig test "$f.zig" && echo "OK $f"; done
```
