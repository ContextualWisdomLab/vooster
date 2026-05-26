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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={href}>
          <span className={isActive ? "font-semibold" : undefined}>{project.name}</span>
        </Link>
      </SidebarMenuButton>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <SidebarMenuAction
                showOnHover
                aria-label={`${project.name} 프로젝트 작업`}
              >
                <MoreHorizontal />
              </SidebarMenuAction>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">프로젝트 작업</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onSelect={() => onRename(project)}>
            <Pencil />
            이름 변경
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(project)}>
            <Trash2 />
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
