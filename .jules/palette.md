## 2025-02-28 - ARIA Controls for Collapsible Table Groups
**Learning:** When conditionally unmounting table row elements via `{isOpen && items.map()}` to mimic collapsible structures, the `aria-controls` attribute on the trigger button cannot link to the content because the ID no longer exists in the DOM. This breaks screen-reader predictability.
**Action:** Extract collapsible rows into their own `<tbody>` with a designated `id`. Use the `hidden` CSS class instead of unmounting so the element identity remains in the DOM structure for `aria-controls` bindings while visually acting the same.
