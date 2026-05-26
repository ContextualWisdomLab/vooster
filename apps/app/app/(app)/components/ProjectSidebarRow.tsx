"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import type { ProjectSummary } from "../../data";

export function ProjectSidebarRow({
  project,
  onRename,
  onDelete
}: {
  project: ProjectSummary;
  onRename: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}) {
  const pathname = usePathname();
  const href = `/projects/${project.id}`;
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={project.name}>
        <Link href={href}>
          <span
            aria-hidden
            className="hidden size-4 shrink-0 items-center justify-center text-[0.7rem] font-semibold group-data-[collapsible=icon]:flex"
          >
            {project.name.charAt(0).toUpperCase()}
          </span>
          <span className={isActive ? "font-semibold" : undefined}>{project.name}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            aria-label={`Project actions for ${project.name}`}
          >
            <MoreHorizontal />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={() => onRename(project)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(project)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
