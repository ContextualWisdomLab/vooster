import { mutateApi, readApi } from "./api-client";
import {
  isAuthStub,
  stubActors,
  stubCreateProject,
  stubDeleteProject,
  stubProjects,
  stubRenameProject,
  stubUsecaseDetail,
  stubUsecases
} from "./data.stub";

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
  is_human: boolean;
};

// Mirrors the API's derived reverse view: each caller use case that invokes
// this one from a step. Internal scenario ids are dropped — the viewer only
// needs the human key, title, and the calling step number.
export type UsecaseInvokedBy = {
  key: string;
  step_number: number;
  title: string;
};

export type UsecaseDetail = {
  title: string;
  primary_actor: { name: string };
  level: string;
  status: string;
  main_scenario: {
    steps: Array<{
      action: string;
      actor: string;
      invokes?: string[];
      step_number: number;
    }>;
  };
  extensions: Array<{ condition: string; outcome: string }>;
  stakeholder_interests: Array<{ interest: string; stakeholder: string }>;
  invoked_by?: UsecaseInvokedBy[];
};

export async function fetchProjects(): Promise<ProjectSummary[]> {
  if (isAuthStub()) {
    return stubProjects();
  }

  const response = await readApi<{ items: ProjectSummary[] }>("/v1/projects");
  return response.items;
}

export async function fetchProject(
  projectKey: string
): Promise<ProjectSummary | undefined> {
  const projects = await fetchProjects();
  return projects.find(
    (project) => project.key === projectKey || project.id === projectKey
  );
}

export async function fetchProjectUsecases(
  projectKey: string
): Promise<UsecaseSummary[]> {
  if (isAuthStub()) {
    return stubUsecases(projectKey);
  }

  return readApi<UsecaseSummary[]>(`/v1/projects/${projectKey}/usecases`);
}

export async function fetchProjectActors(projectKey: string): Promise<ActorSummary[]> {
  if (isAuthStub()) {
    return stubActors(projectKey);
  }

  const response = await readApi<{ items: ActorSummary[] }>(
    `/v1/projects/${projectKey}/actors`
  );
  return response.items;
}

export async function fetchUsecaseDetail(
  projectKey: string,
  ucKey: string
): Promise<UsecaseDetail> {
  if (isAuthStub()) {
    return stubUsecaseDetail(projectKey, ucKey);
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
    return stubCreateProject(input);
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
    return stubRenameProject(projectId, name);
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
    return stubDeleteProject(projectId);
  }

  const response = await mutateApi(`/v1/projects/${projectId}`, { method: "DELETE" });
  if (!response.ok) {
    return { ok: false, error: response.error };
  }
  return { ok: true };
}
