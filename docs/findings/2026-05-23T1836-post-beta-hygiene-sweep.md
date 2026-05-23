---
title: "Post-beta hygiene sweep — dead deps, fragile regex, workflow polish"
created_at: 2026-05-23T18:36:00Z
priority: P2
resolved: false
status_notes: |
  Queue finding. Each H<n> is independent; close per-item with commit sha.
related:
  - docs/findings/2026-05-23T1700-dogfood-followups.md
  - apps/api/src/application/sync-files.ts
  - goals/30-in-tree-isolation.gates.sh
  - .github/workflows/world-health.yml
  - goals/_meta.gates.sh
---

# Findings — small cleanup items batched into a single sweep

## TL;DR

Five independent low-risk cleanups that surfaced during the
2026-05-23 dogfood-findings review. None affect users; each is a
1-file edit. Bundled into one finding because the cost of authoring
five separate findings outweighs the cost of one queue with five
acceptance signals.

Order is irrelevant. Codex (or whoever picks this up) can close any
item independently; mark the closed item in `status_notes` with
commit sha.

---

## H1 — `pushSyncFiles` declares deps it never uses

### Reproducer

`apps/api/src/application/sync-files.ts:10-17`:

```ts
export type SyncFileDeps = {
  branchStore: BranchStore;
  ...
  useCaseStore: UseCaseStore;
} & MarkdownRenderDeps;
```

`MarkdownRenderDeps` adds `actorStore`, `scenarioStore`, `stepStore`,
`stakeholderStore`, `stakeholderInterestStore`. `pushSyncFiles`
(line 91-127) never calls `renderMarkdown`. Routes that wire push
must pass — and tests must mock — five unused stores.

### Fix

Split into two types:

```ts
export type PullSyncDeps = Pick<SyncFileDeps, ...> & MarkdownRenderDeps;
export type PushSyncDeps = Pick<SyncFileDeps, ...>;  // no MarkdownRenderDeps
```

Update `pushSyncFiles` signature, route wiring in
`apps/api/src/http/sync-routes.ts`, and tests that mock the wider type.

### Acceptance signal

- `pushSyncFiles` signature no longer references `MarkdownRenderDeps`
  (direct or transitively).
- `pnpm exec vitest run apps/api` green.

---

## H2 — `goals/30-in-tree-isolation.gates.sh` regex is fragile

### Reproducer

`goals/30-in-tree-isolation.gates.sh` (TEMP_PATTERN / BUILD_PATTERN
checks). Two issues:

1. `TEMP_PATTERN='/tmp/[A-Za-z0-9._-]+'` — matches comments (`# was
/tmp/foo`) and namespaced dynamic paths (`/tmp/build-${SUFFIX}`).
   Will false-positive the next time someone uses
   `mktemp -d /tmp/myprefix-XXXXXX`.
2. `BUILD_PATTERN` covers `pnpm --filter ... build` but not the
   equivalent short form `pnpm -F <pkg> build`. Trivial bypass.

### Fix

- Narrow TEMP*PATTERN to quoted literals only:
  `^[^#]\*['"]/tmp/[A-Za-z0-9.*-]+['"](\s|$)`, or add an allow-list
  comment for namespaced mktemp.
- Extend BUILD_PATTERN to include the `-F` short form.

### Acceptance signal

- Add a self-test: invoke the gate against a fixture file containing
  `# was /tmp/foo` (should pass) and against
  `bash -c 'cp /tmp/literal /dest'` (should fail). Both behave as
  expected.
- `bash goals/30-in-tree-isolation.gates.sh` green on current tree.

---

## H3 — `.github/workflows/world-health.yml` token + issue search

### Reproducer

1. The workflow injects `VERCEL_TOKEN` and pipes vercel CLI output
   into `world-check.log` which is uploaded as an artifact. If
   vercel CLI verbose mode ever prints a token-bearing URL, the
   token leaks via the artifact (which is downloadable by anyone
   with repo read access).
2. Rolling-issue dedup uses
   `q: in:title "${title}"` substring search — fragile to title
   tweaks. A title rename leaves duplicate open issues.

### Fix

- Add `echo "::add-mask::${VERCEL_TOKEN}"` to the workflow's
  setup step so any accidental echo is redacted in logs and
  artifacts.
- Replace the issue-search query with a label-based match
  (`label:world-health`) and ensure the workflow creates issues
  with that label.

### Acceptance signal

- `grep '::add-mask::' .github/workflows/world-health.yml` returns
  ≥1 line.
- Workflow's `gh issue list` / `gh api` invocation references
  `label:world-health` instead of title substring.

---

## H4 — `goals/_meta.gates.sh` LOG_DIR has no cleanup trap

### Reproducer

`goals/_meta.gates.sh` uses `LOG_DIR=$(mktemp -d)` without a
`trap 'rm -rf "$LOG_DIR"' EXIT`. Every chain run leaks one
`/tmp/tmp.XXXXXX/` directory. Over weeks this accumulates.

### Fix

Add the trap, or — if the directory is deliberately retained for
post-mortem debugging on failure — add an explicit `note "logs at
$LOG_DIR"` and an inline comment documenting the choice.

### Acceptance signal

- `goals/_meta.gates.sh` has either a cleanup trap OR an inline
  comment explaining the deliberate retention.

---

## H5 — Trimmed-goal `GATE_INPUTS` are too broad (gate-over-coupling fallout)

### Reproducer

`goals/22-comment-agent-format.gates.sh` declares
`GATE_INPUTS=(apps/api/src apps/cli/src ...)`. Any unrelated change
under `apps/cli/src/` invalidates goal-22's cache. With ~23 goals,
broad inputs make `_gate-cache.sh` near-useless.

### Fix

For goal-22: narrow to
`apps/cli/src/commands/comment*.ts apps/cli/src/application/mutation-*.ts`
(or whichever set the goal's vitest actually exercises). Repeat for
any other trimmed goal with similarly broad inputs.

### Acceptance signal

- `goals/22-comment-agent-format.gates.sh` `GATE_INPUTS` lists ≤ 5
  file globs covering only the goal's actual scope.
- Modifying an unrelated file under `apps/api/src/` no longer
  invalidates goal-22's cache (verify with two consecutive
  `bash scripts/completion-check.sh` runs after the unrelated edit).

---

## Closure protocol

When a sub-item closes, **append** a line to `status_notes`:

```yaml
status_notes: |
  H1 — CLOSED 2026-MM-DD (commit <sha>).
  H2 — open.
  ...
```

Flip `resolved: true` only when **all** H1-H5 are closed. Until then,
keep `resolved: false`.

## Goal promotion judgment

**No** — none of these have a universal claim. Direct work.
