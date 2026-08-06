---
name: docs
description: >
  Spec-driven docs — split project documentation into rationale (design docs,
  ADRs; frozen) and contract (specs; normative, living). Use when setting up a
  docs/ tree; writing a design doc, ADR, specification, requirement, error
  catalog, or CLI grammar; or deciding whether content is normative spec vs
  design rationale, how to phrase RFC-2119 requirements, or terminology vs
  glossary. Language-agnostic. Trigger: /docs, "write a spec",
  "add an ADR", "set up docs".
---

# Spec-driven docs

Documentation splits into two kinds that must not blur:

- **Rationale** — *why* a choice was made. Narrative, past-tense, **frozen** once
  decided. Lives in `design/` (and `design/adr/`). Explains; never binds code.
- **Contract** — *what must hold / how it must behave*. **Normative**,
  present-tense, **living** — it MUST track actual behaviour. Lives in `spec/`.
  Code, users, and scripts conform to it.

An **ADR** is the **seam**: one frozen decision that feeds the contract.

## Tree

```
docs/
  design/            rationale — narrative, past-tense, frozen
    NN-*.md
    adr/NN-*.md      one decision each, immutable, Status header
  spec/              contract — normative, present-tense, living
    00-*.md          index + RFC 2119 conventions block (governs all spec/)
    NN-terminology   domain nouns the clauses bind to (normative)
    NN-*.md          requirements, grammar, errors, ...
```

`NN-` orders files; `00-` is the section index/TOC.

## The sorting test — which kind owns a piece of content

Apply per sentence:

- Becomes **wrong** when reality changes → **spec** (living contract).
- Stays true as "what we thought then" → **design** (frozen rationale).
- Holds "because / considered / rejected / vs" → design.
- Holds "MUST / SHALL / exit 2 / output is X" (present normative) → spec.
- **Alternatives live in design only, never spec.** A spec states the answer,
  not the debate.

Term test: if defining a term wrong would make a MUST-clause mean the wrong
thing → it is **terminology** (normative, in spec). Reader-convenience terms →
informative glossary.

## Writing the contract (spec/)

- **Normative keywords** per RFC 2119 / 8174: MUST/SHOULD/MAY bind **only in
  UPPERCASE**. Paste the boilerplate **once** in `spec/00`; state it governs all
  of `spec/`, so every spec file inherits it.
- Spend keywords **sparingly** (RFC 2119 §6) — reserve them for genuine interop
  constraints; ordinary prose for everything else.
- **Requirements**: one **EARS** pattern each; **atomic, singular, verifiable** —
  one testable obligation per statement. Stable ID `REQ-n`; a retired ID is
  **never reused**.
- **Grammar / CLI syntax**: **EBNF** (ISO/IEC 14977), with the symbol legend at
  point-of-use beside the first grammar block.
- **Errors**: a separate **tabular catalog** — `trigger → code → message` — with
  mnemonic IDs (`ERR_*`) that map 1:1 to the code's error type. The table IS the
  compiled form of EARS unwanted-behaviour requirements; keep it out of the prose
  requirement list.
- **Terminology**: define each domain noun **once**, normatively; reference it
  everywhere else.

## ADRs (design/adr/)

One **atomic** decision per record. **Immutable** — supersede with a new ADR
rather than editing an accepted one. Carry a **Status**: proposed | accepted |
superseded.

## Cross-linking the seam

- Spec clause cites its origin: `REQ-7 (rationale: design/03)`.
- Design links **forward** to the spec section it produced.
- Every term is defined **once** (spec terminology); linked, not restated.

## Keep the contract true (anti-drift)

A living spec's main failure is drifting from code. Bind them: cite `REQ-n` /
`ERR_*` in **test names**. A spec-vs-behaviour mismatch is then a bug on exactly
one of them — fix that one.

## The documentation-spec (meta)

The repo's own doc rules are themselves a contract → write them as a spec that
governs `design/`, `adr/`, and `spec/`. Its payload is a taxonomy table (type →
dir → voice → tense → lifecycle → binds?) plus naming rules and the notation
mandates (EBNF for grammar, EARS for behaviour, the keyword rule). Meta-notation
terms (EBNF, EARS, "normative") are defined **here** — not in product terminology.

## Templates

For verbatim skeletons — RFC 2119 boilerplate, the five EARS patterns, the EBNF
symbol legend, the Nygard ADR template, the error-table shape, exit-code and
NDJSON conventions, and authoritative source links — open
[reference/patterns.md](reference/patterns.md).
