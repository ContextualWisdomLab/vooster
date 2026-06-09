import { z } from "zod";
import type { StoredActor, StoredUseCase } from "../domain/entities/index.js";
import type { UseCaseScenarioCounts } from "../ports/scenario-store.js";

export function useCasePreview(
  usecase: StoredUseCase,
  actors: StoredActor[],
  counts: UseCaseScenarioCounts
) {
  return {
    ...(usecase.archived_at === null ? {} : { archived_at: usecase.archived_at }),
    extension_count: counts.extension_count,
    key: usecase.key,
    level: usecase.level,
    primary_actor:
      actors.find((actor) => actor.id === usecase.primary_actor_id)?.name ?? "",
    scenario_count: counts.scenario_count,
    status: usecase.status,
    title: usecase.title,
    trigger_excerpt: ""
  };
}

export function matchesArchiveScope(
  archivedAt: null | string,
  scope: "active" | "all" | "only"
) {
  if (scope === "all") {
    return true;
  }
  return scope === "only" ? archivedAt !== null : archivedAt === null;
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
