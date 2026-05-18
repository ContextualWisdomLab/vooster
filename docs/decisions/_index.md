# Architecture Decision Records (ADRs)

This directory is **append-only**. Existing ADRs are never edited; superseding
decisions get a new ADR that references the old one.

## Format

```
docs/decisions/ADR-NNN-short-slug.md
```

```markdown
# ADR-NNN — Short Title

Date: YYYY-MM-DD
Status: PROPOSED | ACCEPTED | SUPERSEDED-BY ADR-MMM

## Context

What is the situation that demands a decision?

## Decision

What we are doing.

## Consequences

What follows from this — both costs and benefits.
```

## When to Write One

- Adding or removing a dependency.
- Changing a hard rule in `AGENTS.md` or `docs/02-tech-stack.md`.
- Reversing a previous decision.
- Anything you'd want to explain to a teammate in 6 months.

## Index

(none yet)
