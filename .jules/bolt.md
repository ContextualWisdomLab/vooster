## 2024-06-13 - [useMemo for UI Rendering Performance]
**Learning:** [In React, rendering performance for components with collapsible sections displaying groups of data can degrade if data grouping functions are called redundantly on every section toggle (which updates local state).]
**Action:** [Use `useMemo` to cache the grouped data results based on the original data array dependency to prevent unnecessary `O(n)` iterations across items during local state-driven UI re-renders.]
