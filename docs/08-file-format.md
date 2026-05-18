# 08 — File Format (Local Markdown)

This is the **canonical on-disk format** for vspec entities. The same format is
used by:

- The `docs/usecases/UC-*.md` specs of vspec itself.
- The `specs/` directory of any vspec project.
- `vspec usecase edit` (opens a buffer in this format).
- The Markdown export endpoint.

## Directory Layout

```
<project root>/
├── .vspec/
│   ├── config.json        # project binding, defaults
│   ├── session.json       # current session (if any)
│   └── cache/             # last-pulled revisions, for diffs
└── specs/
    ├── actors/
    │   ├── customer.md
    │   ├── system.md
    │   └── ...
    ├── stakeholders/
    │   ├── customer.md
    │   └── ...
    ├── goals/
    │   ├── G-001-...md
    │   └── ...
    └── usecases/
        ├── UC-001-...md
        └── ...
```

## Frontmatter Block

YAML between `---` fences at the top of every file.

### `UseCase` frontmatter

```yaml
---
vspec_format: 1
type: usecase
id: UC-009
key: VSPEC-009              # human ID assigned per project
title: Author a use case from scratch
level: USER_GOAL            # SUMMARY | USER_GOAL | SUBFUNCTION
format: FULLY_DRESSED       # BRIEF | CASUAL | FULLY_DRESSED
status: DRAFT               # DRAFT | IN_REVIEW | APPROVED | DEPRECATED
priority: P0                # P0 | P1 | P2 | P3
scope: vspec
primary_actor: developer-pm
frequency: daily            # optional
revision: rev_abc123        # set by sync; do not hand-edit
---
```

### `Actor` frontmatter

```yaml
---
vspec_format: 1
type: actor
id: A-001
name: developer-pm
display_name: Developer / PM
actor_type: PRIMARY         # PRIMARY | SUPPORTING | OFFSTAGE
is_human: true
aliases: [pm, dev]
---
```

### `Stakeholder` frontmatter

```yaml
---
vspec_format: 1
type: stakeholder
id: S-001
name: vooster
display_name: Vooster (us)
stakeholder_type: INTERNAL  # INTERNAL | EXTERNAL | REGULATORY
---
```

### `Goal` frontmatter

```yaml
---
vspec_format: 1
type: goal
id: G-001
actor: developer-pm
level: USER_GOAL
status: PROMOTED            # IDENTIFIED | IN_DESIGN | PROMOTED | REJECTED
linked_usecase: UC-009
priority: P0
---
```

## Body Format for `UseCase`

Sections are recognized by exact heading text. They may appear in any order;
the parser sorts them on export.

````markdown
# <Title>

> One-paragraph context blurb (optional, free-form).

## Stakeholders and Interests

- **<Stakeholder display name>**: <interest>. _(Protected by: <step ref or guarantee>)_
- **<Stakeholder>**: <interest>.

## Preconditions

- <Precondition 1>
- <Precondition 2>

## Trigger

<One sentence.>

## Main Success Scenario

1. **<Actor>** <verb phrase>.
2. **System** <verb phrase>.
3. **<Actor>** <verb phrase>.
...

## Extensions

### 3a. <Condition>

- 3a1. **System** <verb phrase>.
- 3a2. **<Actor>** <verb phrase>.
- (Outcome: FAILURE — use case ends.)

### *a. <Any-step condition>

- *a1. ...
- (Outcome: PARTIAL — rejoins main at step 4.)

## Success Guarantee

<Sentence or short paragraph.>

## Minimal Guarantee

<Sentence or short paragraph.>

## Notes

<Free-form. Not part of the contract.>
````

## Parsing Rules

- **Bold actor name** at the start of a step (`**Actor** ...`) is mandatory.
  The parser maps it to the project's `Actor` registry; unknown names are an
  error.
- Step numbering is 1-based and contiguous. Re-numbering on save is automatic.
- Extension IDs match `^\d+[a-z]$` or `^\*[a-z]$`. Substeps are `<id>\d+`.
- Outcome lines `(Outcome: SUCCESS|FAILURE|PARTIAL — ...)` are parsed
  case-insensitively. Default outcome of an extension is `FAILURE`.
- `_(Protected by: ...)_` lines on stakeholders are parsed into
  `StakeholderInterest.protection_mechanism`.

## Round-Trip Guarantee

For any well-formed file `F`:

```
serialize(parse(F)) === normalize(F)
```

where `normalize` re-orders sections to canonical order, trims trailing
whitespace, and re-numbers steps. CI runs this on every spec on every push to
catch silent drift.

## Conflict Markers

On `vspec pull` conflict, the local file gets Git-style markers:

```
<<<<<<< local
**Customer** submits the order.
=======
**Customer** confirms the order.
>>>>>>> remote (rev_xyz, by alice 2026-05-18T10:00:00Z)
```

`vspec sync` refuses to push until all markers are resolved.

## Validation

`vspec doctor <path>` validates a file without network. It checks:

1. Frontmatter required fields.
2. Section presence (per `format`).
3. Actor references exist in `specs/actors/`.
4. Stakeholder references exist.
5. Step actor bolding.
6. Extension numbering.

Exit code 0 means valid; non-zero with structured stderr on failure.

## Example File

See `docs/usecases/UC-009-author-usecase.md` for a worked example.
