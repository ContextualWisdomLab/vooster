import { describe, expect, test } from "vitest";
import { agentData } from "../../../src/application/usecase-agent-data.js";
import { showUseCaseForAgent } from "../../../src/application/usecase-agent.js";
import type {
  StoredActor,
  StoredMembership,
  StoredProject,
  StoredRevision,
  StoredScenario,
  StoredStakeholder,
  StoredStakeholderInterest,
  StoredStep,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import type { ActorStore } from "../../../src/ports/actor-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { ProjectStore } from "../../../src/ports/project-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StakeholderInterestStore } from "../../../src/ports/stakeholder-interest-store.js";
import type { StakeholderStore } from "../../../src/ports/stakeholder-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("usecase agent application", () => {
  test("returns scenario and stakeholder data for human readers", async () => {
    const result = await showUseCaseForAgent(depsFor(), input({ format: "human" }));

    expect(result.status).toBe("SIMPLE");
    if (result.status !== "SIMPLE") {
      throw new Error("expected simple result");
    }
    expect(result.data.stakeholder_interests).toEqual([
      { interest: "Checkout revenue is protected.", stakeholder: "Product Manager" }
    ]);
    expect(result.data.scenarios[0]?.steps).toEqual([
      {
        action: "Places an order.",
        actor: "Customer",
        id: "step-1",
        implements: [],
        invokes: [],
        step_number: 1
      }
    ]);
  });

  test("returns forward and derived reverse invocation links", async () => {
    const callerOne = usecase({
      id: "usecase-1",
      key: "CHK-001",
      title: "Places an order"
    });
    const callerTwo = usecase({
      id: "usecase-2",
      key: "CHK-002",
      title: "Checks out as guest"
    });
    const callee = usecase({
      id: "usecase-7",
      key: "CHK-007",
      title: "Processes a payment"
    });
    const result = await showUseCaseForAgent(
      depsFor({
        scenariosByUseCase: new Map([
          [
            callerOne.id,
            [scenario({ id: "scenario-caller-1", usecase_id: callerOne.id })]
          ],
          [
            callerTwo.id,
            [scenario({ id: "scenario-caller-2", usecase_id: callerTwo.id })]
          ],
          [callee.id, [scenario({ id: "scenario-callee", usecase_id: callee.id })]]
        ]),
        stepsByScenario: new Map([
          [
            "scenario-caller-1",
            [
              step({
                id: "step-caller-1",
                invokes: [callee.key],
                scenario_id: "scenario-caller-1"
              })
            ]
          ],
          [
            "scenario-caller-2",
            [
              step({
                id: "step-caller-2",
                invokes: [callee.key],
                scenario_id: "scenario-caller-2"
              })
            ]
          ],
          [
            "scenario-callee",
            [
              step({
                action: "Charges the card.",
                id: "step-callee",
                invokes: ["CHK-006"],
                scenario_id: "scenario-callee"
              })
            ]
          ]
        ]),
        usecase: callee,
        usecases: [callerOne, callerTwo, callee]
      }),
      input({ format: "human", usecaseId: callee.id })
    );

    expect(result.status).toBe("SIMPLE");
    if (result.status !== "SIMPLE") {
      throw new Error("expected simple result");
    }
    expect(result.data.scenarios[0]?.steps).toEqual([
      {
        action: "Charges the card.",
        actor: "Customer",
        id: "step-callee",
        implements: [],
        invokes: ["CHK-006"],
        step_number: 1
      }
    ]);
    expect(result.data.invoked_by).toEqual([
      {
        key: "CHK-001",
        scenario_id: "scenario-caller-1",
        step_number: 1,
        title: "Places an order"
      },
      {
        key: "CHK-002",
        scenario_id: "scenario-caller-2",
        step_number: 1,
        title: "Checks out as guest"
      }
    ]);
  });

  test("uses explicit fallback labels when referenced readers are missing", async () => {
    const deps = depsFor();
    deps.actorStore = {
      ...deps.actorStore,
      findActorById: () => Promise.resolve(undefined)
    };
    deps.stakeholderStore = {
      ...deps.stakeholderStore,
      findStakeholderById: () => Promise.resolve(undefined)
    };

    const data = await agentData(deps, "project-1", usecase());

    expect(data.primary_actor).toEqual({ name: "System" });
    expect(data.scenarios[0]?.steps).toEqual([
      {
        action: "Places an order.",
        actor: "System",
        id: "step-1",
        implements: [],
        invokes: [],
        step_number: 1
      }
    ]);
    expect(data.stakeholder_interests).toEqual([
      { interest: "Checkout revenue is protected.", stakeholder: "" }
    ]);
  });

  test("builds a structured agent envelope for an authorized reader", async () => {
    const result = await showUseCaseForAgent(
      depsFor(),
      input({ format: "agent", requestId: "req-agent-fetch" })
    );

    expect(result.status).toBe("AGENT_ENVELOPE");
    if (result.status !== "AGENT_ENVELOPE") {
      throw new Error("expected agent envelope");
    }
    expect(result.envelope).toMatchObject({
      context: {
        branch: "main",
        project_key: "CHK",
        request_id: "req-agent-fetch",
        revision: "revision-current",
        session_id: null
      },
      data: {
        primary_actor: { name: "Customer" },
        stakeholder_interests: [
          { interest: "Checkout revenue is protected.", stakeholder: "Product Manager" }
        ],
        title: "Places an order",
        usecase: { id: "usecase-1", key: "CHK-001" }
      },
      format_version: 1,
      warnings: []
    });
    expect(result.envelope.data.scenarios[0]?.steps).toEqual([
      {
        action: "Places an order.",
        actor: "Customer",
        id: "step-1",
        implements: [],
        invokes: [],
        step_number: 1
      }
    ]);
    expect(result.envelope.suggested_next_actions).toContainEqual({
      command: "vspec change propose CHK-001",
      reason: "Propose a reviewed spec change after reading the pinned snapshot."
    });
  });

  test("exposes editable step ids and the latest revision as the mutation base", async () => {
    const result = await showUseCaseForAgent(
      depsFor({
        latestRevision: revision("revision-latest")
      }),
      input({ format: "agent", requestId: "req-agent-fetch" })
    );

    expect(result.status).toBe("AGENT_ENVELOPE");
    if (result.status !== "AGENT_ENVELOPE") {
      throw new Error("expected agent envelope");
    }
    expect(result.envelope.context.revision).toBe("revision-latest");
    expect(result.envelope.data.usecase).toMatchObject({
      current_revision_id: "revision-latest",
      id: "usecase-1",
      key: "CHK-001"
    });
    expect(result.envelope.data.scenarios[0]?.steps[0]).toMatchObject({
      id: "step-1",
      step_number: 1
    });
  });

  test("reports revision and session pin decisions", async () => {
    const pinned = await showUseCaseForAgent(
      depsFor({
        session: session({
          pinned_revisions: { "usecase-1": "revision-pinned" }
        })
      }),
      input({ requestedRevision: "revision-current", sessionId: "session-1" })
    );

    expect(pinned.status).toBe("AGENT_ENVELOPE");
    if (pinned.status !== "AGENT_ENVELOPE") {
      throw new Error("expected pinned envelope");
    }
    expect(pinned.envelope.context.revision).toBe("revision-pinned");
    expect(pinned.envelope.warnings).toContainEqual({
      message:
        "Requested revision was ignored because the active session pins this use case.",
      type: "REVISION_OVERRIDDEN_BY_SESSION"
    });

    const unpinned = await showUseCaseForAgent(
      depsFor({ session: session({ pinned_revisions: {} }) }),
      input({ sessionId: "session-1" })
    );

    expect(unpinned.status).toBe("AGENT_ENVELOPE");
    if (unpinned.status !== "AGENT_ENVELOPE") {
      throw new Error("expected unpinned envelope");
    }
    expect(unpinned.envelope.warnings).toContainEqual({
      message:
        "Session does not pin this use case; concurrent edits may change future reads.",
      type: "UNPINNED_SESSION_READ"
    });
    expect(unpinned.envelope.suggested_next_actions).toContainEqual({
      command: "vspec session pin CHK-001",
      reason: "Pin this use case before relying on it for edits."
    });
  });

  test("returns failure statuses without assembling agent data", async () => {
    await expect(
      showUseCaseForAgent(depsFor({ found: undefined }), input())
    ).resolves.toEqual({
      status: "NOT_FOUND"
    });
    await expect(
      showUseCaseForAgent(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({ status: "AUTHENTICATION_REQUIRED" });
    const archivedResult = await showUseCaseForAgent(
      depsFor({ usecase: usecase({ archived_at: "2026-05-20T00:00:00.000Z" }) }),
      input()
    );
    expect(archivedResult.status).toBe("AGENT_ENVELOPE");
    if (archivedResult.status === "AGENT_ENVELOPE") {
      expect(archivedResult.envelope.warnings).toContainEqual(
        expect.objectContaining({ type: "ARCHIVED_READ_ONLY" })
      );
    }
    await expect(
      showUseCaseForAgent(depsFor(), input({ requestedRevision: "missing-revision" }))
    ).resolves.toEqual({
      revision: "missing-revision",
      status: "REVISION_NOT_FOUND",
      usecaseKey: "CHK-001"
    });
  });
});

function depsFor(
  options: {
    found?: { projectId: string; usecase: StoredUseCase };
    latestRevision?: StoredRevision;
    membership?: StoredMembership;
    scenariosByUseCase?: Map<string, StoredScenario[]>;
    session?: StoredWorkSession;
    stepsByScenario?: Map<string, StoredStep[]>;
    usecase?: StoredUseCase;
    usecases?: StoredUseCase[];
  } = {}
) {
  const selectedUseCase = options.usecase ?? usecase();
  const usecases = options.usecases ?? [selectedUseCase];
  return {
    actorStore: actorStore(),
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    projectStore: projectStore(),
    revisionStore: revisionStore(options.latestRevision),
    scenarioStore: scenarioStore(options.scenariosByUseCase),
    stakeholderInterestStore: stakeholderInterestStore(),
    stakeholderStore: stakeholderStore(),
    stepStore: stepStore(options.stepsByScenario),
    useCaseStore: useCaseStore(
      "found" in options
        ? options.found
        : { projectId: "project-1", usecase: selectedUseCase },
      usecases
    ),
    workSessionStore: workSessionStore(options.session)
  };
}

function input(overrides: Partial<Parameters<typeof showUseCaseForAgent>[1]> = {}) {
  return {
    format: "agent" as const,
    requestId: "req-1",
    requestedRevision: undefined,
    sessionId: undefined,
    usecaseId: "usecase-1",
    userId: "user-1",
    ...overrides
  };
}

function actorStore(): ActorStore {
  return {
    archiveActor: () => Promise.resolve(false),
    findActorById: (_projectId, actorId) =>
      Promise.resolve(actorId === "actor-1" ? actor() : undefined),
    findActorByName: () => Promise.resolve(undefined),
    listActors: () => Promise.resolve([]),
    saveActor: () => Promise.resolve()
  };
}

function membershipStore(value: StoredMembership | undefined): MembershipStore {
  return {
    membershipForProject: (_projectId, userId) =>
      Promise.resolve(userId === value?.user_id ? value : undefined),
    membershipForWorkspace: () => Promise.resolve(undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function projectStore(): ProjectStore {
  return {
    findProjectById: (projectId) =>
      Promise.resolve(projectId === "project-1" ? project() : undefined),
    findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
    listProjectsForWorkspace: () => Promise.resolve([]),
    deleteProject: () => Promise.resolve("NOT_FOUND" as const),
    updateProjectName: () => Promise.resolve(undefined),
    saveProject: () => Promise.resolve()
  };
}

function revisionStore(latestRevision?: StoredRevision): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(latestRevision),
    listRevisions: () =>
      Promise.resolve([revision("revision-current"), revision("revision-pinned")]),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function scenarioStore(
  scenariosByUseCase?: Map<string, StoredScenario[]>
): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: (usecaseId) =>
      Promise.resolve((scenariosByUseCase?.get(usecaseId) ?? [scenario()])[0]),
    findScenarioById: () => Promise.resolve(undefined),
    listScenarios: (usecaseId) =>
      Promise.resolve(scenariosByUseCase?.get(usecaseId) ?? [scenario()]),
    saveScenario: () => Promise.resolve()
  };
}

function stakeholderInterestStore(): StakeholderInterestStore {
  return {
    deleteStakeholderInterest: () => Promise.resolve(),
    findStakeholderInterestById: () => Promise.resolve(undefined),
    findStakeholderInterestForStakeholder: () => Promise.resolve(undefined),
    listStakeholderInterests: () => Promise.resolve([stakeholderInterest()]),
    saveStakeholderInterest: () => Promise.resolve()
  };
}

function stakeholderStore(): StakeholderStore {
  return {
    findStakeholderById: (_projectId, stakeholderId) =>
      Promise.resolve(stakeholderId === "stakeholder-1" ? stakeholder() : undefined),
    findStakeholderByName: () => Promise.resolve(undefined),
    listStakeholders: () => Promise.resolve([]),
    saveStakeholder: () => Promise.resolve()
  };
}

function stepStore(stepsByScenario?: Map<string, StoredStep[]>): StepStore {
  return {
    findStepById: () => Promise.resolve(undefined),
    listSteps: (scenarioId) =>
      Promise.resolve(stepsByScenario?.get(scenarioId) ?? [step()]),
    saveStep: () => Promise.resolve(),
    updateStep: () => Promise.resolve()
  };
}

function useCaseStore(
  found: { projectId: string; usecase: StoredUseCase } | undefined,
  usecases: StoredUseCase[]
): UseCaseStore {
  return {
    findUseCaseById: () => Promise.resolve(undefined),
    findUseCaseWithProject: (usecaseIdOrKey) =>
      Promise.resolve(
        found === undefined
          ? undefined
          : {
              projectId: found.projectId,
              usecase:
                usecases.find(
                  (candidate) =>
                    candidate.id === usecaseIdOrKey || candidate.key === usecaseIdOrKey
                ) ?? found.usecase
            }
      ),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(usecases),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(value: StoredWorkSession | undefined): WorkSessionStore {
  return {
    findWorkSessionById: (sessionId) =>
      Promise.resolve(sessionId === value?.id ? value : undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: () => Promise.resolve([]),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
  };
}

function actor(): StoredActor {
  return {
    aliases: [],
    archived_at: null,
    description: "",
    id: "actor-1",
    is_human: true,
    name: "Customer",
    project_id: "project-1",
    type: "PRIMARY"
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

function project(): StoredProject {
  return {
    default_branch_id: "branch-main",
    id: "project-1",
    key: "CHK",
    name: "Checkout",
    visibility: "PRIVATE",
    workspace_id: "workspace-1"
  };
}

function revision(id: string): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    snapshot: usecase(),
    version_number: 1
  };
}

function scenario(overrides: Partial<StoredScenario> = {}): StoredScenario {
  return {
    condition: null,
    extension_point: null,
    id: "scenario-1",
    order_index: 0,
    outcome: "SUCCESS",
    parent_step_number: null,
    type: "MAIN_SUCCESS",
    usecase_id: "usecase-1",
    ...overrides
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    id: "session-1",
    pinned_revisions: { "usecase-1": "revision-pinned" },
    status: "ACTIVE",
    ...overrides
  };
}

function stakeholder(): StoredStakeholder {
  return {
    archived_at: null,
    description: "",
    id: "stakeholder-1",
    name: "Product Manager",
    project_id: "project-1",
    type: "INTERNAL"
  };
}

function stakeholderInterest(): StoredStakeholderInterest {
  return {
    id: "interest-1",
    interest: "Checkout revenue is protected.",
    protection_mechanism: "Success guarantee",
    stakeholder_id: "stakeholder-1",
    usecase_id: "usecase-1"
  };
}

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Places an order.",
    actor_id: "actor-1",
    id: "step-1",
    invokes: [],
    is_system_step: false,
    notes: null,
    order_index: 0,
    scenario_id: "scenario-1",
    step_number: 1,
    ...overrides,
    implements: overrides.implements ?? []
  };
}

function usecase(overrides: Partial<StoredUseCase> = {}): StoredUseCase {
  return {
    archived_at: null,
    current_revision_id: "revision-current",
    format: "BRIEF",
    id: "usecase-1",
    key: "CHK-001",
    level: "USER_GOAL",
    primary_actor_id: "actor-1",
    priority: "P0",
    project_id: "project-1",
    scope: "vspec",
    status: "DRAFT",
    title: "Places an order",
    ...overrides
  };
}
