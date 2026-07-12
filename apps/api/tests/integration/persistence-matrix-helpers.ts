// Shared helpers for the split persistence-matrix-*.test.ts files.
//
// Each split file owns its own `TestDatabaseRegistry` instance and
// registers an `afterEach` that tears down whatever databases were
// allocated during that test. That keeps the database lifecycle local
// to each file (no shared mutable module state) and lets vitest run
// the split files in parallel without cross-talk.

import path from "node:path";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";

import { expect } from "vitest";

import { withTestDatabase, type TestDatabase } from "../helpers/postgres-db.js";

const root = path.resolve(import.meta.dirname, "../../../..");
const apiEntry = path.resolve(import.meta.dirname, "../../src/index.ts");
const distEntry = path.resolve(root, "dist/apps/api/src/index.js");

// A persistence test restarts the server twice per case. Booting via tsx
// re-transpiles the whole API tree on every boot — the dominant cost. When
// VSPEC_TEST_USE_DIST=1 (CI builds before the test step, so dist is fresh)
// boot the compiled entry with `node` instead and skip transpilation. Local
// runs default to tsx so a stale dist can never silently change results.
function serverCommand(): { command: string; args: string[] } {
  if (process.env.VSPEC_TEST_USE_DIST === "1") {
    if (!existsSync(distEntry)) {
      throw new Error(
        `VSPEC_TEST_USE_DIST=1 but compiled entry missing: ${distEntry}. Run \`pnpm -r build\` first.`
      );
    }
    return { command: process.execPath, args: [distEntry] };
  }
  return pnpmCommand(["exec", "tsx", apiEntry]);
}

function pnpmCommand(args: string[]): { command: string; args: string[] } {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath !== undefined && path.basename(npmExecPath).includes("pnpm")) {
    return { command: process.execPath, args: [npmExecPath, ...args] };
  }
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", "pnpm", ...args] };
  }
  return { command: "pnpm", args };
}

export interface TestDatabaseRegistry {
  allocate: () => Promise<string>;
  teardownAll: () => Promise<void>;
}

export function createTestDatabaseRegistry(): TestDatabaseRegistry {
  const testDatabases: TestDatabase[] = [];
  return {
    async allocate() {
      const database = await withTestDatabase();
      testDatabases.push(database);
      return database.databaseUrl;
    },
    async teardownAll() {
      while (testDatabases.length > 0) {
        const database = testDatabases.pop();
        if (database !== undefined) {
          await database.teardown();
        }
      }
    }
  };
}

export async function bootServer(databaseUrl: string) {
  const port = await freeTcpPort();
  // The Postgres helper has already pushed the schema for this URL.
  const { command, args } = serverCommand();
  const child = spawn(command, args, {
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

async function freeTcpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => {
          reject(new Error("Expected TCP address."));
        });
        return;
      }
      server.close(() => {
        resolve(address.port);
      });
    });
  });
}

export async function signupWorkspace(baseUrl: string, githubCode: string) {
  return signupWorkspaceWithSlug(
    baseUrl,
    githubCode,
    `actor-persistence-${githubCode}`
  );
}

export async function signupWorkspaceWithSlug(
  baseUrl: string,
  githubCode: string,
  slug: string
) {
  const start = await fetch(`${baseUrl}/v1/auth/github/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      workspace: {
        name: "Actor Persistence",
        slug
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

export async function login(baseUrl: string, githubCode: string) {
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

export async function loginWithWorkspaces(baseUrl: string, githubCode: string) {
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

export async function createProject(
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

export function createProjectResponse(
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

export async function createActor(
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

export async function createBranch(
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

export function createBranchResponse(
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

export function createActorResponse(
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

export async function createGoal(
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

export async function createUseCase(
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

export async function startWorkSession(
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

export async function createStakeholder(
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

export async function addStakeholderInterest(
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

export function addStakeholderInterestResponse(
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

export async function createMainScenario(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  const response = await createMainScenarioResponse(baseUrl, sessionCookie, usecaseId);
  const body = (await response.json()) as { scenario: { id: string } };

  expect(response.status).toBe(201);
  return body.scenario;
}

export function createMainScenarioResponse(
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

export async function createStep(
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

export async function createLock(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
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

export async function addComment(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string,
  body: string
) {
  const response = await fetch(`${baseUrl}/v1/usecases/${usecaseId}/comments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ body })
  });
  const responseBody = (await response.json()) as { comment: { id: string } };

  expect(response.status).toBe(201);
  return responseBody.comment;
}

export function listComments(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/comments`, {
    headers: { cookie: sessionCookie }
  });
}

export async function createApiKey(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  name: string
) {
  const response = await fetch(`${baseUrl}/v1/api-keys`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({
      name,
      scopes: ["read"],
      workspace_id: workspaceId
    })
  });
  const body = (await response.json()) as {
    api_key: { id: string };
    plaintext_token?: string;
  };

  expect(response.status).toBe(201);
  expect(body.plaintext_token).toMatch(/^vsp_/);
  return body.api_key;
}

export function listApiKeys(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string
) {
  return fetch(`${baseUrl}/v1/api-keys?workspace_id=${workspaceId}`, {
    headers: { cookie: sessionCookie }
  });
}

export function whoIsWorking(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/who`, {
    headers: { cookie: sessionCookie }
  });
}

export function showUseCase(baseUrl: string, sessionCookie: string, usecaseId: string) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}?format=agent`, {
    headers: { cookie: sessionCookie }
  });
}

export async function readUseCase(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  const response = await showUseCase(baseUrl, sessionCookie, usecaseId);
  const body = (await response.json()) as {
    data: {
      primary_actor: { name: string };
      title: string;
      usecase: { id: string; key: string };
    };
  };
  return { data: body.data, status: response.status };
}

export function listRevisionHistory(
  baseUrl: string,
  sessionCookie: string,
  usecaseId: string
) {
  return fetch(`${baseUrl}/v1/usecases/${usecaseId}/revisions`, {
    headers: { cookie: sessionCookie }
  });
}

export function listSessions(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string
) {
  return fetch(`${baseUrl}/v1/sessions?workspace_id=${workspaceId}`, {
    headers: { cookie: sessionCookie }
  });
}

export async function archiveWorkspace(baseUrl: string, workspaceId: string) {
  const response = await fetch(`${baseUrl}/__test/workspaces/${workspaceId}/archive`, {
    method: "POST"
  });

  expect(response.status).toBe(200);
}

export async function createInvitation(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  email: string
) {
  const response = await createInvitationResponse(
    baseUrl,
    sessionCookie,
    workspaceId,
    email
  );
  const body = (await response.json()) as { invitation: { token: string } };

  expect(response.status).toBe(201);
  return body.invitation;
}

export function createInvitationResponse(
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

export async function acceptInvitation(
  baseUrl: string,
  token: string,
  githubCode: string
) {
  const response = await fetch(`${baseUrl}/v1/invitations/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: githubCode })
  });

  expect(response.status).toBe(200);
}

export async function openFailedMerge(
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

export function listGoals(
  baseUrl: string,
  sessionCookie: string,
  projectId: string,
  actorId: string
) {
  return fetch(`${baseUrl}/v1/projects/${projectId}/goals?actor_id=${actorId}`, {
    headers: { cookie: sessionCookie }
  });
}

export function promoteGoal(baseUrl: string, sessionCookie: string, goalId: string) {
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

export function cookieFrom(response: Response, name: string): string {
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
