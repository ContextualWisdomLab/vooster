import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { spawn, type ChildProcess } from "node:child_process";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, "../..");

describe("Goal 2 persistence matrix", () => {
  let tempDir = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "vspec-persist-"));
    await execFileAsync("npm", ["run", "build"], { cwd: root });
  }, 60_000);

  afterAll(async () => {
    if (tempDir !== "") {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("Actor survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "actor.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "actor-owner");
    const project = await createProject(first.url, signup, "Actor Matrix", "ACTOR");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "actor-owner");
    const duplicate = await createActorResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "Customer"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      existing_actor_id?: unknown;
      title?: unknown;
    };
    expect(typeof duplicateBody.existing_actor_id).toBe("string");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/actor name.*already exists/i)
    );
  }, 90_000);

  test("SpecBranch survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "specbranch.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "branch-owner");
    const project = await createProject(first.url, signup, "Branch Matrix", "BRANCH");
    await createBranch(first.url, signup.sessionCookie, project.id, "feature/persist");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "branch-owner");
    const duplicate = await createBranchResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "feature/persist"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      suggested_name?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.suggested_name).toBe("feature/persist-2");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/branch name is already in use/i)
    );
  }, 90_000);

  test("Goal survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "goal.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "goal-owner");
    const project = await createProject(first.url, signup, "Goal Matrix", "GOAL");
    const actor = await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const goal = await createGoal(
      first.url,
      signup.sessionCookie,
      project.id,
      actor.id,
      "Tracks an order"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "goal-owner");
    const listed = await listGoals(second.url, loggedIn.sessionCookie, project.id, actor.id);

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      actors?: Array<{ goals?: Array<{ id?: unknown }> }>;
    };
    expect(listedBody.actors?.[0]?.goals?.map((entry) => entry.id)).toContain(goal.id);
  }, 90_000);

  test("Membership survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "membership.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const owner = await signupWorkspace(first.url, "membership-owner");
    await signupWorkspace(first.url, "membership-invitee");
    const invitation = await createInvitation(
      first.url,
      owner.sessionCookie,
      owner.workspaceId,
      "membership-invitee@users.noreply.github.com"
    );
    await acceptInvitation(first.url, invitation.token, "membership-invitee");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await loginWithWorkspaces(second.url, "membership-invitee");

    await second.stop();

    expect(loggedIn.workspaces.map((workspace) => workspace.id)).toContain(
      owner.workspaceId
    );
  }, 90_000);

  test("User survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "user.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const owner = await signupWorkspace(first.url, "user-owner");
    const invitation = await createInvitation(
      first.url,
      owner.sessionCookie,
      owner.workspaceId,
      "fresh-invitee@users.noreply.github.com"
    );
    await acceptInvitation(first.url, invitation.token, "fresh-invitee");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await loginWithWorkspaces(second.url, "fresh-invitee");

    await second.stop();

    expect(loggedIn.workspaces.map((workspace) => workspace.id)).toContain(
      owner.workspaceId
    );
  }, 90_000);

  test("WorkSession survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "worksession.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "work-session-owner");
    const project = await createProject(first.url, signup, "Work Session Matrix", "WS");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a session workflow",
      "Customer"
    );
    const session = await startWorkSession(
      first.url,
      signup.sessionCookie,
      project.id,
      usecase.key
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "work-session-owner");
    const listed = await listSessions(second.url, loggedIn.sessionCookie, signup.workspaceId);

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      sessions?: Array<{ id?: unknown; status?: unknown }>;
    };
    expect(listedBody.sessions ?? []).toContainEqual(
      expect.objectContaining({ id: session.id, status: "ACTIVE" })
    );
  }, 90_000);

  test("Workspace archive survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "workspace-archive.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "workspace-archive-owner");
    await archiveWorkspace(first.url, signup.workspaceId);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "workspace-archive-owner");
    const created = await createProjectResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "Archived Workspace Project",
      "WARC"
    );

    await second.stop();

    expect(created.status).toBe(409);
    const createdBody = (await created.json()) as { title?: unknown };
    expect(createdBody.title).toEqual(expect.stringMatching(/workspace.*archived/i));
  }, 90_000);

  test("Workspace lookup survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "workspace-lookup.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "workspace-lookup-owner");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "workspace-lookup-owner");
    const invitation = await createInvitationResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "workspace-lookup-invitee@users.noreply.github.com"
    );

    await second.stop();

    expect(invitation.status).toBe(201);
    const invitationBody = (await invitation.json()) as {
      invitation?: { workspace_id?: unknown };
    };
    expect(invitationBody.invitation?.workspace_id).toBe(signup.workspaceId);
  }, 90_000);

  test("MergeRequest survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "mergerequest.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "merge-owner");
    const project = await createProject(first.url, signup, "Merge Matrix", "MERGE");
    const source = await createBranch(
      first.url,
      signup.sessionCookie,
      project.id,
      "feature/open-merge"
    );
    const merge = await openFailedMerge(first.url, signup.sessionCookie, source.id);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "merge-owner");
    const warned = await createBranchResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "feature/next"
    );

    await second.stop();

    expect(warned.status).toBe(201);
    const warnedBody = (await warned.json()) as {
      warnings?: Array<{ merge_request_id?: unknown; type?: unknown }>;
    };
    expect(warnedBody.warnings ?? []).toContainEqual({
      merge_request_id: merge.id,
      type: "IN_FLIGHT_MERGE_REQUEST"
    });
  }, 90_000);

  test("ProjectKey survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "projectkey.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "project-key-owner");
    const project = await createProject(first.url, signup, "Project Key Matrix", "PKM");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "project-key-owner");
    const duplicate = await createProjectResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "Duplicate Project Key Matrix",
      "PKM"
    );

    await second.stop();

    expect(duplicate.status).toBe(422);
    const duplicateBody = (await duplicate.json()) as {
      existing_project?: { id?: unknown; key?: unknown };
      title?: unknown;
    };
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/project key is already in use/i)
    );
    expect(duplicateBody.existing_project).toMatchObject({
      id: project.id,
      key: "PKM"
    });
  }, 90_000);

  test("Project survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "project.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "project-owner");
    const project = await createProject(first.url, signup, "Project Matrix", "PROJ");
    const actor = await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const goal = await createGoal(
      first.url,
      signup.sessionCookie,
      project.id,
      actor.id,
      "Completes a project workflow"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "project-owner");
    const promoted = await promoteGoal(second.url, loggedIn.sessionCookie, goal.id);

    await second.stop();

    expect(promoted.status).toBe(201);
    const promotedBody = (await promoted.json()) as {
      usecase?: { project_id?: unknown };
    };
    expect(promotedBody.usecase?.project_id).toBe(project.id);
  }, 90_000);

  test("Scenario survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "scenario.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "scenario-owner");
    const project = await createProject(first.url, signup, "Scenario Matrix", "SCEN");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a scenario workflow",
      "Customer"
    );
    await createStakeholder(
      first.url,
      signup.sessionCookie,
      project.id,
      "Operations"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(
      first.url,
      signup.sessionCookie,
      usecase.id
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "scenario-owner");
    const duplicate = await createMainScenarioResponse(
      second.url,
      loggedIn.sessionCookie,
      usecase.id
    );

    await second.stop();

    expect(duplicate.status).toBe(409);
    const duplicateBody = (await duplicate.json()) as {
      existing_scenario_id?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.existing_scenario_id).toBe(scenario.id);
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/main_success scenario already exists/i)
    );
  }, 90_000);

  test("Lock survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "lock.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "lock-owner");
    const project = await createProject(first.url, signup, "Lock Matrix", "LOCK");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a locked workflow",
      "Customer"
    );
    const lock = await createLock(first.url, signup.sessionCookie, usecase.id);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "lock-owner");
    const who = await whoIsWorking(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(who.status).toBe(200);
    const whoBody = (await who.json()) as {
      locks?: Array<{ id?: unknown; lock_type?: unknown }>;
    };
    expect(whoBody.locks ?? []).toContainEqual(
      expect.objectContaining({ id: lock.id, lock_type: "HARD" })
    );
  }, 90_000);

  test("StakeholderInterest survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "stakeholderinterest.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "stakeholder-interest-owner");
    const project = await createProject(
      first.url,
      signup,
      "Stakeholder Interest Matrix",
      "SIM"
    );
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a protected workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "stakeholder-interest-owner");
    const duplicate = await addStakeholderInterestResponse(
      second.url,
      loggedIn.sessionCookie,
      usecase.id,
      "Operations"
    );

    await second.stop();

    expect(duplicate.status).toBe(409);
    const duplicateBody = (await duplicate.json()) as {
      existing_interest?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.existing_interest).toBe("Scenario outcome remains auditable");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/stakeholder interest.*already exists/i)
    );
  }, 90_000);

  test("Step survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "step.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "step-owner");
    const project = await createProject(first.url, signup, "Step Matrix", "STEP");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a stepped workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(first.url, signup.sessionCookie, usecase.id);
    const step = await createStep(
      first.url,
      signup.sessionCookie,
      scenario.id,
      "Customer",
      "Submit the support request."
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "step-owner");
    const shown = await showUseCase(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(shown.status).toBe(200);
    const shownBody = (await shown.json()) as {
      data?: {
        scenarios?: Array<{
          id?: unknown;
          steps?: Array<{ action?: unknown; actor?: unknown; step_number?: unknown }>;
        }>;
      };
    };
    const persistedScenario = (shownBody.data?.scenarios ?? [])
      .find((entry) => entry.id === scenario.id);
    expect(persistedScenario?.steps ?? []).toContainEqual({
      action: step.action,
      actor: "Customer",
      step_number: 1
    });
  }, 90_000);

  test("Revision survives a server restart", async () => {
    const databaseUrl = `file:${path.join(tempDir, "revision.sqlite")}`;
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "revision-owner");
    const project = await createProject(first.url, signup, "Revision Matrix", "REV");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a revised workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(first.url, signup.sessionCookie, usecase.id);
    await createStep(
      first.url,
      signup.sessionCookie,
      scenario.id,
      "Customer",
      "Submit the support request."
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "revision-owner");
    const history = await listRevisionHistory(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as {
      revisions?: Array<{
        change_summary?: unknown;
        entity_id?: unknown;
        entity_type?: unknown;
        version_number?: unknown;
      }>;
    };
    expect(historyBody.revisions ?? []).toContainEqual(
      expect.objectContaining({
        change_summary: "Added step 1 to main success scenario",
        entity_id: usecase.id,
        entity_type: "USECASE",
        version_number: 4
      })
    );
  }, 90_000);
});

async function bootServer(databaseUrl: string) {
  const port = 42_000 + Math.floor(Math.random() * 1_000);
  const child = spawn("npm", ["start"], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      VSPEC_AUTH_STUB: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const url = `http://127.0.0.1:${String(port)}`;

  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early: ${await outputFrom(child)}`);
    }
    if (await isHealthy(url)) {
      return {
        port,
        url,
        stop: () => stopServer(child)
      };
    }
    await delay(250);
  }

  await stopServer(child);
  throw new Error(`server did not become healthy: ${await outputFrom(child)}`);
}

async function signupWorkspace(baseUrl: string, githubCode: string) {
  const start = await fetch(`${baseUrl}/v1/auth/github/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace: {
        name: "Actor Persistence",
        slug: `actor-persistence-${githubCode}`
      }
    })
  });
  const oauthCookie = cookieFrom(start, "vspec_oauth_state");
  const { state } = (await start.json()) as { state: string };
  const callback = await fetch(
    `${baseUrl}/v1/auth/github/callback?code=${githubCode}&state=${state}`,
    { headers: { cookie: oauthCookie } }
  );
  const sessionCookie = cookieFrom(callback, "vspec_session");
  const body = (await callback.json()) as {
    workspace: { id: string };
  };

  expect(callback.status).toBe(201);
  return { sessionCookie, workspaceId: body.workspace.id };
}

async function login(baseUrl: string, githubCode: string) {
  const start = await fetch(`${baseUrl}/v1/auth/github/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow: "login" })
  });
  const oauthCookie = cookieFrom(start, "vspec_oauth_state");
  const { state } = (await start.json()) as { state: string };
  const callback = await fetch(
    `${baseUrl}/v1/auth/github/callback?code=${githubCode}&state=${state}`,
    { headers: { cookie: oauthCookie } }
  );

  expect(callback.status).toBe(200);
  return { sessionCookie: cookieFrom(callback, "vspec_session") };
}

async function loginWithWorkspaces(baseUrl: string, githubCode: string) {
  const start = await fetch(`${baseUrl}/v1/auth/github/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow: "login" })
  });
  const oauthCookie = cookieFrom(start, "vspec_oauth_state");
  const { state } = (await start.json()) as { state: string };
  const callback = await fetch(
    `${baseUrl}/v1/auth/github/callback?code=${githubCode}&state=${state}`,
    { headers: { cookie: oauthCookie } }
  );
  const body = (await callback.json()) as {
    workspaces: Array<{ id: string }>;
  };

  expect(callback.status).toBe(200);
  return body;
}

async function createProject(
  baseUrl: string,
  signup: { sessionCookie: string; workspaceId: string },
  name: string,
  key: string
) {
  const response = await createProjectResponse(
    baseUrl,
    signup.sessionCookie,
    signup.workspaceId,
    name,
    key
  );
  const body = (await response.json()) as { project: { id: string } };

  expect(response.status).toBe(201);
  return body.project;
}

function createProjectResponse(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  name: string,
  key: string
) {
  return fetch(`${baseUrl}/v1/workspaces/${workspaceId}/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ key, name, visibility: "PRIVATE" })
  });
}

async function createActor(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  name: string
) {
  const response = await createActorResponse(baseUrl, sessionCookie, projectId, name);
  const body = (await response.json()) as { actor: { id: string } };
  expect(response.status).toBe(201);
  return body.actor;
}

async function createBranch(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  name: string
) {
  const response = await createBranchResponse(baseUrl, sessionCookie, projectId, name);
  const body = (await response.json()) as { branch: { id: string } };
  expect(response.status).toBe(201);
  return body.branch;
}

function createBranchResponse(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  name: string
) {
  return fetch(`${baseUrl}/v1/projects/${projectId}/branches`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ from: "main", name })
  });
}

function createActorResponse(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  name: string
) {
  return fetch(`${baseUrl}/v1/projects/${projectId}/actors`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      aliases: [],
      description: "Buys products",
      is_human: true,
      name,
      type: "PRIMARY"
    })
  });
}

async function createGoal(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  actorId: string,
  description: string
) {
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/goals`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      actor_id: actorId,
      description,
      level: "USER_GOAL",
      priority: "P1"
    })
  });
  const body = (await response.json()) as { goal: { id: string } };

  expect(response.status).toBe(201);
  return body.goal;
}

async function createUseCase(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  title: string,
  primaryActor: string
) {
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/usecases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      primary_actor: primaryActor,
      title
    })
  });
  const body = (await response.json()) as { usecase: { id: string; key: string } };

  expect(response.status).toBe(201);
  return body.usecase;
}

async function startWorkSession(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  usecaseKey: string
) {
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      agent_type: "CODEX",
      intent: "Verify work session persistence",
      pins: [usecaseKey],
      project_id: projectId
    })
  });
  const body = (await response.json()) as { session: { id: string } };

  expect(response.status).toBe(201);
  return body.session;
}

async function createStakeholder(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  name: string
) {
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/stakeholders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      description: "Keeps the operation reliable",
      name,
      type: "INTERNAL"
    })
  });

  expect(response.status).toBe(201);
}

async function addStakeholderInterest(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string,
  stakeholder: string
) {
  const response = await addStakeholderInterestResponse(
    baseUrl,
    sessionCookie,
    usecaseId,
    stakeholder
  );

  expect(response.status).toBe(201);
}

function addStakeholderInterestResponse(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string,
  stakeholder: string
) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/stakeholder-interests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      interest: "Scenario outcome remains auditable",
      stakeholder
    })
  });
}

async function createMainScenario(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  const response = await createMainScenarioResponse(baseUrl, sessionCookie, usecaseId);
  const body = (await response.json()) as { scenario: { id: string } };

  expect(response.status).toBe(201);
  return body.scenario;
}

function createMainScenarioResponse(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/scenarios`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ type: "MAIN_SUCCESS" })
  });
}

async function createStep(
  baseUrl: string,
  sessionCookie: string,
  scenarioId: string,
  actor: string,
  action: string
) {
  const response = await fetch(`${baseUrl}/v1/scenarios/${scenarioId}/steps`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ action, actor })
  });
  const body = (await response.json()) as { step: { action: string; id: string } };

  expect(response.status).toBe(201);
  return body.step;
}

async function createLock(baseUrl: string, sessionCookie: string, usecaseId: string) {
  const response = await fetch(`${baseUrl}/v1/locks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      lock_type: "HARD",
      reason: "Protect restart persistence",
      target_id: usecaseId,
      target_type: "USECASE",
      ttl_minutes: 30
    })
  });
  const body = (await response.json()) as { lock: { id: string } };

  expect(response.status).toBe(201);
  return body.lock;
}

function whoIsWorking(baseUrl: string, sessionCookie: string, usecaseId: string) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/who`, {
    headers: { cookie: sessionCookie }
  });
}

function showUseCase(baseUrl: string, sessionCookie: string, usecaseId: string) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}?format=agent`, {
    headers: { cookie: sessionCookie }
  });
}

function listRevisionHistory(baseUrl: string, sessionCookie: string, usecaseId: string) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/revisions`, {
    headers: { cookie: sessionCookie }
  });
}

function listSessions(baseUrl: string, sessionCookie: string, workspaceId: string) {
  return fetch(`${baseUrl}/v1/sessions?workspace_id=${workspaceId}`, {
    headers: { cookie: sessionCookie }
  });
}

async function archiveWorkspace(baseUrl: string, workspaceId: string) {
  const response = await fetch(`${baseUrl}/__test/workspaces/${workspaceId}/archive`, {
    method: "POST"
  });

  expect(response.status).toBe(200);
}

async function createInvitation(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  email: string
) {
  const response = await createInvitationResponse(baseUrl, sessionCookie, workspaceId, email);
  const body = (await response.json()) as { invitation: { token: string } };

  expect(response.status).toBe(201);
  return body.invitation;
}

function createInvitationResponse(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  email: string
) {
  return fetch(`${baseUrl}/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ email, role: "EDITOR" })
  });
}

async function acceptInvitation(baseUrl: string, token: string, githubCode: string) {
  const response = await fetch(`${baseUrl}/v1/invitations/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: githubCode })
  });

  expect(response.status).toBe(200);
}

async function openFailedMerge(
  baseUrl: string,
  sessionCookie: string,
  sourceBranchId: string
) {
  const response = await fetch(`${baseUrl}/v1/merges`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      simulate_write_failure: true,
      source_branch_id: sourceBranchId
    })
  });
  const body = (await response.json()) as { merge_request: { id: string } };

  expect(response.status).toBe(500);
  return body.merge_request;
}

function listGoals(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  actorId: string
) {
  return fetch(`${baseUrl}/v1/projects/${projectId}/goals?actor_id=${actorId}`, {
    headers: { cookie: sessionCookie }
  });
}

function promoteGoal(baseUrl: string, sessionCookie: string, goalId: string) {
  return fetch(`${baseUrl}/v1/goals/${goalId}/promote`, {
    method: "POST",
    headers: { cookie: sessionCookie }
  });
}

async function isHealthy(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/healthz`);
    return response.ok;
  } catch {
    return false;
  }
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    child.once("exit", () => {
      resolve();
    });
  });
}

async function outputFrom(child: ChildProcess) {
  const chunks: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  await delay(50);
  return chunks.join("");
}

function cookieFrom(response: Response, name: string): string {
  const setCookie = response.headers.get("set-cookie");
  const entry = setCookie
    ?.split(/,(?=\s*[^;,]+=)/)
    .find((candidate) => candidate.trim().startsWith(`${name}=`));
  const cookie = entry?.split(";").at(0)?.trim();

  if (cookie === undefined || cookie === `${name}=`) {
    throw new Error(`missing ${name} cookie`);
  }

  return cookie;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
