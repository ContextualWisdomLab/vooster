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
  expect(response.status).toBe(201);
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
