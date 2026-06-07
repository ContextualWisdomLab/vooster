## 2024-06-25 - Prevent Unnecessary Array Grouping in React Renders
**Learning:** O(n) array grouping operations (`groupByLevel`, `groupByType`) in components with local state like `collapsed` will re-run on every state change, generating new objects and unnecessarily blocking the main thread during UI interactions.
**Action:** Always wrap expensive or array-iterating functions in `useMemo` when their inputs are stable (like static props) but the component holds local interaction state (like toggles/modals).
