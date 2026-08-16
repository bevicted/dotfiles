# Patterns & templates

Use only the sections selected by the repository or required by the current
artifact. Adapt placeholders and local naming; do not introduce a convention
solely because a template appears here.

## RFC 2119 / 8174 conventions block

Use this block when a specification adopts BCP 14. Put it in each standalone
specification, or in a shared conventions document only when every governed
specification explicitly incorporates that document.

```
The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
"SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
"OPTIONAL" in this document are to be interpreted as described in
BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all
capitals, as shown here.
```

Replace the bracketed citation labels with the specification's citation format.

## EARS: five requirement patterns

Use these patterns when the repository selects EARS for behavioral
requirements. Choose the simplest applicable pattern.

| Pattern | Keyword | Template |
| - | - | - |
| Ubiquitous | *(none)* | The `<system>` SHALL `<response>`. |
| State | **While** | While `<precondition>`, the `<system>` SHALL `<response>`. |
| Event | **When** | When `<trigger>`, the `<system>` SHALL `<response>`. |
| Optional | **Where** | Where `<feature included>`, the `<system>` SHALL `<response>`. |
| Unwanted | **If/Then** | If `<trigger>`, then the `<system>` SHALL `<response>`. |

An unwanted-behavior requirement can supply a row in an error contract when the
interface exposes a stable error. A complex requirement may compose conditions:
*While `<precondition>`, when `<trigger>`, the `<system>` SHALL `<response>`.*

## EBNF symbol legend (ISO/IEC 14977)

Use this ISO/IEC 14977 legend when the repository selects that EBNF notation.
Place it beside the first grammar block governed by the legend.

```
=      defined as            ,   concatenation
|      alternative (or)      ;   end of rule
{ }    repeat 0 or more      [ ] optional (0 or 1)
( )    group                 " " literal terminal
? ?    special / external (prose-defined token)
```

## Error catalog shape

Use an error catalog only when the interface exposes stable error conditions.
Start with interface-neutral fields:

| ID | Condition | Observable response |
| - | - | - |
| `ERR_UNKNOWN_INPUT` | An input name is unknown. | Reject the input and identify the unknown name. |

For a CLI contract, add columns such as exit status, stdout, and stderr only when
those surfaces are part of the requested contract:

| ID | Trigger | Exit status | stderr |
| - | - | - | - |
| `ERR_UNKNOWN_INPUT` | Input name is unknown. | `<defined status>` | `error: unknown input <name>` |

## Terminology vs glossary

Apply this distinction when deciding whether a definition changes the meaning of
a requirement.

- **Terminology** is normative when contract clauses depend on the definition.
  Define each such term once in the repository's chosen specification location.
- **Glossary** content is informative reader assistance. Keep it outside the
  normative contract unless a clause depends on it.

## Sources

- RFC 2119: https://www.rfc-editor.org/rfc/rfc2119
- RFC 8174: https://www.rfc-editor.org/rfc/rfc8174
- EARS (Alistair Mavin): https://alistairmavin.com/ears/
- EBNF: ISO/IEC 14977
