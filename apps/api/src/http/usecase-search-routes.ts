import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { membershipForProject } from "./membership-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import {
  decodeCursor,
  encodeCursor,
  useCasePreview
} from "./usecase-search-results.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { ScenarioStore } from "../ports/scenario-store.js";
import type { UseCaseStore } from "../ports/usecase-store.js";

type SearchDeps = {
  actorStore: ActorStore;
  membershipStore: MembershipStore;
  scenarioStore: ScenarioStore;
  useCaseStore: UseCaseStore;
};

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
  membershipStore: MembershipStore,
  scenarioStore: ScenarioStore,
  useCaseStore: UseCaseStore
) {
  const deps = { actorStore, membershipStore, scenarioStore, useCaseStore };
  app.get("/v1/projects/:projectId/usecases", (request, reply) =>
    searchUseCases(request, reply, state, deps)
  );
}

async function searchUseCases(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  deps: SearchDeps
) {
  const projectId = z
    .object({ projectId: z.string().min(1) })
    .parse(request.params).projectId;
  if (
    (await membershipForProject(request, state, deps.membershipStore, projectId)) ===
    undefined
  ) {
    return reply.code(403).send(problem(403, "Contact the workspace owner for access"));
  }
  const parsed = searchQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(
      problem(400, "Unknown use case filter value", {
        valid_levels: ["SUMMARY", "USER_GOAL", "SUBFUNCTION"],
        valid_statuses: ["DRAFT", "IN_REVIEW", "APPROVED", "DEPRECATED"]
      })
    );
  }
  const cursor = decodeCursor(parsed.data.cursor);
  if (cursor === false) {
    return reply
      .code(400)
      .send(
        problem(
          400,
          "cursor is opaque — pass exactly what the previous response returned"
        )
      );
  }
  const actors = await deps.actorStore.listActors(projectId);
  if (
    parsed.data.actor_id !== undefined &&
    !actors.some((actor) => actor.id === parsed.data.actor_id)
  ) {
    return reply.send({
      items: [],
      next_cursor: null,
      suggested_next_actions: [
        {
          command: "vspec actor list",
          reason: "Find a valid actor id for this project."
        }
      ]
    });
  }
  const sorted = (
    await filteredUseCases(deps.useCaseStore, projectId, parsed.data, cursor)
  ).sort((left, right) => left.key.localeCompare(right.key));
  const items = sorted.slice(0, parsed.data.limit);
  const scenarioCounts = await deps.scenarioStore.countScenariosByUseCase(projectId);
  const emptyActions =
    items.length === 0 && cursor === null
      ? {
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
        }
      : {};
  return reply.send({
    items: items.map((usecase) =>
      useCasePreview(
        usecase,
        actors,
        scenarioCounts.get(usecase.id) ?? { extension_count: 0, scenario_count: 0 }
      )
    ),
    next_cursor:
      sorted.length > items.length && items.length > 0
        ? encodeCursor(items[items.length - 1]?.key ?? "")
        : null,
    ...emptyActions
  });
}

async function filteredUseCases(
  useCaseStore: UseCaseStore,
  projectId: string,
  query: z.infer<typeof searchQuerySchema>,
  cursor: null | string
) {
  const text = query.q?.toLowerCase();
  return (await useCaseStore.listUseCases(projectId)).filter(
    (usecase) =>
      usecase.archived_at === null &&
      (query.status === undefined || usecase.status === query.status) &&
      (query.level === undefined || usecase.level === query.level) &&
      (query.actor_id === undefined || usecase.primary_actor_id === query.actor_id) &&
      (cursor === null || usecase.key > cursor) &&
      (text === undefined || usecase.title.toLowerCase().includes(text))
  );
}
