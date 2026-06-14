## 2024-06-14 - Accessible Collapsible Table Sections
**Learning:** When creating collapsible rows inside a `<table>`, conditionally unmounting the content rows breaks the `aria-controls` relationship because the target ID disappears from the DOM.
**Action:** Wrap the toggle row and the content rows in separate `<tbody>` tags within a React `<Fragment>`. Use a CSS `hidden` class on the content `<tbody>` to visually hide it while keeping its ID in the DOM for screen readers.
