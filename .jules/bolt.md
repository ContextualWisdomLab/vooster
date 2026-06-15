## 2026-06-15 - Memoize derived state from props

**Learning:** Derived state calculated via O(N) grouping operations (like `groupByLevel` or `groupByType`) shouldn't run on every render, especially when the component contains local state for UI interactions (like expanding/collapsing sections). Re-grouping large arrays merely to toggle a CSS class wastes CPU and blocks the main thread.
**Action:** Extract expensive grouping operations into `useMemo` hooks, using the source array as the dependency, to ensure the heavy lifting only happens when the actual data props change.
