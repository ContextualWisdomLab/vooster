import type {
  ActorDefinitionDeps,
  ActorDefinitionInput
} from "../../../src/application/actors.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision
} from "../../../src/domain/entities/index.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";

export function depsFor(
  options: {
    existingActor?: StoredActor;
    membership?: StoredMembership | null;
    nameLookups?: string[];
    readOnlyMemberships?: ReadonlySet<string>;
    savedActors?: StoredActor[];
    savedRevisions?: StoredRevision[];
  } = {}
): ActorDefinitionDeps {
  let nextId = 1;
  return {
    actorStore: actorStore(options),
    idFactory: () => `id-${String(nextId++)}`,
    membershipStore: membershipStore(options.membership),
    readOnlyMemberships: options.readOnlyMemberships ?? new Set(),
    revisionStore: revisionStore(options.savedRevisions ?? [])
  };
}

export function actor(overrides: Partial<StoredActor> = {}): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "Person buying a product.",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY",
    ...overrides
  };
}

export function actorInput(
  overrides: Partial<ActorDefinitionInput> = {}
): ActorDefinitionInput {
  return {
    aliases: ["Buyer"],
    description: "Person buying a product.",
    isHuman: true,
    name: "Customer",
    projectId: "project-1",
    type: "PRIMARY",
    userId: "user-1",
    ...overrides
  };
}

function actorStore(options: {
  existingActor?: StoredActor;
  nameLookups?: string[];
  savedActors?: StoredActor[];
}): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: () => Promise.resolve(undefined),
    findActorByName: (_projectId, name) => {
      options.nameLookups?.push(name);
      return Promise.resolve(options.existingActor);
    },
    listActors: () => Promise.resolve([]),
    saveActor: (actor) => {
      options.savedActors?.push(actor);
      return Promise.resolve();
    }
  };
}

function membershipStore(value: StoredMembership | null | undefined): MembershipStore {
  return {
    membershipForProject: () =>
      Promise.resolve(value === null ? undefined : membership()),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function revisionStore(savedRevisions: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () => Promise.resolve([]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: (revision) => {
      savedRevisions.push(revision);
      return Promise.resolve();
    }
  };
}

function membership(): StoredMembership {
  return {
    id: "membership-1",
    role: "EDITOR",
    user_id: "user-1",
    workspace_id: "workspace-1"
  };
}
