#!/bin/bash
# Claude Code statusline — caveman badge + effort + context + session/week usage.
#
# Wired via ~/.claude/settings.json:
#   "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" }
#
# Reads session JSON on stdin (see code.claude.com/docs/en/statusline) and
# renders, all in caveman orange (256-color 172):
#   [CAVEMAN]            mode badge — reproduced inline so there is no
#                        dependency on the plugin cache path (which carries a
#                        hash that changes on every plugin update)
#   [<effort>]           .effort.level (live, reflects mid-session /effort)
#   [ctx <n> (<pct>%)]   context used: all four current_usage token types summed
#                        over context_window_size — the ccstatusline / Matt
#                        Pocock metric. More honest than native .used_percentage,
#                        which counts input tokens only (claude-code#28167).
#                        <n> is compact (182k, 1.2M); size is 1000000 for [1m].
#   [5h <pct>% ~<t>]     .rate_limits.five_hour  — Claude's "current session"
#   [7d <pct>% ~<t>]     .rate_limits.seven_day  — Claude's "current week"
#
# Each segment is omitted when its source field is absent (effort: model has no
# effort param; ctx: before the first API response; rate_limits: non-subscriber,
# or before the first API response).
#
# SIDE EFFECT: also mirrors the rate-limit numbers to $CONFIG_DIR/.rate-limits.json
# on every render. Rate limits reach the statusline and nowhere else — hooks never
# receive them — so this file is the only way a long-running script or agent can
# read the numbers and throttle itself. See the "usage mirror" block below.

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ORANGE='\033[38;5;172m'
RESET='\033[0m'

input=$(cat)

# --- caveman badge (reproduced from the plugin's caveman-statusline.sh) -------
# Same hardening: refuse symlinks (a local attacker could point the flag at a
# secret and have its bytes — including ANSI escapes — rendered every keystroke),
# cap the read, strip to [a-z0-9-], whitelist known modes. Unlike the plugin
# script this never exits early on a missing/bad flag — it just skips the badge
# so the usage segments still render with caveman off.
BADGE=""
FLAG="$CONFIG_DIR/.caveman-active"
if [ -f "$FLAG" ] && [ ! -L "$FLAG" ]; then
  MODE=$(head -c 64 "$FLAG" 2>/dev/null | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')
  MODE=$(printf '%s' "$MODE" | tr -cd 'a-z0-9-')
  case "$MODE" in
    off|lite|full|ultra|wenyan-lite|wenyan|wenyan-full|wenyan-ultra|commit|review|compress)
      if [ -z "$MODE" ] || [ "$MODE" = "full" ]; then
        BADGE="[CAVEMAN]"
      else
        BADGE="[CAVEMAN:$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')]"
      fi
      ;;
  esac
fi

# Savings suffix: pre-rendered string written by caveman-stats.js. Same symlink
# refusal + control-byte stripping as the flag. Absent until /caveman-stats runs.
SAVINGS=""
SAVINGS_FILE="$CONFIG_DIR/.caveman-statusline-suffix"
if [ "${CAVEMAN_STATUSLINE_SAVINGS:-1}" != "0" ] && [ -f "$SAVINGS_FILE" ] && [ ! -L "$SAVINGS_FILE" ]; then
  SAVINGS=$(head -c 64 "$SAVINGS_FILE" 2>/dev/null | tr -d '\000-\037')
fi

# --- usage segments from session JSON ----------------------------------------
# One jq call, pipe-delimited; empty string for any absent field. The delimiter
# is '|' (not tab): tab is IFS whitespace, so `read` would collapse empty
# leading/middle fields and shift the rest, mis-assigning values when e.g.
# effort is absent but context is present. '|' is non-whitespace, so empty
# fields are preserved positionally. None of the values (effort levels,
# percentages, unix-epoch resets) ever contain '|'.
IFS='|' read -r EFFORT CTX_USED CTX_SIZE MODEL_ID FIVE_PCT FIVE_RESET WEEK_PCT WEEK_RESET <<<"$(
  printf '%s' "$input" | jq -r '[
    .effort.level // "",
    (.context_window as $c |
       if   $c.current_usage then ($c.current_usage
              | (.input_tokens // 0) + (.output_tokens // 0)
              + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))
       elif $c.total_input_tokens != null then (($c.total_input_tokens // 0) + ($c.total_output_tokens // 0))
       else "" end),
    .context_window.context_window_size // "",
    .model.id // "",
    .rate_limits.five_hour.used_percentage // "",
    .rate_limits.five_hour.resets_at // "",
    .rate_limits.seven_day.used_percentage // "",
    .rate_limits.seven_day.resets_at // ""
  ] | map(tostring) | join("|")'
)"

# --- usage mirror ------------------------------------------------------------
# Dump the rate-limit numbers where non-statusline code can read them. Written
# on every render, so freshness is bounded by render cadence; consumers should
# treat a stale written_at as "unknown" rather than "fine". Values are emitted as
# JSON numbers, or null when the field was absent — never as strings, so a
# consumer can compare numerically without unwrapping.
#
# Defensive, matching the rest of this script: values are sanitized to digits and
# a dot before being interpolated into JSON (they come from jq's tostring of a
# number, but a malformed value would otherwise produce a file that every
# consumer fails to parse); the write is atomic via a PID-unique temp so two
# concurrent sessions can never expose a half-written file; and the whole block
# is best-effort — any failure leaves the rendered statusline and the exit status
# untouched, because a broken mirror must never blank the statusline.
json_num() { case "$1" in ''|*[!0-9.]*) printf 'null' ;; *) printf '%s' "$1" ;; esac; }

if [ -n "$FIVE_PCT" ] || [ -n "$WEEK_PCT" ]; then
  USAGE_FILE="$CONFIG_DIR/.rate-limits.json"
  USAGE_TMP="$USAGE_FILE.$$.tmp"
  # Nested rather than `! printf ... && mv ...`: in that form `!` negates only the
  # printf, so a SUCCESSFUL write short-circuits the `&&` and the mv never runs,
  # silently orphaning the temp file on every render.
  if printf '{"written_at":%s,"five_hour_pct":%s,"five_hour_resets_at":%s,"seven_day_pct":%s,"seven_day_resets_at":%s}\n' \
     "$(date +%s)" \
     "$(json_num "$FIVE_PCT")" "$(json_num "$FIVE_RESET")" \
     "$(json_num "$WEEK_PCT")" "$(json_num "$WEEK_RESET")" \
     >"$USAGE_TMP" 2>/dev/null
  then
    mv -f "$USAGE_TMP" "$USAGE_FILE" 2>/dev/null || rm -f "$USAGE_TMP" 2>/dev/null
  else
    rm -f "$USAGE_TMP" 2>/dev/null
  fi
fi

# Time until a unix-epoch reset, compact: 3d / 2h / 5m / now.
fmt_reset() {
  [ -z "$1" ] && return
  local diff=$(( $1 - $(date +%s) ))
  if   [ "$diff" -le 0 ];     then printf 'now'
  elif [ "$diff" -ge 86400 ]; then printf '%dd' "$((diff / 86400))"
  elif [ "$diff" -ge 3600 ];  then printf '%dh' "$((diff / 3600))"
  else                             printf '%dm' "$((diff / 60))"
  fi
}

# Compact token count: 950 / 182k / 1.2M.
fmt_tokens() {
  local n=$1
  if   [ "$n" -ge 1000000 ]; then printf '%d.%dM' "$((n / 1000000))" "$(((n % 1000000) / 100000))"
  elif [ "$n" -ge 1000 ];    then printf '%dk' "$((n / 1000))"
  else                            printf '%d' "$n"
  fi
}

# --- assemble ----------------------------------------------------------------
SEGMENTS=()
[ -n "$BADGE" ] && SEGMENTS+=("$BADGE")
[ -n "$EFFORT" ] && SEGMENTS+=("[$EFFORT]")
if [ -n "$CTX_USED" ]; then
  SIZE="$CTX_SIZE"
  if ! [ "$SIZE" -gt 0 ] 2>/dev/null; then
    case "$MODEL_ID" in *'[1m]'*) SIZE=1000000 ;; *) SIZE=200000 ;; esac
  fi
  SEGMENTS+=("[ctx $(fmt_tokens "$CTX_USED") ($((CTX_USED * 100 / SIZE))%)]")
fi
if [ -n "$FIVE_PCT" ]; then
  R=$(fmt_reset "$FIVE_RESET")
  SEGMENTS+=("[5h $(printf '%.0f' "$FIVE_PCT")%${R:+ ~$R}]")
fi
if [ -n "$WEEK_PCT" ]; then
  R=$(fmt_reset "$WEEK_RESET")
  SEGMENTS+=("[7d $(printf '%.0f' "$WEEK_PCT")%${R:+ ~$R}]")
fi

[ ${#SEGMENTS[@]} -eq 0 ] && exit 0

printf "${ORANGE}%s${RESET}" "${SEGMENTS[*]}"
[ -n "$SAVINGS" ] && printf " ${ORANGE}%s${RESET}" "$SAVINGS"

# A non-zero exit blanks the statusline (Claude Code treats it as failure), and
# the final && above returns 1 whenever SAVINGS is empty. Always succeed.
exit 0
