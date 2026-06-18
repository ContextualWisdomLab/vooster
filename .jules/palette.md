## 2024-06-18 - Accessible Collapsible Table Sections

**Learning:** When implementing collapsible table sections (`<tbody>`), conditionally unmounting the content in React causes its `id` to be removed from the DOM. This breaks the `aria-controls` attribute on the toggle button, which expects the controlled element to be present.
**Action:** Always render the collapsible table content into the DOM and toggle its visibility using a CSS class (like `.hidden`) instead of conditional rendering. This keeps the `id` available for `aria-controls` and provides a nice performance boost (avoiding DOM remounts). Extracting heavy grouping operations into `useMemo` hooks is also critical to prevent recalculations when these toggles update local state.
