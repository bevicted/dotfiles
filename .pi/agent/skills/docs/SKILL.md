---
name: docs
description: >
  Write architecture rationale and normative product specifications, including
  requirements, grammars, error contracts, and terminology. Use when
  creating or separating design and specification content. Do not use for
  implementation plans, roadmaps, task lists, READMEs, guides, or research notes.
---

# Rationale and contract documentation

## Workflow

1. Read the repository's documentation policy, indexes, and nearby examples.
   Identify its layout, terminology, notation, identifiers, and lifecycle rules.
2. Check scope before editing. Apply this skill only to architecture rationale
   and normative product specifications. If the primary deliverable is an
   implementation plan, roadmap, task list, README, guide, research note, or
   other general documentation, stop applying this skill and use the workflow
   appropriate to that artifact.
3. Classify each claim before placing it:
   - **Rationale** records context, alternatives, a decision, or consequences. It
     explains but does not bind the implementation.
   - **Contract** states required current behavior, interfaces, formats, or
     constraints. Implementations and consumers conform to it.
   - **Evidence** records experiments, external observations, source notes, or
     open questions. Keep it informative under the repository's research or
     reference convention; do not turn an observation into a requirement without
     an explicit decision.
4. Follow existing repository conventions. Do not restructure documentation or
   introduce a notation merely because this skill contains a template. When the
   repository has no conventions and the user asks to establish them, use the
   layout guidance below.
5. Write only the requested artifacts. Apply the lifecycle and contract rules
   below. Open [reference/patterns.md](reference/patterns.md) only when writing
   BCP 14 conventions, EARS requirements, ISO EBNF, an error catalog, or
   normative terminology.
6. Connect related documents without manufacturing links: cite rationale from a
   contract when it explains the requirement, and link design rationale forward
   when a resulting contract exists. Reference each normative
   definition from one authoritative location.
7. Verify every modified document: confirm its classification and lifecycle,
   check links and identifiers, separate normative from informative text, and
   account for each unresolved placeholder or open question.

## Optional bootstrap profile

Use this profile only when the user asks to establish documentation conventions
and the repository has none. Adapt names and numbering to the project rather than
replacing an existing structure.

```text
docs/
  design/          # architecture rationale
    00-*.md         # section index
    NN-*.md         # ordered design documents
  spec/             # normative product contracts
    00-*.md         # section index
    NN-*.md         # ordered specifications
  research/         # optional, non-binding evidence
```

Use `00-` for section indexes. `NN-` denotes a two-digit, zero-padded numeric
prefix, such as `01-`.

Add a terminology specification only when the user requests one or repository
policy selects it. If repository-wide documentation rules need their own
contract, record the layout, lifecycle, naming, and selected notations in the
repository's chosen policy location. Do not create a documentation meta-spec
unless the user asks to govern those conventions.

## Lifecycle

Keep design documents aligned with the current architecture and its important
rationale. Git preserves their history. Keep a normative specification aligned
with the intended current contract. When the intended contract changes, update
the specification and affected implementation together.

## Contract rules

- If the repository adopts BCP 14, use RFC 2119/8174 keywords only in uppercase
  and reserve them for requirements that need normative force.
- Give each requirement one independently verifiable obligation. Use EARS only
  when the repository selects it. Assign a stable, repository-unique identifier;
  use a namespace such as `REQ-CLI-1` when requirements span multiple domains.
  Never reuse a retired identifier.
- Use the repository's selected grammar notation. If it selects ISO/IEC 14977
  EBNF, place a symbol legend beside the first governed grammar block.
- Create an error catalog only when the interface exposes stable error conditions.
  Choose fields for that interface; use exit-status, stdout, or stderr columns
  only for a CLI contract. Assign stable error IDs when callers or tests need to
  reference them.
- Define each normative domain term once. Keep reader-convenience definitions in
  an informative glossary.
- Carry requirement or error identifiers into tests and implementation only when
  the repository uses that traceability scheme.
- When implementation and specification disagree, determine the intended
  contract before editing either side. Correct the side that is wrong; existing
  behavior does not become normative merely because it is implemented.
