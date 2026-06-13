## 2024-05-24 - Accessibility for Collapsible Table Groupings
**Learning:** Collapsible table groupings (`tbody` rows expanding/collapsing on toggle) were missing `aria-controls` bindings to screen readers, preventing them from understanding the relationship between the toggle and the controlled content.
**Action:** When implementing expand/collapse functionalities, always add an `id` to the controlled region (like `tbody`) and link it back to the toggle button via `aria-controls`, in addition to `aria-expanded`.
