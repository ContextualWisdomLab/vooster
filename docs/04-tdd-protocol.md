# 04 — TDD Protocol (Enforced)

This protocol is enforced by `scripts/verify-tdd.sh` and
`scripts/check-bypass.sh`. Violations stop iteration.

## The Cycle

```
                ┌─────────┐
                │   RED   │  Write a failing test.
                └────┬────┘
                     ↓
                ┌─────────┐
                │  GREEN  │  Make it pass (minimum code).
                └────┬────┘
                     ↓
            ┌─────────────────┐
            │   REFACTOR      │  Clean up. All tests still pass.
            │   (optional)    │
            └────┬────────────┘
                 ↓
              Repeat
```

## Mandatory Commit Pattern

Each phase ends with a commit. The pattern is enforced:

```
red:      <UC-ID> <test description>
green:    <UC-ID> <implementation description>
refactor: <UC-ID> <refactoring description>
```

Examples:
- `red: UC-009 fail when title is empty`
- `green: UC-009 reject empty title with 400`
- `refactor: UC-009 extract title validator`

All commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`<type>[(<scope>)]: <description>`. Recognized `<type>` values:

| Prefix     | Meaning                                                         |
| ---------- | --------------------------------------------------------------- |
| `red:`     | New failing test added.                                         |
| `green:`   | Minimum code that makes a failing test pass.                    |
| `refactor:`| Behavior-preserving improvement; all tests stay green.          |
| `setup:`   | Initial scaffolding (package.json, configs, no tests yet).      |
| `docs:`    | Documentation-only changes (no code, no tests).                 |
| `chore:`   | Maintenance, dep updates, config changes.                       |
| `fix:`     | Regression fix; the regression test must be included.           |
| `feat:`    | New feature (rare here — features arrive via red→green).        |
| `test:`    | Test-only change (e.g. fixtures, helpers) outside a TDD cycle.  |
| `perf:`    | Performance improvement with no behavior change.                |
| `build:`   | Build system / dependency changes.                              |
| `ci:`      | CI configuration.                                               |
| `revert:`  | Explicit revert; reference the original SHA in the body.        |

Any other prefix is rejected by `scripts/verify-tdd.sh`.

## Validation Rules

`verify-tdd.sh` checks:

1. The last commit's message matches the allowed prefix pattern.
2. Every `green:` commit in the last 10 must be preceded by a `red:` commit
   (for the same UC-ID) within the prior 5 commits.
3. Every `green:` commit increases the count of passing tests by ≥1.
4. No commit reduces the total test count.
5. No commit weakens an assertion in a previously-existing test (sampled diff
   check; failure prints which test).

## Banned Test Patterns

`check-bypass.sh` greps for and rejects:

- `expect(true).toBe(true)`
- `expect(true).toEqual(true)`
- `expect(1).toBe(1)`
- `expect(x).toBe(x)` style tautologies
- Tests with no `expect(` call
- `.skip(`, `.todo(`, `xit(`, `xtest(`, `xdescribe(` on main branch
- `vi.mock` of a path under `src/application/` or `src/domain/` from an E2E test
- Hardcoded HTTP response bodies from a route handler that bypass the application
  layer (heuristic: handler with no imports from `src/application/`)

## Coverage Requirements

Per `vitest.config.ts`:

- Each use case: ≥1 E2E test covering the main scenario.
- Each use case: ≥1 E2E test per documented extension (`3a`, `4a`, etc.).
- Overall statement coverage: ≥ 80%.
- Overall branch coverage: ≥ 75%.
- Overall function coverage: ≥ 80%.
- Overall line coverage: ≥ 80%.

The coverage gate is part of `completion-check.sh`.

## Refactor Triggers

Always refactor when one of these is true:

- A function exceeds 20 lines.
- A file exceeds 200 lines.
- Duplication exists in 3+ places.
- A name does not reveal intent.
- A test reveals an awkward design (hard to set up, fragile, etc.).

## Mutation Sampling

Run `scripts/mutation-sample.sh` against a recently changed application slice.
By default it mutates `src/http/usecase-from-goal.ts` and runs the UC-009
from-goal E2E tests. Override the mutate target and test file glob when the
current iteration changes a different application slice:

```
bash scripts/mutation-sample.sh src/http/usecase-from-goal.ts 'tests/e2e/UC-009*.test.ts'
```

Any surviving mutant on a public-facing behavior is a fail. Equivalent mutants
must be justified by simplifying the code or by documenting why they do not
represent observable behavior.

Goal: catch tests that pass for the wrong reason.

## Self-Dogfooding Test

The final acceptance:

```
bash scripts/dogfood-test.sh
```

This script:

1. Builds the TypeScript project.
2. Starts a fresh in-memory Fastify server with stub GitHub auth.
3. Authenticates as a synthetic GitHub user.
4. Creates a workspace project, actor, and stakeholder.
5. Imports every file in `docs/usecases/UC-*.md` as a real use case through the
   API.
6. Adds and verifies a comment on one use case.
7. Adds a stakeholder interest, main scenario, and step.
8. Exports Gherkin for one use case and validates that it begins with
   `Feature:`.

If this passes, the system genuinely works.

## When Tests Are Hard To Write

Listen to the test. Hard tests usually mean:

- The unit is doing too much (split it).
- Dependencies are hidden (inject them).
- State is implicit (make it explicit).

Do **not** reach for heavier mocking. Reach for design changes.

## TDD Rules of Engagement (operational)

1. You may not write any production code unless it is to make a failing test
   pass.
2. You may not write more of a test than is sufficient to fail (compile errors
   count as failure).
3. You may not write more production code than is sufficient to pass the
   currently failing test.

(These three are Uncle Bob's restatement of Kent Beck's TDD; vspec adopts them
verbatim.)
