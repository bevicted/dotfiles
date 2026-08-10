# Patterns & templates

Verbatim skeletons for the conventions in `SKILL.md`. Copy, then fill.

## RFC 2119 / 8174 conventions block

Paste **once** in `spec/00`, then state: *"These conventions apply to all
documents under `spec/`."*

```
The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all
capitals, as shown here.
```

Rules: keywords bind **only in UPPERCASE** (RFC 8174); lowercase = plain English.
Use them **sparingly** (RFC 2119 section 6); over-keyworded specs are a smell.

## EARS: five requirement patterns

One pattern per requirement.

| Pattern    | Keyword   | Template                                                        |
|------------|-----------|----------------------------------------------------------------|
| Ubiquitous | *(none)*  | The `<system>` shall `<response>`.                             |
| State      | **While** | While `<precondition>`, the `<system>` shall `<response>`.     |
| Event      | **When**  | When `<trigger>`, the `<system>` shall `<response>`.           |
| Optional   | **Where** | Where `<feature included>`, the `<system>` shall `<response>`. |
| Unwanted   | **If/Then** | If `<trigger>`, then the `<system>` shall `<response>`.       |

Unwanted behaviour = error handling: these compile into the error catalog.
A **Complex** requirement composes keywords: *While `<pre>`, when `<trigger>`, the
`<system>` shall `<response>`.*

## EBNF symbol legend (ISO/IEC 14977)

Put beside the first grammar block.

```
=      defined as            ,   concatenation
|      alternative (or)      ;   end of rule
{ }    repeat 0 or more      [ ] optional (0 or 1)
( )    group                 " " literal terminal
? ?    special / external (prose-defined token)
```

## ADR template (Nygard)

```markdown
# NN. <Title>

Status: proposed | accepted | superseded by ADR-MM
Date: YYYY-MM-DD

## Context
<forces at play, in tension: the situation demanding a decision. Rejected
alternatives belong here.>

## Decision
<the choice, stated plainly and in active voice: "We will ...">

## Consequences
<the resulting context: what becomes easier and harder, unfavorable outcomes
included.>
```

Live as an unnumbered `template.md` (neither a record nor an index). Immutable
once accepted, except the Status line: supersede with a new ADR, never rewrite
history.

## Error catalog shape

| ID                   | trigger               | exit | stderr                          |
|----------------------|-----------------------|------|---------------------------------|
| `ERR_UNKNOWN_INPUT`  | input name unknown    | 2    | `error: unknown input <name>`   |

IDs map 1:1 to the code's error type, so grep spans spec, code, and test alike.

## Exit codes

Convention, **not** a formal standard: `0` success, `1` general error, `2`
usage/CLI misuse. `sysexits.h` (BSD, `EX_USAGE=64` ...) exists but is
Windows-incompatible and inconsistently followed; skip unless you want
BSD-granular codes. Record the chosen scheme in an ADR.

## Streaming / machine-readable output

**NDJSON** (one JSON object per line) for streamable, pipe-friendly, bounded-
memory output. Pairs with per-item files when a single stdout stream can't carry
multiple sources.

## Requirement quality (ISO/IEC/IEEE 29148:2018)

Nine characteristics: necessary, appropriate, unambiguous, complete, **singular**,
feasible, **verifiable**, correct, conforming. The gating pair when wording a
requirement: **singular** (one aspect) + **verifiable** (a test can prove it).
Requirements carry unique identifiers for traceability.

## Terminology vs glossary

- **Terminology**: normative, in `spec/`; defines the domain nouns that clauses
  bind to. IETF "Terminology" / 29148 "Definitions".
- **Glossary**: informative, reference/lookup; may include non-binding terms.
  Optional appendix. Add only once reader-facing terms accumulate that bind no
  clause.

## Sources

- RFC 2119: https://www.rfc-editor.org/rfc/rfc2119
- RFC 8174: https://www.rfc-editor.org/rfc/rfc8174
- EARS (Alistair Mavin): https://alistairmavin.com/ears/
- EBNF: ISO/IEC 14977
- ISO/IEC/IEEE 29148:2018: https://standards.ieee.org/standard/29148-2018.html
- ADR (Nygard / Fowler): https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- ADR templates (MADR, collection): https://github.com/joelparkerhenderson/architecture-decision-record
- Design Docs at Google: https://www.industrialempathy.com/posts/design-docs-at-google/
- Diataxis (Daniele Procida): https://diataxis.fr/ - the explanation-vs-reference cut the rationale/contract split follows
