## 2024-06-15 - Accessible Collapsible Tables

**Learning:** Conditionally unmounting `<tbody>` rows in React breaks accessibility for controlled elements because the `id` disappears from the DOM, rendering `aria-controls` on the toggle button orphaned.
**Action:** Extract collapsible rows into their own `<tbody id={groupId}>`, use `<Fragment>` to separate the toggle row from the content rows, and hide the content `<tbody>` using a CSS `hidden` class instead of unmounting it.
