"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { createProjectAction } from "../../actions";
import { inferProjectKey, isValidProjectKey } from "@/lib/project-key";

export function NewProjectDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyEdited) {
      setKey(inferProjectKey(value));
    }
  }

  function handleKeyChange(value: string) {
    setKeyEdited(true);
    setKey(value.toUpperCase());
  }

  function reset() {
    setName("");
    setKey("");
    setKeyEdited(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset();
    }
    onOpenChange(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("이름을 입력하세요.");
      return;
    }
    if (!isValidProjectKey(key)) {
      setError("키는 ^[A-Z][A-Z0-9]{1,7}$ 형식이어야 합니다 (예: PAY, OPS2026).");
      return;
    }

    startTransition(async () => {
      const result = await createProjectAction({ name: trimmedName, key });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
      router.push(`/projects/${result.value.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>프로젝트 만들기</DialogTitle>
            <DialogDescription>
              유스케이스를 프로젝트로 묶습니다. 키는 PAY-001 같은 ID에 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-project-name">이름</Label>
            <Input
              id="new-project-name"
              autoFocus
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="체크아웃 리뷰"
              maxLength={120}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-project-key">키</Label>
            <Input
              id="new-project-key"
              value={key}
              onChange={(event) => handleKeyChange(event.target.value)}
              placeholder="PAY"
              maxLength={8}
              aria-describedby="new-project-key-hint"
            />
            <p id="new-project-key-hint" className="text-xs text-muted-foreground">
              2~8자, 영문자로 시작, A-Z와 0-9만 사용.
            </p>
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
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending ? "만드는 중..." : "프로젝트 만들기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
