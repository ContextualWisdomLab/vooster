"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Icon button with a uniform hover affordance and tooltip. The `ghost` variant
 * supplies the faint-grey hover background and radius shared by every icon
 * button; the tooltip primitive supplies the black/white speech bubble.
 */
export function IconButton({
  label,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
