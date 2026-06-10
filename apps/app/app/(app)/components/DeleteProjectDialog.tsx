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
import { Loader2 } from "lucide-react";
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
          <DialogTitle>프로젝트를 삭제할까요?</DialogTitle>
          <DialogDescription>
            {project === null
              ? null
              : `"${project.name}" 프로젝트가 삭제됩니다. 유스케이스가 모두 비어 있어야 합니다.`}
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
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending && <Loader2 className="animate-spin -ml-1 mr-2" />}
            {pending ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
