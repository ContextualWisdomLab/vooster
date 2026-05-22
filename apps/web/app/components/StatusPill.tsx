const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-tint-gray text-charcoal",
  READY: "bg-tint-mint text-success",
  IN_PROGRESS: "bg-tint-sky text-accent-strong",
  DONE: "bg-tint-mint text-success",
  BLOCKED: "bg-tint-peach text-warning"
};

const DEFAULT_STYLE = "bg-tint-gray text-charcoal";

export function StatusPill({ status }: { status: string }) {
  const variant = STATUS_STYLES[status.toUpperCase()] ?? DEFAULT_STYLE;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${variant}`}
    >
      {status}
    </span>
  );
}
