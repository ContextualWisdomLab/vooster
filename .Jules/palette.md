## 2026-06-08 - Added visual loading state to async buttons
**Learning:** When using shadcn/ui buttons with Lucide React icons, adding an 'animate-spin' utility class directly to the icon creates a simple and effective loading indicator. Adding this to async operations like dialog submissions significantly improves user feedback by clearly indicating the action is processing.
**Action:** Always include a visual loading state (like <Loader2 className="animate-spin" />) alongside disabled states for buttons that trigger asynchronous actions.
