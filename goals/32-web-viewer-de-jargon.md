# Goal 32 — Web viewer canonical terminology

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

The web viewer must present use-case fields with canonical Korean product
terms and on-demand glossary help instead of raw code field names or raw enum
values.

## Why This Goal Exists

This promotes `docs/findings/2026-05-25T1503-web-viewer-de-jargon.md`.
The current viewer leaks terms such as `primary_actor`, `main_scenario`,
`extensions`, `stakeholder_interests`, raw level enums, and non-spec status
labels into the UI. That blocks the beta activation path because users see the
storage contract instead of the product vocabulary.

## Delegation

- owner: claude
- cwd: apps/web
- model: opus

## Completion Conditions

1. The project overview and use-case detail pages show canonical labels for
   use-case concepts, including `Use cases` as `유스케이스`.
2. No raw JSX label text remains for `primary_actor`, `main_scenario`,
   `extensions`, or `stakeholder_interests`.
3. The project overview and use-case detail pages do not render raw level enum
   values directly.
4. `StatusPill` covers every spec status enum value:
   `DRAFT`, `IN_REVIEW`, `APPROVED`, and `DEPRECATED`.
5. `apps/web/lib/labels.ts` exhaustively maps level and status enum values to
   stable Korean labels.
6. The glossary contains descriptions for actor, level, main scenario,
   extension, and stakeholder interest terms, and the pages expose those terms
   through a `?` popover affordance.
7. Web unit tests and typecheck pass.

## Sources Of Truth

- `docs/findings/2026-05-25T1503-web-viewer-de-jargon.md`
- `apps/web/DESIGN.md`
- `apps/web/app/(app)/projects/[key]/page.tsx`
- `apps/web/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx`
- `apps/web/app/components/StatusPill.tsx`
- `apps/web/lib/labels.ts`

## Verification

```
pnpm --filter @vooster/web test
pnpm --filter @vooster/web typecheck
bash goals/32-web-viewer-de-jargon.gates.sh
bash scripts/completion-check.sh
```
