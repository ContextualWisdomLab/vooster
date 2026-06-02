## 2024-06-02 - Memoize Table Grouping Functions

**Learning:** Unmemoized computation logic in component render paths leads to recalculations on every interactive re-render. `UsecaseTable` and `ActorTable` were iterating and grouping arrays every time their inner `collapsed` state toggled a section.
**Action:** Identify expensive loops/iterations inside list components and wrap them in `useMemo` so that interactive local state changes do not unnecessarily re-run data transformations.
