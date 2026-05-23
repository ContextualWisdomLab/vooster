# Goal 31 — Canonical markdown in sync conflicts

## Mission

Sync conflict responses must show the current remote use case as canonical
markdown, not a stripped frontmatter-plus-title stub.

## Completion Conditions

1. No application or HTTP sync conflict path calls `usecaseMarkdown`.
2. The stale sync push path returns conflict content whose remote half includes
   canonical Cockburn sections.
3. Goal 31's own gate remains a small negative-universal grep and passes
   `scripts/check-gate-rigor.sh`.

## Sources Of Truth

- `apps/api/src/application/sync-files.ts`
- `apps/api/src/http/sync-result-support.ts`
- `apps/api/src/http/sync-markdown.ts`
- `apps/api/tests/e2e/UC-029.test.ts`

## Verification

```
pnpm exec vitest run apps/api/tests/e2e/UC-029.test.ts
bash goals/31-sync-conflict-canonical-markdown.gates.sh
bash scripts/completion-check.sh
```
