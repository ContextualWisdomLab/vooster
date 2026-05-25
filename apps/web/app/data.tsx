import { cookies } from "next/headers";

export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  visibility: string;
  workspace_id: string;
};

export type UsecaseSummary = {
  key: string;
  level: string;
  primary_actor: string;
  status: string;
  title: string;
  scenario_count: number;
  extension_count: number;
};

export type ActorSummary = {
  id: string;
  name: string;
  type: string;
};

export type UsecaseDetail = {
  title: string;
  primary_actor: { name: string };
  level: string;
  status: string;
  main_scenario: {
    steps: Array<{ action: string; actor: string; step_number: number }>;
  };
  extensions: Array<{ condition: string; outcome: string }>;
  stakeholder_interests: Array<{ interest: string; stakeholder: string }>;
};

const DEMO_WORKSPACE_ID = "DEMO-WORKSPACE";

type StubGlobal = { __vsepecDemoProjects?: ProjectSummary[] };

function demoProjects(): ProjectSummary[] {
  const store = globalThis as StubGlobal;
  if (store.__vsepecDemoProjects === undefined) {
    store.__vsepecDemoProjects = [
      {
        id: "DEMO",
        key: "DEMO",
        name: "Checkout Review",
        visibility: "PRIVATE",
        workspace_id: DEMO_WORKSPACE_ID
      }
    ];
  }
  return store.__vsepecDemoProjects;
}

const demoUsecases: UsecaseSummary[] = [
  {
    key: "DEMO-001",
    level: "USER_GOAL",
    primary_actor: "Customer",
    status: "DRAFT",
    title: "Places an order",
    scenario_count: 1,
    extension_count: 1
  }
];

const demoActors: ActorSummary[] = [
  { id: "DEMO-ACTOR-1", name: "Customer", type: "PRIMARY" }
];

const demoDetail: UsecaseDetail = {
  title: "Places an order",
  primary_actor: { name: "Customer" },
  level: "USER_GOAL",
  status: "DRAFT",
  main_scenario: {
    steps: [{ action: "Places an order.", actor: "Customer", step_number: 1 }]
  },
  extensions: [{ condition: "Payment is declined", outcome: "FAILURE" }],
  stakeholder_interests: [
    { interest: "Checkout revenue is protected.", stakeholder: "Product Manager" }
  ]
};

export async function fetchProjects(): Promise<ProjectSummary[]> {
  if (isAuthStub()) {
    return [...demoProjects()];
  }

  const response = await readApi<{ items: ProjectSummary[] }>("/v1/projects");
  return response.items;
}

export async function fetchProjectUsecases(
  projectKey: string
): Promise<UsecaseSummary[]> {
  if (isAuthStub()) {
    return demoUsecases.map((item) => ({ ...item, key: `${projectKey}-001` }));
  }

  return readApi<UsecaseSummary[]>(`/v1/projects/${projectKey}/usecases`);
}

export async function fetchProjectActors(
  projectKey: string
): Promise<ActorSummary[]> {
  if (isAuthStub()) {
    return [...demoActors];
  }

  const response = await readApi<{ items: ActorSummary[] }>(
    `/v1/projects/${projectKey}/actors`
  );
  return response.items;
}

export async function fetchUsecaseDetail(
  _projectKey: string,
  ucKey: string
): Promise<UsecaseDetail> {
  if (isAuthStub()) {
    return {
      ...demoDetail,
      title: ucKey === "DEMO-001" ? demoDetail.title : `${ucKey} spec`
    };
  }

  return readApi<UsecaseDetail>(`/v1/usecases/${ucKey}?format=agent`);
}

export type CreateProjectInput = {
  name: string;
  key: string;
  visibility?: "PRIVATE" | "INTERNAL";
};

export type CreateProjectResult =
  | { ok: true; project: ProjectSummary }
  | { ok: false; error: string };

export async function createProjectRequest(
  input: CreateProjectInput
): Promise<CreateProjectResult> {
  if (isAuthStub()) {
    const store = demoProjects();
    if (store.some((project) => project.key === input.key)) {
      return { ok: false, error: `Project key ${input.key} is already in use.` };
    }
    const project: ProjectSummary = {
      id: `${input.key}-${randomSuffix()}`,
      key: input.key,
      name: input.name,
      visibility: input.visibility ?? "PRIVATE",
      workspace_id: DEMO_WORKSPACE_ID
    };
    store.push(project);
    return { ok: true, project };
  }

  const response = await mutateApi("/v1/projects", {
    method: "POST",
    body: {
      name: input.name,
      key: input.key,
      visibility: input.visibility ?? "PRIVATE"
    }
  });

  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  const body = response.body as { project: ProjectSummary };
  return { ok: true, project: body.project };
}

export type RenameProjectResult =
  | { ok: true; project: ProjectSummary }
  | { ok: false; error: string };

export async function renameProjectRequest(
  projectId: string,
  name: string
): Promise<RenameProjectResult> {
  if (isAuthStub()) {
    const project = demoProjects().find((entry) => entry.id === projectId);
    if (project === undefined) {
      return { ok: false, error: "Project not found." };
    }
    project.name = name;
    return { ok: true, project: { ...project } };
  }

  const response = await mutateApi(`/v1/projects/${projectId}`, {
    method: "PATCH",
    body: { name }
  });

  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  const body = response.body as { project: ProjectSummary };
  return { ok: true, project: body.project };
}

export type DeleteProjectResult = { ok: true } | { ok: false; error: string };

export async function deleteProjectRequest(
  projectId: string
): Promise<DeleteProjectResult> {
  if (isAuthStub()) {
    const store = demoProjects();
    const index = store.findIndex((entry) => entry.id === projectId);
    if (index === -1) {
      return { ok: false, error: "Project not found." };
    }
    store.splice(index, 1);
    return { ok: true };
  }

  const response = await mutateApi(`/v1/projects/${projectId}`, { method: "DELETE" });
  if (!response.ok) {
    return { ok: false, error: response.error };
  }
  return { ok: true };
}

async function readApi<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const session = cookieStore.get("vspec_session")?.value;
  const response = await fetch(`${apiUrl()}${path}`, {
    headers: {
      Cookie: session === undefined ? "" : `vspec_session=${session}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed with ${String(response.status)}`);
  }

  return response.json() as Promise<T>;
}

type MutateOptions = {
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

type MutateResult = { ok: true; body: unknown } | { ok: false; error: string };

async function mutateApi(path: string, options: MutateOptions): Promise<MutateResult> {
  const cookieStore = await cookies();
  const session = cookieStore.get("vspec_session")?.value;
  const headers: Record<string, string> = {
    Cookie: session === undefined ? "" : `vspec_session=${session}`
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${apiUrl()}${path}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: extractError(text, response.status) };
  }

  if (response.status === 204) {
    return { ok: true, body: null };
  }
  return { ok: true, body: (await response.json()) as unknown };
}

function extractError(text: string, status: number): string {
  try {
    const parsed = JSON.parse(text) as { title?: string };
    if (typeof parsed.title === "string" && parsed.title.length > 0) {
      return parsed.title;
    }
  } catch {
    // fall through
  }
  return `Request failed (${String(status)})`;
}

function isAuthStub(): boolean {
  return process.env.VSPEC_AUTH_STUB === "1";
}

function apiUrl(): string {
  return process.env.VSPEC_API_URL ?? "http://127.0.0.1:3000";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
