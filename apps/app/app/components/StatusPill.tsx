import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type Status, statusLabel } from "@/lib/labels";

// Styles cover every spec status enum value. Legacy board statuses are
// intentionally absent — the viewer renders the spec status vocabulary only.
// `dot` colors the Notion-style leading status indicator; `pill` the tint.
const STATUS_STYLES: Record<Status, { pill: string; dot: string }> = {
  DRAFT: { pill: "bg-tint-gray text-foreground", dot: "bg-muted-foreground/60" },
  IN_REVIEW: { pill: "bg-tint-sky text-brand-strong", dot: "bg-brand" },
  APPROVED: { pill: "bg-tint-mint text-success", dot: "bg-success" },
  DEPRECATED: { pill: "bg-tint-peach text-warning", dot: "bg-warning" }
};

const DEFAULT_STYLE = STATUS_STYLES.DRAFT;

export function StatusPill({ status }: { status: string }) {
  const key = status.toUpperCase();
  const variant = key in STATUS_STYLES ? STATUS_STYLES[key as Status] : DEFAULT_STYLE;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full border-transparent px-2 py-0.5 text-xs font-semibold tracking-wide",
        variant.pill
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", variant.dot)}
      />
      {statusLabel(status)}
    </Badge>
  );
}
