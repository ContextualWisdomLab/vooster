import { cn } from "@/lib/utils";
import { type Level, levelLabel } from "@/lib/labels";

// Notion-style "type" tag: a soft pastel chip with a small radius (not a full
// pill — that vocabulary is reserved for StatusPill). Color encodes the
// Cockburn abstraction level so the list scans at a glance: USER_GOAL carries
// the brand tint as the primary unit, SUMMARY a distinct lavender, SUBFUNCTION
// a muted gray.
const LEVEL_STYLES: Record<Level, string> = {
  USER_GOAL: "bg-tint-sky text-brand-strong",
  SUMMARY: "bg-tint-lavender text-foreground/80",
  SUBFUNCTION: "bg-tint-gray text-muted-foreground"
};

const DEFAULT_STYLE = LEVEL_STYLES.SUBFUNCTION;

export function LevelTag({ level }: { level: string }) {
  const key = level.toUpperCase();
  const variant = key in LEVEL_STYLES ? LEVEL_STYLES[key as Level] : DEFAULT_STYLE;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        variant
      )}
    >
      {levelLabel(level)}
    </span>
  );
}
