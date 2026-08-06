# AI-writing tells: extended reference

Background for the `unsloppify` skill. Load when you want the long list, or before
a thorough pass on writing that will be read closely.

## Why these are tells

Detectors and readers flag machine-generated prose by surface habits, not content.
The habits below cluster in LLM output because they come from markdown-saturated
training data and RLHF politeness pressure. Removing them does not make text
"undetectable"; it makes it read like a person wrote it. Substance is untouched
either way.

## Model-specific notes (Claude)

Among major models, Claude is the one that uses the em-dash *more* than human
writers, so treat `—` as the first thing to hunt. Other Claude-leaning habits:

- Strong pull to the em-dash for mid-sentence asides.
- False balance: presenting multiple sides even when one is clearly stronger,
  hedged with "it's worth noting", "this is somewhat subjective".
- Explicit organizational signaling: "First... Second... Finally...".
- Lists where every item is `Bold term: explanation`.
- Uniform paragraph length and near-identical sentence rhythm.
- Repetition figures: same sentence opener 3+ times (anaphora), same ending
  (epistrophe), immediate word repetition (epizeuxis).
- Polite, non-confrontational tone that avoids a direct conclusion.

## Phrase blocklist

Hedging / filler (cut the phrase, keep the claim):

- "it's worth noting that", "it's important to note", "it's worth mentioning"
- "at its core", "when it comes to", "in terms of", "the fact that"
- "that said", "with that in mind", "needless to say", "as we can see"
- "plays a crucial/vital/key role", "a testament to"

Inflated vocabulary (prefer the plain word, or delete):

- delve, leverage, utilize, showcase, underscore, foster, harness, empower
- realm, landscape, tapestry, beacon, cornerstone, ecosystem (when decorative)
- multifaceted, nuanced, intricate, robust, seamless, powerful, comprehensive
- pivotal, paramount, noteworthy, commendable, meticulous, meticulously
- "principled", "load-bearing", "first-class citizen" (when self-praising)

Structural / transition crutches:

- "Moreover", "Furthermore", "Additionally", "In conclusion", "Overall" stacked at
  paragraph starts
- "Not only... but also..."
- "Whether you're X or Y" opener
- "In today's fast-paced world" and cousins

None of these are banned words in the abstract. The tell is *frequency* and
*decoration*. If "leverage" is the precise term, keep it; if it is dressing up
"use", cut it.

## Full non-ASCII glyph table

| Glyph | Name | Replace with |
| - | - | - |
| `—` | em dash | reword (colon / parens / comma / split) |
| `–` | en dash | `-` or "to" |
| `‒` `―` | figure / horizontal bar | `-` |
| `…` | ellipsis | `...` |
| `→` `←` | arrows | `->` `<-` |
| `↔` | left-right arrow | `<->` |
| `⇒` `⇐` `⟶` | double / long arrows | `=>` `<=` `-->` |
| `≤` `≥` | less/greater-or-equal | `<=` `>=` |
| `≠` | not equal | `!=` |
| `≈` `∼` | approx | `~` |
| `×` | multiply | `x` |
| `÷` | divide | `/` |
| `±` | plus-minus | `+/-` |
| `·` `•` | mid-dot / bullet | `,` `;` `|` / `-` |
| `§` | section sign | "section" |
| `¶` | pilcrow | "paragraph" |
| `°` | degree | " degrees" |
| `™` `®` `©` | marks | "(TM)" "(R)" "(C)" or drop |
| `€` `£` `¥` | currency | "EUR" "GBP" "JPY" or code |
| `½` `¼` | fractions | `1/2` `1/4` |
| `⁰-⁹` | superscripts | `^0`..`^9` |
| `₀-₉` | subscripts | `_0`.._9` |
| `“` `”` `‘` `’` | smart quotes | `"` `'` |
| `‚` `„` | low quotes | `,` `,,` |
| `«` `»` | guillemets | `"` |
| NBSP ` ` | non-breaking space | plain space |
| `­` `‑` | soft / non-breaking hyphen | `-` |
| `﻿` | BOM / zero-width | delete |
| `│ ─ ┌ ┐ └ ┘ ├ ┤ ┬ ┴ ┼` | box-drawing | `| - + redraw ASCII` |
| `▶ ▲ ▼ ◀ ► ●` | triangles / shapes | `> ^ v < > *` |
| `✓ ✔ ✗ ✘` | check / cross | words or `[x]` / `[ ]` |
| emoji | pictographs | remove, or a word |

To find anything missed:

```sh
grep -rnP '[^\x00-\x7F]' . --include='*.md'
grep -rnP '[\x{2010}-\x{2015}\x{2018}-\x{201F}\x{2026}\x{2190}-\x{21FF}\x{2500}-\x{257F}]' .
```

## Anti-patterns when de-slopping

- Do not swap every em-dash to the same replacement. A page of "; " is a new tell.
- Do not turn every list into `label: value`. Vary; some lists should become prose.
- Do not strip bold that carries meaning (glossary terms, table emphasis a reader
  relies on). Reducing bold is not deleting all bold.
- Do not flatten technical precision to sound "casual". Terse and exact beats
  chatty.
- Do not introduce em-dashes, smart quotes, or ellipsis glyphs while editing;
  editors and some keyboards auto-insert them. Type ASCII.
