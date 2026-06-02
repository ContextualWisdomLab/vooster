import { describe, expect, test } from "vitest";
import { previewImpact } from "../../../src/application/impact-analysis.js";
import type {
  StoredMembership,
  StoredRevision,
  StoredScenario,
  StoredStep,
  StoredUseCase,
  StoredWorkSession
} from "../../../src/domain/entities/index.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";
import type { RevisionStore } from "../../../src/ports/revision-store.js";
import type { ScenarioStore } from "../../../src/ports/scenario-store.js";
import type { StepStore } from "../../../src/ports/step-store.js";
import type { UseCaseStore } from "../../../src/ports/usecase-store.js";
import type { WorkSessionStore } from "../../../src/ports/work-session-store.js";

describe("impact analysis application", () => {
  test("previews impact, caches by input hash, and returns next actions", async () => {
    const cache = new Map();
    const first = await previewImpact(
      depsFor({ cache }),
      input({ baseRevision: "revision-breaking" })
    );
    const second = await previewImpact(
      depsFor({ cache }),
      input({ baseRevision: "revision-breaking" })
    );

    expect(first.status).toBe("PREVIEWED");
    expect(second.status).toBe("PREVIEWED");
    if (first.status !== "PREVIEWED" || second.status !== "PREVIEWED") {
      throw new Error("expected preview results");
    }
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.impact).toEqual(first.impact);
    expect(first.previewId).toBe("preview-1");
    expect(second.previewId).toBe("preview-1");
    expect(first.impact).toMatchObject({
      affected_branches: [],
      affected_sessions: [],
      affected_tests: [],
      confidence: 1,
      input_hash: "hash-revision-breaking",
      severity: "BREAKING"
    });
    expect(first.nextActions).toContainEqual({
      command: "vspec lock CHK-001",
      reason: "Lock the use case before applying a risky change."
    });
  });

  test("rolls active pinned sessions up to breaking severity", async () => {
    const result = await previewImpact(
      depsFor({
        sessions: [
          session({ pinned_revisions: { "usecase-1": "revision-current" } }),
          session({ id: "session-done", status: "COMPLETED" })
        ]
      }),
      input({ baseRevision: "revision-non-breaking" })
    );

    expect(result.status).toBe("PREVIEWED");
    if (result.status !== "PREVIEWED") {
      throw new Error("expected preview result");
    }
    expect(result.impact.severity).toBe("BREAKING");
    expect(result.impact.affected_sessions).toEqual([
      {
        agent_type: "CODEX",
        id: "session-1",
        owner: "user-1",
        pinned_revision: "revision-current"
      }
    ]);
  });

  test.each([
    {
      expectedSeverity: "NON_BREAKING",
      fromInvokes: [],
      name: "added invocation",
      toInvokes: ["PAY-001"]
    },
    {
      expectedSeverity: "BREAKING",
      fromInvokes: ["PAY-001"],
      name: "removed invocation",
      toInvokes: []
    },
    {
      expectedSeverity: "BREAKING",
      fromInvokes: ["PAY-001"],
      name: "retargeted invocation",
      toInvokes: ["PAY-002"]
    }
  ] as const)(
    "classifies $name severity from the caller revision diff",
    async ({ expectedSeverity, fromInvokes, toInvokes }) => {
      const result = await previewImpact(
        depsFor({
          revisions: [
            revision("revision-parent", "COSMETIC", {
              snapshot: usecaseSnapshot({ invokes: fromInvokes }),
              version_number: 1
            }),
            revision("revision-current", "COSMETIC", {
              parent_revision_id: "revision-parent",
              snapshot: usecaseSnapshot({ invokes: toInvokes }),
              version_number: 2
            })
          ]
        }),
        input({ baseRevision: "revision-current" })
      );

      expect(result.status).toBe("PREVIEWED");
      if (result.status !== "PREVIEWED") {
        throw new Error("expected preview result");
      }
      expect(result.impact.severity).toBe(expectedSeverity);
    }
  );

  test("adds caller sessions through reverse invocation edges for contract-surface changes", async () => {
    const callee = usecase({ key: "PAY-001" });
    const caller = usecase({
      current_revision_id: "revision-caller",
      id: "usecase-caller",
      key: "CHK-001"
    });
    const summary = usecase({
      current_revision_id: "revision-summary",
      id: "usecase-summary",
      key: "SUM-001"
    });
    const result = await previewImpact(
      depsFor({
        found: { projectId: "project-1", usecase: callee },
        revisions: [
          revision("revision-parent", "NON_BREAKING", {
            snapshot: usecase({ primary_actor_id: "actor-1" }),
            version_number: 1
          }),
          revision("revision-current", "NON_BREAKING", {
            parent_revision_id: "revision-parent",
            snapshot: usecase({ primary_actor_id: "actor-2" }),
            version_number: 2
          })
        ],
        scenarios: [
          scenario({ id: "scenario-callee", usecase_id: callee.id }),
          scenario({ id: "scenario-caller", usecase_id: caller.id }),
          scenario({ id: "scenario-summary", usecase_id: summary.id })
        ],
        sessions: [
          session({
            id: "session-caller",
            pinned_revisions: { [caller.id]: caller.current_revision_id },
            usecase_id: caller.id
          }),
          session({
            id: "session-summary",
            pinned_revisions: { [summary.id]: summary.current_revision_id },
            usecase_id: summary.id
          })
        ],
        steps: [
          step({
            invokes: [summary.key],
            scenario_id: "scenario-callee"
          }),
          step({
            invokes: [callee.key],
            scenario_id: "scenario-caller"
          }),
          step({
            invokes: [caller.key],
            scenario_id: "scenario-summary"
          })
        ],
        usecases: [callee, caller, summary]
      }),
      input({ baseRevision: "revision-current", entityId: callee.id })
    );

    expect(result.status).toBe("PREVIEWED");
    if (result.status !== "PREVIEWED") {
      throw new Error("expected preview result");
    }
    expect(result.impact.affected_sessions).toEqual([
      {
        agent_type: "CODEX",
        id: "session-caller",
        owner: "user-1",
        pinned_revision: caller.current_revision_id,
        reason: "의존 UC의 계약 변경"
      },
      {
        agent_type: "CODEX",
        id: "session-summary",
        owner: "user-1",
        pinned_revision: summary.current_revision_id,
        reason: "의존 UC의 계약 변경"
      }
    ]);
    expect(result.impact.severity).toBe("NON_BREAKING");
  });

  test("does not add caller sessions for internal callee changes", async () => {
    const callee = usecase({ key: "PAY-001" });
    const caller = usecase({
      current_revision_id: "revision-caller",
      id: "usecase-caller",
      key: "CHK-001"
    });
    const result = await previewImpact(
      depsFor({
        found: { projectId: "project-1", usecase: callee },
        revisions: [
          revision("revision-parent", "BREAKING", {
            snapshot: usecaseSnapshot({ action: "Authorizes the payment" }),
            version_number: 1
          }),
          revision("revision-current", "BREAKING", {
            parent_revision_id: "revision-parent",
            snapshot: usecaseSnapshot({ action: "Authorizes the card payment" }),
            version_number: 2
          })
        ],
        scenarios: [scenario({ id: "scenario-caller", usecase_id: caller.id })],
        sessions: [
          session({
            id: "session-caller",
            pinned_revisions: { [caller.id]: caller.current_revision_id },
            usecase_id: caller.id
          })
        ],
        steps: [step({ invokes: [callee.key], scenario_id: "scenario-caller" })],
        usecases: [callee, caller]
      }),
      input({ baseRevision: "revision-current", entityId: callee.id })
    );

    expect(result.status).toBe("PREVIEWED");
    if (result.status !== "PREVIEWED") {
      throw new Error("expected preview result");
    }
    expect(result.impact.affected_sessions).toEqual([]);
    expect(result.impact.severity).toBe("BREAKING");
  });

  test("returns failure statuses before computing impact", async () => {
    await expect(
      previewImpact(depsFor({ found: undefined }), input())
    ).resolves.toEqual({
      status: "NOT_FOUND"
    });
    await expect(
      previewImpact(depsFor({ membership: undefined }), input())
    ).resolves.toEqual({ status: "ACCESS_DENIED" });
    await expect(
      previewImpact(
        depsFor(),
        input({ proposedChangeContent: "# Missing frontmatter" })
      )
    ).resolves.toEqual({
      path: "<inline>",
      status: "PROPOSED_CHANGE_PARSE_FAILED"
    });
    await expect(
      previewImpact(depsFor(), input({ proposedChangePath: "missing/usecase.md" }))
    ).resolves.toEqual({
      path: "missing/usecase.md",
      status: "PROPOSED_CHANGE_NOT_READABLE",
      usecase: usecase()
    });
    await expect(
      previewImpact(depsFor(), input({ baseRevision: "missing-revision" }))
    ).resolves.toEqual({ status: "REVISION_NOT_FOUND" });
  });
});

function depsFor(
  options: {
    cache?: Map<string, unknown>;
    found?: { projectId: string; usecase: StoredUseCase };
    membership?: StoredMembership;
    revisions?: StoredRevision[];
    scenarios?: StoredScenario[];
    sessions?: StoredWorkSession[];
    steps?: StoredStep[];
    usecases?: StoredUseCase[];
  } = {}
) {
  return {
    cache: options.cache ?? new Map(),
    hashFactory: (revision: StoredRevision) => `hash-${revision.id}`,
    idFactory: () => "preview-1",
    membershipStore: membershipStore(
      "membership" in options ? options.membership : membership()
    ),
    revisionStore: revisionStore(options.revisions),
    scenarioStore: scenarioStore(options.scenarios ?? []),
    stepStore: stepStore(options.steps ?? []),
    useCaseStore: useCaseStore(
      "found" in options
        ? options.found
        : { projectId: "project-1", usecase: options.usecases?.[0] ?? usecase() },
      options.usecases ?? []
    ),
    workSessionStore: workSessionStore(options.sessions ?? [])
  };
}

function input(overrides: Partial<Parameters<typeof previewImpact>[1]> = {}) {
  return {
    baseRevision: "revision-current",
    entityId: "usecase-1",
    proposedChangeContent: undefined,
    proposedChangePath: undefined,
    userId: "user-1",
    ...overrides
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

function revisionStore(revisions?: StoredRevision[]): RevisionStore {
  return {
    findRevisionById: () => Promise.resolve(undefined),
    latestRevision: () => Promise.resolve(undefined),
    listRevisions: () =>
      Promise.resolve(
        revisions ?? [
          revision("revision-current", "NON_BREAKING"),
          revision("revision-non-breaking", "NON_BREAKING"),
          revision("revision-breaking", "BREAKING")
        ]
      ),
    nextVersionNumber: () => Promise.resolve(1),
    saveRevision: () => Promise.resolve()
  };
}

function scenarioStore(scenarios: StoredScenario[]): ScenarioStore {
  return {
    countScenariosByUseCase: () => Promise.resolve(new Map()),
    findMainScenario: () => Promise.resolve(undefined),
    findScenarioById: () => Promise.resolve(undefined),
    listScenarios: (usecaseId) =>
      Promise.resolve(
        scenarios.filter((candidate) => candidate.usecase_id === usecaseId)
      ),
    saveScenario: () => Promise.resolve()
  };
}

function stepStore(steps: StoredStep[]): StepStore {
  return {
    findStepById: () => Promise.resolve(undefined),
    listSteps: (scenarioId) =>
      Promise.resolve(steps.filter((step) => step.scenario_id === scenarioId)),
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
    findUseCaseWithProject: () => Promise.resolve(found),
    findUseCasesByKey: () => Promise.resolve([]),
    listUseCases: () => Promise.resolve(usecases),
    saveUseCase: () => Promise.resolve(),
    updateUseCase: () => Promise.resolve()
  };
}

function workSessionStore(sessions: StoredWorkSession[]): WorkSessionStore {
  return {
    findWorkSessionById: () => Promise.resolve(undefined),
    listWorkSessions: () => Promise.resolve([]),
    listWorkSessionsForUseCase: (usecaseId) =>
      Promise.resolve(
        sessions.filter(
          (session) =>
            session.usecase_id === undefined || session.usecase_id === usecaseId
        )
      ),
    saveWorkSession: () => Promise.resolve(),
    updateWorkSession: () => Promise.resolve()
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

function revision(
  id: string,
  severity: NonNullable<StoredRevision["severity"]>,
  overrides: Partial<StoredRevision> = {}
): StoredRevision {
  return {
    entity_id: "usecase-1",
    entity_type: "USECASE",
    id,
    severity,
    snapshot: usecase(),
    version_number: 1,
    ...overrides
  };
}

function session(overrides: Partial<StoredWorkSession> = {}): StoredWorkSession {
  return {
    agent_type: "CODEX",
    id: "session-1",
    pinned_revisions: {},
    status: "ACTIVE",
    user_id: "user-1",
    ...overrides
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
    title: "Reviews a refund",
    ...overrides
  };
}

function usecaseSnapshot(options: {
  action?: string;
  invokes?: readonly string[];
}): StoredRevision["snapshot"] {
  return {
    ...usecase(),
    main_success: {
      steps: [
        {
          action: options.action ?? "Pays for the order",
          actor_id: "actor-1",
          id: "step-1",
          invokes: [...(options.invokes ?? [])],
          step_number: 1
        }
      ]
    }
  } as StoredRevision["snapshot"];
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

function step(overrides: Partial<StoredStep> = {}): StoredStep {
  return {
    action: "Pays for the order",
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
