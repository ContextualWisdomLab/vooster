"use client";

import { ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu
} from "@/components/ui/sidebar";
import type { ProjectSummary } from "../../data";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectSidebarRow } from "./ProjectSidebarRow";
import { RenameProjectDialog } from "./RenameProjectDialog";

export function AppSidebar({ projects }: { projects: ProjectSummary[] }) {
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
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
            <span className="group-data-[collapsible=icon]:hidden">Vooster</span>
          </Link>
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
              <SidebarGroupAction
                aria-label="새 프로젝트"
                title="새 프로젝트"
                onClick={() => setNewOpen(true)}
              >
                <Plus />
              </SidebarGroupAction>
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
