## 2024-06-16 - Memoize O(N) array grouping in table components
**Learning:** Collapsible table sections in React often trigger local state updates on every toggle. If grouping logic (like `groupByLevel` traversing a full array) runs inline during render, expanding/collapsing becomes unnecessarily expensive for large lists.
**Action:** Always wrap `O(N)` mapping or grouping operations derived from props in a `useMemo` hook, using the source array as the dependency, to ensure fast UI interactions.
