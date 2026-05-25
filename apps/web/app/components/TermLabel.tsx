"use client";

import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GLOSSARY, type GlossaryKey } from "@/lib/labels";

// Pairs a canonical product term with an on-demand `?` popover. The label is the
// stable vocabulary (유스케이스·주요 액터…) and the popover carries the one-line
// glossary description so unfamiliar users can click to learn without the label
// being paraphrased. Read-only — the popover only displays glossary copy.
export function TermLabel({
  term,
  className
}: {
  term: GlossaryKey;
  className?: string;
}) {
  const { label, description } = GLOSSARY[term];
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {label}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label} 설명`}
            className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-xs text-sm leading-relaxed">
          {description}
        </PopoverContent>
      </Popover>
    </span>
  );
}
