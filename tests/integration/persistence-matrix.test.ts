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
    const invitee = await signupWorkspace(first.url, "membership-invitee");
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
  const response = await fetch(`${baseUrl}/v1/workspaces/${signup.workspaceId}/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: signup.sessionCookie
    },
    body: JSON.stringify({ key, name, visibility: "PRIVATE" })
  });
  const body = (await response.json()) as { project: { id: string } };

  expect(response.status).toBe(201);
  return body.project;
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
  expect(response.status).toBe(201);
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

async function createInvitation(
  baseUrl: string,
  sessionCookie: string,
  workspaceId: string,
  email: string
) {
  const response = await fetch(`${baseUrl}/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: sessionCookie
    },
    body: JSON.stringify({ email, role: "EDITOR" })
  });
  const body = (await response.json()) as { invitation: { token: string } };

  expect(response.status).toBe(201);
  return body.invitation;
}

async function acceptInvitation(baseUrl: string, token: string, githubCode: string) {
  const response = await fetch(`${baseUrl}/v1/invitations/${token}/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: githubCode })
  });

  expect(response.status).toBe(200);
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
