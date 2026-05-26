"use client";

import { ChevronsLeftIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { AppBreadcrumb } from "./AppBreadcrumb";

export function AppHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-2 border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          aria-label="사이드바 토글"
          className="text-muted-foreground/60 hover:text-muted-foreground"
        >
          <ChevronsLeftIcon />
        </Button>
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
