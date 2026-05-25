import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Status, statusLabel } from "@/lib/labels";

// Styles cover every spec status enum value. Legacy board statuses
// (READY/IN_PROGRESS/DONE/BLOCKED) are intentionally absent — the viewer
// renders the spec status vocabulary only.
const STATUS_STYLES: Record<Status, string> = {
  DRAFT: "bg-tint-gray text-foreground",
  IN_REVIEW: "bg-tint-sky text-brand-strong",
  APPROVED: "bg-tint-mint text-success",
  DEPRECATED: "bg-tint-peach text-warning"
};

const DEFAULT_STYLE = "bg-tint-gray text-foreground";

export function StatusPill({ status }: { status: string }) {
  const key = status.toUpperCase();
  const variant = key in STATUS_STYLES ? STATUS_STYLES[key as Status] : DEFAULT_STYLE;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-transparent px-2 py-0.5 text-xs font-semibold tracking-wide",
        variant
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}
