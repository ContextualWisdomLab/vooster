## 2026-06-17 - React O(N) Array Grouping Recalculations During Local State Changes
**Learning:** React array grouping logic (e.g. `groupByLevel` and `groupByType`) inside components unneccesarily re-calculates groups when completely unrelated local UI state changes occur, like opening or closing an accordion menu.
**Action:** Always wrap grouping functions inside table or list components in `useMemo` hooks, leveraging the un-mutated source arrays as the primary dependencies.
