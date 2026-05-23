import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";
import type {
  StoredProject,
  StoredUseCase
} from "../../../src/domain/entities/index.js";
import { registerDoctorRoutes } from "../../../src/http/doctor-routes.js";
import type { SignupState } from "../../../src/http/signup-types.js";

let currentApp: FastifyInstance | undefined;

afterEach(async () => {
  await currentApp?.close();
  currentApp = undefined;
});

describe("doctor routes", () => {
  test("requires exactly one diagnostic scope", async () => {
    const app = doctorApp();

    for (const query of ["", "?project_id=project-1&usecase_id=uc-1"]) {
      const response = await app.inject({ method: "GET", url: `/v1/doctor${query}` });

      expect(response.statusCode).toBe(400);
      expect(response.json<ProblemBody>().title).toBe(
        "Provide exactly one of project_id or usecase_id"
      );
    }
  });

  test("reports missing project and use case scopes", async () => {
    const app = doctorApp();

    const project = await app.inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/doctor?project_id=missing"
    });
    const usecase = await app.inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/doctor?usecase_id=missing"
    });

    expect(project.statusCode).toBe(404);
    expect(project.json<ProblemBody>().title).toBe("Project not found");
    expect(usecase.statusCode).toBe(404);
    expect(usecase.json<ProblemBody>().title).toBe("Use case not found");
  });

  test("rejects diagnostics for non-members", async () => {
    const response = await doctorApp({ member: false, project: project() }).inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/doctor?project_id=project-1"
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<ProblemBody>().title).toBe("Not authorized to run doctor");
  });

  test("returns project diagnostics for members", async () => {
    const response = await doctorApp({
      project: project(),
      usecases: [usecase()]
    }).inject({
      headers: authHeaders(),
      method: "GET",
      url: "/v1/doctor?project_id=project-1"
    });

    const body = response.json<DoctorBody>();
    expect(response.statusCode).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.scope.project_id).toBe("project-1");
    expect(body.checks).toContainEqual(
      expect.objectContaining({ id: "project.usecases.visible", status: "pass" })
    );
  });
});

type ProblemBody = { title: string };
type DoctorBody = {
  checks: Array<{ id: string; status: string }>;
  scope: { project_id: string; usecase?: { key: string } };
  status: string;
};
type DoctorOptions = {
  member?: boolean;
  project?: StoredProject;
  usecaseLookup?: { projectId: string; usecase: StoredUseCase };
  usecases?: StoredUseCase[];
};

function doctorApp(options: DoctorOptions = {}) {
  const app = Fastify();
  currentApp = app;
  registerDoctorRoutes(app, state(), {
    membershipStore: {
      membershipForProject: () =>
        Promise.resolve(options.member === false ? undefined : membership()),
      membershipForWorkspace: () => Promise.resolve(undefined),
      membershipsForUser: () => Promise.resolve([]),
      saveMembership: () => Promise.resolve()
    },
    projectStore: {
      deleteProject: () => Promise.resolve("NOT_FOUND"),
      findProjectById: () => Promise.resolve(options.project),
      findProjectByWorkspaceAndKey: () => Promise.resolve(undefined),
      listProjectsForWorkspace: () => Promise.resolve([]),
      saveProject: () => Promise.resolve(),
      updateProjectName: () => Promise.resolve(undefined)
    },
    scenarioStore: {} as never,
    stakeholderInterestStore: {
      listStakeholderInterests: () => Promise.resolve([])
    } as never,
    stepStore: {} as never,
    useCaseStore: {
      findUseCaseById: () => Promise.resolve(undefined),
      findUseCaseWithProject: () => Promise.resolve(options.usecaseLookup),
      findUseCasesByKey: () => Promise.resolve([]),
      listUseCases: () => Promise.resolve(options.usecases ?? []),
      saveUseCase: () => Promise.resolve(),
      updateUseCase: () => Promise.resolve()
    }
  });
  return app;
}

function state(): SignupState {
  return {
    pendingOAuth: new Map(),
    readOnlyMemberships: new Set(),
    sessionsByToken: new Map([["session-1", "user-1"]])
  };
}

const authHeaders = () => ({ cookie: "vspec_session=session-1" });
const membership = () => ({
  id: "membership-1",
  role: "EDITOR" as const,
  user_id: "user-1",
  workspace_id: "workspace-1"
});
const project = (): StoredProject => ({
  default_branch_id: "branch-1",
  id: "project-1",
  key: "PAY",
  name: "Payments",
  visibility: "PRIVATE",
  workspace_id: "workspace-1"
});
const usecase = (): StoredUseCase => ({
  archived_at: null,
  current_revision_id: "revision-1",
  format: "BRIEF",
  id: "usecase-1",
  key: "PAY-001",
  level: "USER_GOAL",
  primary_actor_id: "actor-1",
  priority: "P1",
  project_id: "project-1",
  scope: "Payments",
  status: "DRAFT",
  title: "Pay an invoice"
});
