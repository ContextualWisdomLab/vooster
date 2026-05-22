---
name: commit
description: Commit protocol for vspec — when and how to make commits during TDD cycles, staged-impact pre-commit checks, full regression before push/merge, Conventional Commits format, push cadence, and open-source hygiene (secrets, .gitignore). Use whenever about to run `git commit`, install the pre-commit hook, push, or stage files in this repo.
user-invocable: true
allowed-tools:
  - Read
  - Bash
---

# /commit — vspec Commit Protocol

This skill is the single source of truth for git/commit behavior in the
vspec repo. AGENTS.md intentionally contains no commit rules — they all
live here.

## When to commit during a TDD iteration

Each TDD phase ends with its own commit. If a commit message needs "and"
to describe it, the step was too big — split it.

1. **RED phase**
   - Write the failing test.
   - Run it, confirm it fails.
   - `git commit` with subject `red: <UC-ID> <test-name>`.

2. **GREEN phase**
   - Write the minimum production code to make the test pass.
   - Run that test, confirm it passes.
   - Run ALL tests, confirm none broken.
   - Delete the test's section from `docs/state/test-plan.md` (the plan
     is a queue — once GREEN, the committed test in `tests/` is the
     source of truth, and the planning entry would only rot).
   - `git commit` with subject `green: <UC-ID> <description>`.

3. **REFACTOR phase** (only if there is duplication or unclear code)
   - Improve the code.
   - Run ALL tests after each change.
   - `git commit` with subject `refactor: <UC-ID> <description>`.

Never commit failing tests on a `green:` or `refactor:` commit.

## Commit boundary: the pre-commit hook

`git commit` is the staged-impact regression boundary for the goal
harness. Install the pre-commit hook once per checkout:

```
ln -sf ../../scripts/hooks/pre-commit .git/hooks/pre-commit
```

From then on, every `git commit` runs `scripts/commit-check.sh`, which
checks staged hygiene, blocks obvious unsafe files, and runs the nearest
impacted tests or goal gates it can select safely. Broad or unknown
changes print a clear warning to run the full sweep:

```
bash scripts/completion-check.sh
```

Use `git commit --no-verify` only when you knowingly want a broken
intermediate state on the branch.

## Full regression boundary: pre-push, CI, and manual verify

Install the optional pre-push hook once per checkout when you want local
pushes to enforce the full goal sweep:

```
ln -sf ../../scripts/hooks/pre-push .git/hooks/pre-push
```

The full prior-goal regression boundary is `scripts/completion-check.sh`.
Run it manually with either of these commands:

```
pnpm verify
bash scripts/completion-check.sh
```

CI also runs `scripts/completion-check.sh`; branch protection should
require that status before merge. Use `git push --no-verify` only when
you knowingly need to share a broken intermediate branch.

## Commit message format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>)?: <description>

[optional body]

[optional footer(s)]
```

- `<type>` is one of: `red`, `green`, `refactor`, `setup`, `docs`,
  `chore`, `fix`, `feat`, `test`, `perf`, `build`, `ci`, `revert`.
- Subject ≤ 72 chars, imperative mood, no trailing period.
- Body explains the _why_ when not obvious.
- Use `BREAKING CHANGE:` footer for incompatible changes.
- One logical change per commit.

## Push cadence

- Push after each TDD cycle completes (RED → GREEN → REFACTOR), or at
  minimum at the end of every iteration. Do not let local commits pile
  up unpushed.
- Never amend or force-push commits that have already been pushed.

## Open-source hygiene

This repository is open source. Anything committed becomes permanent
public history — even after deletion, the data lives on in git history
and forks.

### `.gitignore` discipline

Maintain `.gitignore` proactively. Before adding any new tool,
framework, or workflow, ensure its generated artifacts (build output,
caches, logs, local config, IDE files, OS files, env files) are ignored
_before_ the first run.

Common patterns to ignore:

- `.env`, `.env.*` (except `.env.example`)
- `node_modules/`, `dist/`, `build/`, `coverage/`
- `.DS_Store`, `*.log`
- `.vscode/`, `.idea/`
- local database files
- credential files (`*.pem`, `*.key`, `*.p12`)
- Prisma local dev artifacts

### Never commit

- API keys, tokens, passwords
- OAuth client secrets
- database URLs with credentials
- personal identifiers, internal-only URLs, customer data
- anything you would not paste into a public issue
- secrets or local config (use `.env.example` only)

### Pre-commit secret scan

Before every commit:

```
git diff --cached
```

Scan the output for secrets. If unsure, check `git status` for
unexpected files.

### If a secret is ever committed

1. Rotate the secret immediately.
2. Purge it from history.
3. Assume the secret is compromised the moment it touches a public
   remote.

## State-file overrides

`docs/state/next-task.md` is auto-generated. You can override it only
with a one-line note at the top explaining the override, followed by a
commit that captures the override.
