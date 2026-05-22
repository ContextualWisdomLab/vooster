"use client";

import { FolderClosed } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import type { ProjectSummary } from "../../data";

export function AppSidebar({ projects }: { projects: ProjectSummary[] }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          aria-label="Vooster home"
          className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-foreground hover:no-underline"
        >
          <Image
            src="/logo.png"
            alt=""
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-sm"
            priority
          />
          <span className="group-data-[collapsible=icon]:hidden">Vooster</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.length === 0 ? (
                <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                  No projects yet
                </div>
              ) : (
                projects.map((project) => {
                  const href = `/projects/${project.id}`;
                  const isActive = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={project.name}>
                        <Link href={href}>
                          <FolderClosed />
                          <span>{project.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
