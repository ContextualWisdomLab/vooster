"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameProjectAction } from "../../actions";
import type { ProjectSummary } from "../../data";

export function RenameProjectDialog({
  project,
  open,
  onOpenChange
}: {
  project: ProjectSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(project?.name ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && project !== null) {
      setName(project.name);
      setError(null);
    }
  }, [open, project]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (project === null) {
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Name is required.");
      return;
    }
    if (trimmed === project.name) {
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      const result = await renameProjectAction(project.id, trimmed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              The project key stays the same; only the display name changes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-project-name">Name</Label>
            <Input
              id="rename-project-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
            />
          </div>
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
