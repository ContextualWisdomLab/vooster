import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hasSessionCookie } from "../auth";
import { fetchProjects } from "../data";
import { AppHeader } from "./components/AppHeader";
import { AppSidebar } from "./components/AppSidebar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await hasSessionCookie())) {
    redirect("/login");
  }

  const projects = await fetchProjects();

  return (
    <TooltipProvider delayDuration={150}>
      <SidebarProvider>
        <AppSidebar projects={projects} />
        <SidebarInset>
          <AppHeader />
          <div className="mx-auto w-full max-w-4xl px-6 py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
