"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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
            aria-label="Vooster home"
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
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupAction
              aria-label="New project"
              title="New project"
              onClick={() => setNewOpen(true)}
            >
              <Plus />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    No projects yet
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
          </SidebarGroup>
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
