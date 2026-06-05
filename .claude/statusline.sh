#!/bin/bash
# Claude Code statusline — caveman badge + effort + session/week usage.
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
#   [5h <pct>% ~<t>]     .rate_limits.five_hour  — Claude's "current session"
#   [7d <pct>% ~<t>]     .rate_limits.seven_day  — Claude's "current week"
#
# Each segment is omitted when its source field is absent (effort: model has no
# effort param; rate_limits: non-subscriber, or before the first API response).

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
# One jq call, tab-separated; empty string for any absent field.
IFS=$'\t' read -r EFFORT FIVE_PCT FIVE_RESET WEEK_PCT WEEK_RESET <<<"$(
  printf '%s' "$input" | jq -r '[
    .effort.level // "",
    .rate_limits.five_hour.used_percentage // "",
    .rate_limits.five_hour.resets_at // "",
    .rate_limits.seven_day.used_percentage // "",
    .rate_limits.seven_day.resets_at // ""
  ] | @tsv'
)"

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

# --- assemble ----------------------------------------------------------------
SEGMENTS=()
[ -n "$BADGE" ] && SEGMENTS+=("$BADGE")
[ -n "$EFFORT" ] && SEGMENTS+=("[$EFFORT]")
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
