## 2024-05-24 - Group Toggle Accessibility
**Learning:** Found collapsible elements (like `<tbody>`) in tables that lacked the `aria-controls` attribute on their respective `<button>` toggles, reducing clarity for screen reader users.
**Action:** When implementing collapsible patterns, always ensure the toggle `<button>` has `aria-controls` pointing to the `id` of the controlled element, and `aria-expanded` reflecting its state.
