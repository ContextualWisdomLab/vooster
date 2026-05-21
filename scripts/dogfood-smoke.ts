import { readdir, readFile } from "node:fs/promises";
import type { InjectOptions, LightMyRequestResponse } from "fastify";
import { createServer } from "../apps/api/src/http/server.js";

const app = await createServer({ authStub: true });

try {
  const owner = await signup("Dogfood", "dogfood", "stub-dogfood-owner");
  const project = await post<{ project: { id: string } }>(
    `/v1/workspaces/${owner.workspaceId}/projects`,
    owner.cookie,
    { key: "VSPEC", name: "vspec", visibility: "PRIVATE" }
  );
  await post(`/v1/projects/${project.project.id}/actors`, owner.cookie, {
    aliases: [],
    description: "",
    is_human: true,
    name: "Developer / PM",
    type: "PRIMARY"
  });
  await post(`/v1/projects/${project.project.id}/stakeholders`, owner.cookie, {
    description: "",
    name: "Product Manager",
    type: "INTERNAL"
  });

  const usecases = await useCaseSpecs();
  const created = [];
  for (const spec of usecases) {
    const body = await post<{ usecase: { id: string; key: string } }>(
      `/v1/projects/${project.project.id}/usecases`,
      owner.cookie,
      { force: true, primary_actor: "Developer / PM", title: spec.title }
    );
    created.push(body.usecase);
  }

  const first = created[0];
  if (first === undefined || created.length !== usecases.length) {
    throw new Error("dogfood did not create every use case");
  }

  await post(`/v1/usecases/${first.id}/comments`, owner.cookie, { body: "dogfood comment" });
  const comments = await get<{ comments: unknown[] }>(`/v1/usecases/${first.id}/comments`, owner.cookie);
  if (comments.comments.length !== 1) {
    throw new Error("dogfood comment did not persist");
  }

  await post(`/v1/usecases/${first.id}/stakeholder-interests`, owner.cookie, {
    interest: "See a complete dogfood path.",
    protection_mechanism: "Run the smoke script before release.",
    stakeholder: "Product Manager"
  });
  const scenario = await post<{ scenario: { id: string } }>(
    `/v1/usecases/${first.id}/scenarios`,
    owner.cookie,
    { type: "MAIN_SUCCESS" }
  );
  await post(`/v1/scenarios/${scenario.scenario.id}/steps`, owner.cookie, {
    action: "Reviews the dogfood result.",
    actor: "Developer / PM"
  });
  const gherkin = await text(`/v1/usecases/${first.id}/export/gherkin?format=feature`, owner.cookie);
  if (!gherkin.startsWith("Feature:")) {
    throw new Error("dogfood Gherkin export missing Feature header");
  }
} finally {
  await app.close();
}

async function signup(name: string, slug: string, code: string) {
  const start = await request("/v1/auth/github/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspace: { name, slug } })
  });
  ensureOk("/v1/auth/github/start", start);
  const startBody = JSON.parse(start.payload) as { state: string };
  const callback = await request(`/v1/auth/github/callback?${new URLSearchParams({
    code,
    state: startBody.state
  }).toString()}`, {
    headers: { Cookie: cookieHeader(start) }
  });
  ensureOk("/v1/auth/github/callback", callback);
  const body = JSON.parse(callback.payload) as { workspace: { id: string } };
  return {
    cookie: cookieHeader(callback),
    workspaceId: body.workspace.id
  };
}

async function useCaseSpecs() {
  const files = (await readdir("docs/usecases")).filter((file) => /^UC-\d+.*\.md$/.test(file));
  return Promise.all(files.map(async (file) => ({
    file,
    title: /^title:\s*(.+)$/m.exec(await readFile(`docs/usecases/${file}`, "utf8"))?.[1] ?? file
  })));
}

async function post<T = unknown>(path: string, cookie: string, body: unknown): Promise<T> {
  const response = await request(path, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (response.statusCode >= 400) {
    throw new Error(`${path} failed: ${String(response.statusCode)} ${response.payload}`);
  }
  return JSON.parse(response.payload) as T;
}

async function get<T>(path: string, cookie: string): Promise<T> {
  const response = await request(path, { headers: { cookie } });
  if (response.statusCode >= 400) {
    throw new Error(`${path} failed: ${String(response.statusCode)} ${response.payload}`);
  }
  return JSON.parse(response.payload) as T;
}

async function text(path: string, cookie: string): Promise<string> {
  const response = await request(path, { method: "POST", headers: { cookie } });
  if (response.statusCode >= 400) {
    throw new Error(`${path} failed: ${String(response.statusCode)} ${response.payload}`);
  }
  return response.payload;
}

type DogfoodMethod = "GET" | "POST";

function request(
  path: string,
  options: { body?: string; headers?: Record<string, string>; method?: DogfoodMethod } = {}
): Promise<LightMyRequestResponse> {
  const requestOptions: InjectOptions = {
    method: options.method ?? "GET",
    url: path,
    headers: options.headers,
    payload: options.body
  };

  return app.inject(requestOptions);
}

function cookieHeader(response: LightMyRequestResponse): string {
  const cookies = response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`);
  if (cookies.length === 0) {
    throw new Error("dogfood response did not set a cookie");
  }
  return cookies.join("; ");
}

function ensureOk(path: string, response: LightMyRequestResponse) {
  if (response.statusCode >= 400) {
    throw new Error(`${path} failed: ${String(response.statusCode)} ${response.payload}`);
  }
}
