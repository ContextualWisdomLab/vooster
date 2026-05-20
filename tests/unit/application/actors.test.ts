import { describe, expect, test } from "vitest";
import { defineActor } from "../../../src/application/actors.js";
import type {
  StoredActor,
  StoredMembership,
  StoredRevision
} from "../../../src/http/signup-types.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";

describe("actor definition application", () => {
  test("creates an actor with an initial revision", async () => {
    const savedActors: StoredActor[] = [];
    const savedRevisions: StoredRevision[] = [];

    const result = await defineActor(
      depsFor({ savedActors, savedRevisions }),
      actorInput()
    );

    expect(result).toEqual({
      actor: {
        aliases: ["Buyer"],
        archived_at: null,
        description: "Person buying a product.",
        id: "id-1",
        is_human: true,
        name: "Customer",
        project_id: "project-1",
        type: "PRIMARY"
      },
      recommendedNextCommand: "vspec stakeholder create",
      revision: {
        entity_id: "id-1",
        entity_type: "ACTOR",
        id: "id-2",
        snapshot: {
          aliases: ["Buyer"],
          archived_at: null,
          description: "Person buying a product.",
          id: "id-1",
          is_human: true,
          name: "Customer",
          project_id: "project-1",
          type: "PRIMARY"
        },
        version_number: 1
      },
      status: "CREATED"
    });
    expect(savedActors).toHaveLength(1);
    expect(savedRevisions).toHaveLength(1);
  });

  test("rejects callers without project membership before checking name conflicts", async () => {
    const nameLookups: string[] = [];

    const result = await defineActor(
      depsFor({ membership: null, nameLookups }),
      actorInput({ userId: "outsider" })
    );

    expect(result).toEqual({ status: "FORBIDDEN" });
    expect(nameLookups).toEqual([]);
  });

  test("rejects read-only members without writes", async () => {
    const savedActors: StoredActor[] = [];

    const result = await defineActor(
      depsFor({
        readOnlyMemberships: new Set(["user-1:workspace-1"]),
        savedActors
      }),
      actorInput()
    );

    expect(result).toEqual({ status: "READ_ONLY" });
    expect(savedActors).toEqual([]);
  });

  test("rejects the reserved System actor name", async () => {
    await expect(defineActor(depsFor(), actorInput({ name: "System" }))).resolves.toEqual({
      status: "SYSTEM_RESERVED"
    });
  });

  test("rejects active duplicate actor names", async () => {
    const existingActor = actor({ id: "actor-existing" });

    await expect(
      defineActor(depsFor({ existingActor }), actorInput())
    ).resolves.toEqual({
      existingActor,
      requestedName: "Customer",
      status: "ACTIVE_NAME_CONFLICT"
    });
  });

  test("rejects archived duplicate actor names", async () => {
    const existingActor = actor({
      archived_at: "2026-05-20T00:00:00.000Z",
      id: "actor-archived"
    });

    await expect(
      defineActor(depsFor({ existingActor }), actorInput())
    ).resolves.toEqual({
      existingActor,
      status: "ARCHIVED_NAME_CONFLICT"
    });
  });
});

function depsFor(
  options: {
    existingActor?: StoredActor;
    membership?: StoredMembership | null;
    nameLookups?: string[];
    readOnlyMemberships?: ReadonlySet<string>;
    savedActors?: StoredActor[];
    savedRevisions?: StoredRevision[];
  } = {}
) {
  let nextId = 1;
  return {
    actorStore: actorStore(options),
    idFactory: () => `id-${String(nextId++)}`,
    membershipStore: membershipStore(options.membership),
    readOnlyMemberships: options.readOnlyMemberships ?? new Set(),
    revisionStore: revisionStore(options.savedRevisions ?? [])
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
    membershipForProject: () => Promise.resolve(value === null ? undefined : membership()),
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

function actor(overrides: Partial<StoredActor> = {}): StoredActor {
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

function actorInput(overrides: Partial<Parameters<typeof defineActor>[1]> = {}) {
  return {
    aliases: ["Buyer"],
    description: "Person buying a product.",
    isHuman: true,
    name: "Customer",
    projectId: "project-1",
    type: "PRIMARY" as const,
    userId: "user-1",
    ...overrides
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
