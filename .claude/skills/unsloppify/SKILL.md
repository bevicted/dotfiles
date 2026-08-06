---
name: unsloppify
description: >
  Strip AI-writing tells and non-keyboard glyphs from prose (docs, READMEs,
  comments, markdown) without changing technical substance. Removes em-dashes,
  overused bold/italic emphasis, "bold-lead:" list formatting, hedging and
  self-praise phrasing; converts non-ASCII symbols (arrows, ellipsis, en-dash,
  <= />=, section sign, box-drawing) to ASCII or words. Preserves code, numbers,
  links, RFC-2119 keywords, and glossary term bolding. Use when asked to de-slop,
  de-AI, clean up AI-sounding text, remove em-dashes, or make text ASCII-only.
  Trigger: /unsloppify, "unsloppify", "de-sloppify", "remove AI tells".
---

# Unsloppify

Make prose read like a human wrote it and type on a US keyboard, while keeping
every technical fact, number, link, and code span exactly as-is.

Two independent jobs, do both:

1. Remove AI-writing tells (em-dashes, decorative bold/italic, hedging, self-praise).
2. Replace every non-ASCII glyph with ASCII or a word.

The golden rule: **change the surface, never the substance.** If an edit alters a
number, a requirement keyword, a link target, an identifier, or the meaning of a
sentence, it is wrong. When unsure whether something is a tell or real content,
leave it.

Extended tell catalog, phrase blocklist, and full glyph table:
[reference/ai-tells.md](reference/ai-tells.md).

## Step 1: Inventory

Scope to prose files (`.md`, `.txt`, `README`, doc comments). Then map the work:

```sh
# non-ASCII bytes (arrows, ellipsis, en/em dash, box-drawing, smart quotes, ...)
grep -rnP '[^\x00-\x7F]' . --include='*.md'

# em-dash specifically (the #1 tell)
grep -rn '—' . --include='*.md'

# bold/italic inventory to eyeball (glossary "**term**:" defs are legit; keep them)
grep -rn '\*\*' . --include='*.md'
```

Read the files before editing. Judge each hit in context; do not blind-replace.

## Step 2: Remove prose tells

| Tell | Fix |
| - | - |
| Em-dash `—` aside | Restructure. Pick per context: colon, parentheses, comma, semicolon, or split into two sentences. Do NOT swap every one to the same mark, that just makes a new tell. |
| `**Bold lead:** explanation` list items | Unbold. Use a plain label + colon, or fold the lead into the sentence. |
| Scattered `**bold**` / `*italic*` on ordinary words | Delete the emphasis, let the words stand. |
| Hedging: "it's worth noting", "it's important to note", "at its core", "that said" | Cut the phrase, keep the claim. |
| False balance / over-qualification | State the answer. Drop "there's genuine uncertainty", "on the other hand" padding. |
| Self-praise: "principled", "load-bearing", "seamless", "robust", "powerful", "crucial", "delve", "leverage" | Plain word or delete. |
| Rule-of-three triads for rhythm | Keep only if each item carries distinct information. |
| `**X.**` pseudo-heading starting a paragraph | Promote to a real `###` heading or fold the phrase into the prose. |

Uniform paragraph length and sentence rhythm is itself a tell. Vary sentence
length as you rewrite.

## Step 3: Convert non-ASCII to ASCII or words

| Glyph | Replace with |
| - | - |
| `—` em-dash | see Step 2 (reword) |
| `–` en-dash | `-`, or the word "to" in a range of words |
| `…` | `...` |
| `→` | `->` |
| `↔` | `<->` |
| `⇒` `⟶` | `=>` `-->` |
| `≤` `≥` | `<=` `>=` |
| `≈` | `~` |
| `×` | `x` |
| `·` (mid-dot separator) | `,` `;` or `|` |
| `§` | the word "section" |
| `°` | " degrees" |
| superscripts `⁶` `²` | `^6` `^2` |
| non-breaking space / hyphen | plain space / `-` |
| smart quotes `" " ' '` | `"` `'` |
| bullets `•` | `-` |
| checkmarks `✓` `✗` | words, or `[x]` / `[ ]` |
| box-drawing `│ ─ ┌ ┐ └ ┘ ├ ┤ ▶ ▼ ▲` | ASCII art: `| - + > v ^` (redraw the whole figure, keep column alignment) |
| emoji | remove, or a word if it carried meaning |

## Step 4: Do NOT touch

- **Glossary / definition-list bolding** `**term**:` is a real convention, keep it.
- **RFC-2119 keywords** in UPPERCASE (MUST, SHALL, SHOULD, MAY): normative, keep.
- **Code**: inline spans and fenced blocks are verbatim. Never edit inside them.
- **Numbers, magic constants, units, ranges** stay exact.
- **Links**: markdown `[text](url)` and bare `<url>`: keep every one; do not drop
  or reword targets.
- **Identifiers, proper nouns, product names**.

## Step 5: Verify

Re-run the Step 1 greps. They must come back empty (or only the hits you
deliberately kept, e.g. glossary `**term**:`). Spot-check any redrawn diagram and
any line where an em-dash was reworded, so it still reads cleanly.

## Working notes

- Prefer the `Edit` tool for surgical single-line fixes (tight, reviewable diffs)
  and `Write` for a file that needs pervasive reflow. Avoid `sed`/`python` one-shot
  rewrites; they hide what changed and slip past review.
- Do not commit unless asked; leave the changes for the user to review.
- The tell list is baked in above, but tells drift as models change. For a fresh
  pass, a quick `WebSearch` for "AI writing tells" and "Claude writing tells" is
  worth it (see reference file).
