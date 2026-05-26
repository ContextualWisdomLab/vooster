"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
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
      setError("Name is required.");
      return;
    }
    if (!isValidProjectKey(key)) {
      setError("Key must match ^[A-Z][A-Z0-9]{1,7}$ (e.g. PAY, OPS2026).");
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
            <DialogTitle>Create a project</DialogTitle>
            <DialogDescription>
              Group use cases under a project. The key shows in IDs like PAY-001.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              autoFocus
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Checkout Review"
              maxLength={120}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-project-key">Key</Label>
            <Input
              id="new-project-key"
              value={key}
              onChange={(event) => handleKeyChange(event.target.value)}
              placeholder="PAY"
              maxLength={8}
              aria-describedby="new-project-key-hint"
            />
            <p id="new-project-key-hint" className="text-xs text-muted-foreground">
              2-8 chars, starts with a letter, A-Z and 0-9 only.
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
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
