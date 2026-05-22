"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteProjectAction } from "../../actions";
import type { ProjectSummary } from "../../data";

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange
}: {
  project: ProjectSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (project === null) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectAction(project.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      if (pathname.startsWith(`/projects/${project.id}`)) {
        router.push("/");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete project?</DialogTitle>
          <DialogDescription>
            {project === null
              ? null
              : `"${project.name}" will be removed. Use cases must already be empty.`}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
