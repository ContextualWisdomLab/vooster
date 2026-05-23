---
title: "CLI onboarding hint points to `vspec login` for a `vspec init` problem"
created_at: 2026-05-23T18:36:00Z
priority: P1
resolved: false
related:
  - docs/findings/2026-05-22T1632-dogfood-snapshot.md
  - apps/cli/src/flag-values.ts
  - apps/cli/src/commands/init.ts
---

# Findings — first-time onboarding error message is wrong

## TL;DR

When a user runs any CLI command that requires a `project-id` (or other
flag) without having run `vspec init`, the error tells them to run
`vspec login`. But `vspec login` does **not** set the project context —
only `vspec init --project <KEY>` does (see dogfood-snapshot A8/A9).
The user runs `vspec login`, nothing changes, they hit the same error,
and they churn. First-time onboarding is the highest-stakes UX moment
and we are lying in it.

## Reproducer

1. `apps/cli/src/flag-values.ts:47`:

   ```ts
   throw new Error(`Missing ${key}. Run 'vspec login' or pass --${key}.`);
   ```

   Triggered for any missing required flag including `project-id`.

2. `apps/cli/src/commands/init.ts:114`:

   ```ts
   throw new CLIError("Run 'vspec login' before init.", { exit: 6 });
   ```

   Triggered when `runInit` is invoked without a logged-in session.
   This one **is** correctly suggesting `vspec login` (auth required
   for init), so it stays.

The bug is in `flag-values.ts:47` only. Calling out both because they
look identical at grep-time and a future agent might "fix" the
wrong one.

## Concrete user flow

```
$ vspec usecase show
Error: Missing project-id. Run 'vspec login' or pass --project-id.

$ vspec login           # opens browser, logs in
Logged in.

$ vspec usecase show
Error: Missing project-id. Run 'vspec login' or pass --project-id.   ← same error

# user confusion: "I just logged in?!"
```

The correct fix would have routed them to `vspec init --project <KEY>`,
which persists the project context.

## Proposed fix

Change `apps/cli/src/flag-values.ts:47` to:

```ts
throw new Error(`Missing ${key}. Run 'vspec init --project <KEY>' or pass --${key}.`);
```

If `key !== "project-id"` for other future flags, generalize the hint
per-key. For now, all callers that hit this throw are project-context
checks (verified by grepping callers of `resolveContextFlag` /
`requiredFlag`), so the universal suggestion is correct.

**Do not touch** `apps/cli/src/commands/init.ts:114` — that one really
does need auth.

## Acceptance signal

- Unit test on `flag-values.ts` (or the calling resolver): assert the
  thrown error message contains `'vspec init --project'` and **not**
  `'vspec login'`.
- Negative grep:
  `rg "Run 'vspec login'.*pass --" apps/cli/src` returns 0.

## Goal promotion judgment

**No**. Two-line fix with one assertion. Single direct commit.
