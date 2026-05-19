import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredActor, StoredUseCase } from "./signup-types.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

const searchQuerySchema = z.object({
  actor_id: z.string().optional(),
  cursor: z.string().optional(),
  level: z.enum(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  q: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]).optional()
});

export function registerUseCaseSearchRoutes(
  app: FastifyInstance,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore
) {
  app.get("/v1/projects/:projectId/usecases", (request, reply) =>
    searchUseCases(request, reply, state, actorStore, membershipStore)
  );
}

async function searchUseCases(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  actorStore: ActorStore,
  membershipStore: MembershipStore
) {
  const projectId = z.object({ projectId: z.string().min(1) }).parse(request.params).projectId;
  if (await membershipForProject(request, state, membershipStore, projectId) === undefined) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = searchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Unknown use case filter value", {
      valid_levels: ["SUMMARY", "USER_GOAL", "SUBFUNCTION"],
      valid_statuses: ["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]
    }));
  }
  const cursor = decodeCursor(parsed.data.cursor);
  if (cursor === false) {
    return reply.code(400).send(problem(400, "cursor is opaque — pass exactly what the previous response returned"));
  }
  const actors = await actorStore.listActors(projectId);
  if (
    parsed.data.actor_id !== undefined &&
    !actors.some((actor) => actor.id === parsed.data.actor_id)
  ) {
    return reply.send({
      items: [],
      next_cursor: null,
      suggested_next_actions: [
        { command: "vspec actor list", reason: "Find a valid actor id for this project." }
      ]
    });
  }
  const sorted = filteredUseCases(state, projectId, parsed.data, cursor)
    .sort((left, right) => left.key.localeCompare(right.key));
  const items = sorted.slice(0, parsed.data.limit);
  const emptyActions = items.length === 0 && cursor === null ? {
    suggested_next_actions: [
      {
        command: "vspec usecase list --status=DRAFT,IN_REVIEW",
        reason: "Broaden lifecycle filters and retry."
      },
      {
        command: "vspec usecase list",
        reason: "Drop the search text to browse all visible use cases."
      }
    ]
  } : {};
  return reply.send({
    items: items.map((usecase) => preview(usecase, actors)),
    next_cursor: sorted.length > items.length && items.length > 0
      ? encodeCursor(items[items.length - 1]?.key ?? "")
      : null,
    ...emptyActions
  });
}

function filteredUseCases(
  state: SignupState,
  projectId: string,
  query: z.infer<typeof searchQuerySchema>,
  cursor: null | string
) {
  const text = query.q?.toLowerCase();
  return (state.usecasesByProjectId.get(projectId) ?? []).filter((usecase) =>
    usecase.archived_at === null &&
    (query.status === undefined || usecase.status === query.status) &&
    (query.level === undefined || usecase.level === query.level) &&
    (query.actor_id === undefined || usecase.primary_actor_id === query.actor_id) &&
    (cursor === null || usecase.key > cursor) &&
    (text === undefined || usecase.title.toLowerCase().includes(text))
  );
}

function preview(usecase: StoredUseCase, actors: StoredActor[]) {
  return {
    key: usecase.key,
    level: usecase.level,
    primary_actor: actors.find((actor) => actor.id === usecase.primary_actor_id)?.name ?? "",
    status: usecase.status,
    title: usecase.title,
    trigger_excerpt: ""
  };
}

function encodeCursor(key: string) {
  return Buffer.from(JSON.stringify({ key }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): false | null | string {
  if (cursor === undefined) {
    return null;
  }
  try {
    return z.object({ key: z.string() })
      .parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))).key;
  } catch {
    return false;
  }
}
