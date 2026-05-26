# Goal 34 — Web invocation links

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

The web use-case detail viewer must render step-level invocation links from the
API's `invokes` field and the derived reverse `invoked_by` view.

## Why This Goal Exists

This is Stage 1b of
`docs/findings/2026-05-26T1504-usecase-invocation-links.md`. Stage 1a already
landed the backend contract: steps expose `invokes: string[]`, and a use-case
read exposes derived `invoked_by`. The remaining Stage 1 work is presentation:
users need to see which lower-level use cases a step calls, and where the
current use case is called from.

## Delegation

- owner: claude
- cwd: apps/app
- model: opus

## Completion Conditions

1. `apps/app/app/data.tsx` models `invokes: string[]` on use-case detail steps.
2. `apps/app/app/data.tsx` models the API's derived `invoked_by` list for use
   case details.
3. The use-case detail page renders a "호출" affordance for step-level invoked
   use-case keys when a step has invocations.
4. The use-case detail page renders a "호출됨" section from `invoked_by`.
5. Auth-stub detail data includes at least one step invocation and one
   `invoked_by` entry so the read-only viewer can be inspected without a live
   backend fixture.
6. Web unit tests and typecheck pass.

## Sources Of Truth

- `docs/findings/2026-05-26T1504-usecase-invocation-links.md`
- `apps/app/DESIGN.md`
- `apps/app/app/data.tsx`
- `apps/app/app/data.stub.tsx`
- `apps/app/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx`
- `apps/app/tests/unit/`
- `apps/app/tests/e2e-web/tier1.spec.ts`

## Verification

```
pnpm --filter @vooster/app test
pnpm --filter @vooster/app typecheck
bash goals/34-web-invocation-links.gates.sh
bash scripts/completion-check.sh
```
