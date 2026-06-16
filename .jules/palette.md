## 2024-05-18 - Collapsible Table Sections and DOM Stability

**Learning:** Using conditional unmounting (`{isOpen && items.map(...) }`) inside a `<tbody>` for collapsible groups removes the content from the DOM entirely. This breaks the link for screen readers, as the `id` referenced by the toggle `<button>`s `aria-controls` attribute is lost when collapsed.
**Action:** Always wrap collapsible table toggle headers and content rows in separate `<tbody>` tags using `<Fragment>`. Apply a CSS `.hidden` class to the content `<tbody>` rather than conditionally rendering it to ensure the `id` remains in the DOM for `aria-controls` to reference properly.
