"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { IconButton } from "@/components/ui/icon-button";
import { useSidebar } from "@/components/ui/sidebar";
import { AppBreadcrumb } from "./AppBreadcrumb";

export function AppHeader() {
  const { state, toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        {state === "collapsed" && (
          <IconButton label="사이드바 펼치기" onClick={toggleSidebar}>
            <PanelLeft />
          </IconButton>
        )}
        <AppBreadcrumb />
      </div>
      <Link
        href="/login"
        className="text-sm text-muted-foreground hover:text-foreground hover:no-underline"
      >
        계정
      </Link>
    </header>
  );
}
