"use client";

import { ChevronRight, ChevronsLeft, CircleUserRound, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { IconButton } from "@/components/ui/icon-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProjectSummary } from "../../data";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectSidebarRow } from "./ProjectSidebarRow";
import { RenameProjectDialog } from "./RenameProjectDialog";

export function AppSidebar({ projects }: { projects: ProjectSummary[] }) {
  const { toggleSidebar } = useSidebar();
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="flex-row items-center justify-between">
          <Link
            href="/"
            aria-label="Vooster 홈"
            className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-foreground hover:no-underline"
          >
            <Image
              src="/logo.png"
              alt=""
              width={24}
              height={24}
              className="size-6 max-w-none shrink-0 rounded-sm"
              priority
            />
            <span>Vooster</span>
          </Link>
          <IconButton
            label="사이드바 접기"
            onClick={toggleSidebar}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronsLeft />
          </IconButton>
        </SidebarHeader>
        <SidebarContent>
          <Collapsible defaultOpen className="group/projects">
            <SidebarGroup>
              <SidebarGroupLabel
                asChild
                className="cursor-pointer gap-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <CollapsibleTrigger>
                  <ChevronRight className="transition-transform group-data-[state=open]/projects:rotate-90" />
                  프로젝트
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarGroupAction
                    aria-label="새 프로젝트"
                    onClick={() => setNewOpen(true)}
                  >
                    <Plus />
                  </SidebarGroupAction>
                </TooltipTrigger>
                <TooltipContent side="bottom">새 프로젝트</TooltipContent>
              </Tooltip>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <SidebarGroupContent>
                  <SidebarMenu className="pl-5 group-data-[collapsible=icon]:pl-0">
                    {projects.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                        아직 프로젝트가 없습니다
                      </div>
                    ) : (
                      projects.map((project) => (
                        <ProjectSidebarRow
                          key={project.id}
                          project={project}
                          onRename={setRenameTarget}
                          onDelete={setDeleteTarget}
                        />
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/login">
                  <CircleUserRound />
                  <span>내 계정</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <NewProjectDialog open={newOpen} onOpenChange={setNewOpen} />
      <RenameProjectDialog
        project={renameTarget}
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
          }
        }}
      />
      <DeleteProjectDialog
        project={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}
