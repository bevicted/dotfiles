#!/usr/bin/env bash
# PreToolUse hook: block stale Zig 0.15 idioms in Write/Edit of .zig files.
# Fires in the main session AND inside subagents. Exit 2 = block the tool call.
#
# Contract: Claude Code pipes the tool call as JSON on stdin. We inspect the
# proposed content (Write -> .content, Edit -> .new_string) for a .zig target.
# On a match we print guidance to stderr and exit 2 (deny). Otherwise exit 0.
#
# Requires: jq. If jq is missing or the payload can't be parsed we fail OPEN
# (exit 0) so the hook never wedges your workflow; the compiler is the real
# backstop anyway.

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

input="$(cat)"
tool="$(jq -r '.tool_name // empty' <<<"$input" 2>/dev/null)" || exit 0
path="$(jq -r '.tool_input.file_path // empty' <<<"$input" 2>/dev/null)" || exit 0

case "$tool" in
  Write) content="$(jq -r '.tool_input.content // empty' <<<"$input" 2>/dev/null)" || exit 0 ;;
  Edit)  content="$(jq -r '.tool_input.new_string // empty' <<<"$input" 2>/dev/null)" || exit 0 ;;
  *) exit 0 ;;
esac

[[ "$path" == *.zig ]] || exit 0
[[ -n "$content" ]] || exit 0

# Parallel arrays (a regex may itself contain '|', so do NOT pack regex+msg in one string).
res=(
  'std\.io\.'
  'fixedBufferStream'
  '@Type\('
  '@intFromFloat\b'
  '\bstd\.fs\.(cwd|Dir|File)\b'
  'readToEndAlloc'
  '\bstd\.Thread\.Pool\b'
  '\bstd\.os\.environ\b'
  '@cImport\b'
  '\bstd\.time\.(Instant|Timer|timestamp)\b'
  'ArrayList\([^)]*\)(\{\}|\.init)'
)
msgs=(
  '`std.io.*` is Zig 0.15; use `std.Io` (capital I).'
  '`fixedBufferStream` removed; `var r: std.Io.Reader = .fixed(x);` / `.Writer = .fixed(buf);`'
  '`@Type` removed; use `@Int`/`@Struct`/`@Union`/`@Enum`/`@Tuple`/`@Pointer`/`@Fn`/`@EnumLiteral`.'
  '`@intFromFloat` deprecated; use `@round`/`@floor`/`@ceil`/`@trunc`.'
  '`std.fs.*` moved to `std.Io.*` (e.g. `std.Io.Dir.cwd()`).'
  '`readToEndAlloc` gone; `file.reader(io,&.{}).interface.allocRemaining(gpa,.limited(N))`.'
  '`std.Thread.Pool` removed; use `std.Io.async` / `std.Io.Group`.'
  'Global env removed; use Juicy Main `init.environ_map`.'
  '`@cImport` deprecated; use build-system `b.addTranslateC(...)`.'
  '`std.time.*` timing moved to `std.Io.Timestamp`.'
  'Managed ArrayList removed; unmanaged default: `var l: std.ArrayList(T) = .empty;` + `l.append(gpa, x)`.'
)

hits=()
for i in "${!res[@]}"; do
  if grep -Eq "${res[$i]}" <<<"$content"; then hits+=("${msgs[$i]}"); fi
done

if ((${#hits[@]})); then
  {
    echo "BLOCKED: stale Zig 0.15 idiom(s) in $path (target is Zig 0.16.0):"
    for h in "${hits[@]}"; do echo "  - $h"; done
    echo "Cheat sheet: \$HOME/.claude/skills/zig-016/reference/api-deltas.md"
    echo "Verify the fix with: zig ast-check '$path'  (and grep /usr/lib/zig/std for real signatures)."
  } >&2
  exit 2
fi

exit 0
