import { z } from "zod";
import type { StoredActor, StoredUseCase } from "../domain/entities/index.js";

export function useCasePreview(usecase: StoredUseCase, actors: StoredActor[]) {
  return {
    key: usecase.key,
    level: usecase.level,
    primary_actor:
      actors.find((actor) => actor.id === usecase.primary_actor_id)?.name ?? "",
    status: usecase.status,
    title: usecase.title,
    trigger_excerpt: ""
  };
}

export function encodeCursor(key: string) {
  return Buffer.from(JSON.stringify({ key }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): false | null | string {
  if (cursor === undefined) {
    return null;
  }
  try {
    return z
      .object({ key: z.string() })
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))).key;
  } catch {
    return false;
  }
}
