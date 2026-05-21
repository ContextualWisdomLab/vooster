import { cookies } from "next/headers";

export type ProjectSummary = {
  key: string;
  name: string;
  updated_at: string;
};

export type UsecaseSummary = {
  key: string;
  level: string;
  primary_actor: string;
  status: string;
  title: string;
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

const demoProjects: ProjectSummary[] = [
  { key: "DEMO", name: "Checkout Review", updated_at: "2026-05-21" }
];

const demoUsecases: UsecaseSummary[] = [
  {
    key: "DEMO-001",
    level: "USER_GOAL",
    primary_actor: "Customer",
    status: "DRAFT",
    title: "Places an order"
  }
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
  if (process.env.VSPEC_AUTH_STUB === "1") {
    return demoProjects;
  }

  return readApi<ProjectSummary[]>("/v1/projects");
}

export async function fetchProjectUsecases(projectKey: string): Promise<UsecaseSummary[]> {
  if (process.env.VSPEC_AUTH_STUB === "1") {
    return demoUsecases.map((item) => ({ ...item, key: `${projectKey}-001` }));
  }

  return readApi<UsecaseSummary[]>(`/v1/projects/${projectKey}/usecases`);
}

export async function fetchUsecaseDetail(_projectKey: string, ucKey: string): Promise<UsecaseDetail> {
  if (process.env.VSPEC_AUTH_STUB === "1") {
    return {
      ...demoDetail,
      title: ucKey === "DEMO-001" ? demoDetail.title : `${ucKey} spec`
    };
  }

  return readApi<UsecaseDetail>(`/v1/usecases/${ucKey}?format=agent`);
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

function apiUrl(): string {
  return process.env.VSPEC_API_URL ?? "http://127.0.0.1:3000";
}
