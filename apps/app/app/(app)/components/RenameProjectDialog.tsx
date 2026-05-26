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
      setError("이름을 입력하세요.");
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
            <DialogTitle>프로젝트 이름 변경</DialogTitle>
            <DialogDescription>
              프로젝트 키는 그대로 유지되고 표시 이름만 변경됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="rename-project-name">이름</Label>
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
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
