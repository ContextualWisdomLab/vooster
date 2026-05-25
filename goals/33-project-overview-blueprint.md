# Goal 33 — Project overview blueprint

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

The web project overview must enrich the flat use-case list with substance
counts and exception emphasis so the page reads as a structured blueprint, not
just a table of contents.

## Why This Goal Exists

This promotes the frontend slice of
`docs/findings/2026-05-25T1511-project-overview-blueprint.md`. The backend
slice is already present: `GET /v1/projects/:projectId/usecases` returns
`scenario_count` and `extension_count` per item, and the existing actors
endpoint can supply actor count. The remaining work is presentation-layer
rendering in `apps/web`.

## Delegation

- owner: claude
- cwd: apps/web
- model: opus

## Completion Conditions

1. `apps/web/app/data.tsx` models `scenario_count` and `extension_count` on
   every `UsecaseSummary`.
2. `apps/web/app/data.tsx` exposes a project actors fetcher so the overview can
   show actor count without adding a new API endpoint.
3. The project overview renders a substance count line containing
   `유스케이스`, `액터`, and `시나리오`.
4. Every use-case row on the overview renders an `예외 N` count based on that
   row's `extension_count`.
5. The overview renders a `대비된 예외 상황 N건` summary block using the total
   extension count.
6. Web tests and typecheck pass.

## Sources Of Truth

- `docs/findings/2026-05-25T1511-project-overview-blueprint.md`
- `docs/findings/2026-05-25T1503-web-viewer-de-jargon.md`
- `apps/web/app/data.tsx`
- `apps/web/app/(app)/projects/[key]/page.tsx`
- `apps/web/tests/unit/`
- `apps/web/tests/e2e-web/tier1.spec.ts`

## Verification

```
pnpm --filter @vooster/web test
pnpm --filter @vooster/web typecheck
bash goals/33-project-overview-blueprint.gates.sh
bash scripts/completion-check.sh
```
