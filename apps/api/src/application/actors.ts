import { randomUUID } from "node:crypto";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision
} from "../domain/entities/index.js";
import type { ActorStore } from "../ports/actor-store.js";
import type { MembershipStore } from "../ports/membership-store.js";
import type { RevisionStore } from "../ports/revision-store.js";

export type ActorDefinitionDeps = {
  actorStore: ActorStore;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  readOnlyMemberships: ReadonlySet<string>;
  revisionStore: RevisionStore;
};

export type ActorDefinitionInput = {
  aliases: string[];
  description: string;
  dryRun?: boolean;
  isHuman: boolean;
  name: string;
  projectId: string;
  type: StoredActor["type"];
  userId: string | undefined;
};

export type ActorDefinitionResult =
  | {
      actor: StoredActor;
      recommendedNextCommand: string;
      revision: StoredRevision;
      status: "CREATED";
    }
  | { status: "FORBIDDEN" }
  | { status: "READ_ONLY" }
  | { status: "SYSTEM_RESERVED" }
  | { existingActor: StoredActor; status: "ARCHIVED_NAME_CONFLICT" }
  | {
      existingActor: StoredActor;
      requestedName: string;
      status: "ACTIVE_NAME_CONFLICT";
    };

export async function defineActor(
  deps: ActorDefinitionDeps,
  input: ActorDefinitionInput
): Promise<ActorDefinitionResult> {
  const membership = await projectMembership(deps.membershipStore, input);
  if (membership === undefined) {
    return { status: "FORBIDDEN" };
  }
  if (
    deps.readOnlyMemberships.has(`${membership.user_id}:${membership.workspace_id}`)
  ) {
    return { status: "READ_ONLY" };
  }
  if (input.name === "System") {
    return { status: "SYSTEM_RESERVED" };
  }

  const existingActor = await deps.actorStore.findActorByName(
    input.projectId,
    input.name
  );
  if (existingActor?.archived_at !== null && existingActor !== undefined) {
    return { existingActor, status: "ARCHIVED_NAME_CONFLICT" };
  }
  if (existingActor !== undefined) {
    return {
      existingActor,
      requestedName: input.name,
      status: "ACTIVE_NAME_CONFLICT"
    };
  }

  const actor = actorFrom(deps, input);
  const revision = actorRevision(deps, actor);
  if (input.dryRun !== true) {
    await deps.actorStore.saveActor(actor);
    await deps.revisionStore.saveRevision(revision);
  }

  return {
    actor,
    recommendedNextCommand: "vspec stakeholder create",
    revision,
    status: "CREATED"
  };
}

async function projectMembership(
  membershipStore: MembershipStore,
  input: ActorDefinitionInput
): Promise<StoredMembership | undefined> {
  return input.userId === undefined
    ? undefined
    : membershipStore.membershipForProject(input.projectId, input.userId);
}

function actorFrom(
  deps: ActorDefinitionDeps,
  input: ActorDefinitionInput
): StoredActor {
  return {
    aliases: input.aliases,
    archived_at: null,
    description: input.description,
    id: idFrom(deps),
    is_human: input.isHuman,
    name: input.name,
    project_id: input.projectId,
    type: input.type
  };
}

function actorRevision(deps: ActorDefinitionDeps, actor: StoredActor): StoredRevision {
  return {
    entity_id: actor.id,
    entity_type: "ACTOR",
    id: idFrom(deps),
    snapshot: actor,
    version_number: 1
  };
}

function idFrom(deps: ActorDefinitionDeps): string {
  return (deps.idFactory ?? randomUUID)();
}
