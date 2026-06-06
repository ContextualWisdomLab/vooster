## 2024-12-08 - Loading States for Async Actions
**Learning:** Loading spinners during async submit actions provide immediate user feedback, clarifying that the system is processing their request.
**Action:** Always include a visual loading indicator (like `Loader2` from `lucide-react` with `animate-spin`) on submit buttons when `useTransition` or other async state indicates a pending operation. Ensure the button is disabled to prevent duplicate submissions.
