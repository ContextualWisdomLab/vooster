## 2025-06-10 - Adding visual feedback to async actions
**Learning:** Adding visual cues (loading spinners) to buttons when executing async actions prevents users from repeatedly clicking the button and adds a smooth polished feel to the interface without breaking any a11y standards.
**Action:** Always include a visual loading state (`Loader2` spinner with `animate-spin`) for any buttons handling asynchronous submission, such as dialog confirmation buttons.
