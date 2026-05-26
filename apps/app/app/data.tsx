import {
  actorListResponseSchema,
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  projectListResponseSchema,
  projectRenameRequestSchema,
  projectRenameResponseSchema,
  usecaseAgentEnvelopeSchema,
  usecaseListResponseSchema,
  type ActorSummary as ContractActorSummary,
  type ProjectListItem,
  type UsecaseListResponse
} from "@vooster/contracts";
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

export type ProjectSummary = ProjectListItem;

type ContractUsecaseSummary = UsecaseListResponse["items"][number];

export type UsecaseSummary = ContractUsecaseSummary & {
  extension_count: number;
  scenario_count: number;
};

export type ActorSummary = Pick<
  ContractActorSummary,
  "id" | "is_human" | "name" | "type"
>;

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
  level: UsecaseSummary["level"];
  status: UsecaseSummary["status"];
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

  const response = await readApi("/v1/projects", projectListResponseSchema);
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

  const response = await readApi(
    `/v1/projects/${projectKey}/usecases`,
    usecaseListResponseSchema
  );
  return response.items;
}

export async function fetchProjectActors(projectKey: string): Promise<ActorSummary[]> {
  if (isAuthStub()) {
    return stubActors(projectKey);
  }

  const response = await readApi(
    `/v1/projects/${projectKey}/actors`,
    actorListResponseSchema
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

  const response = await readApi(
    `/v1/usecases/${ucKey}?format=agent`,
    usecaseAgentEnvelopeSchema
  );
  return usecaseDetailFromAgentData(response.data);
}

function usecaseDetailFromAgentData(
  data: ReturnType<typeof usecaseAgentEnvelopeSchema.parse>["data"]
): UsecaseDetail {
  const scenarios = data.scenarios ?? [];
  const main = scenarios.find((scenario) => scenario.type === "MAIN_SUCCESS");
  return {
    title: stringFrom(data.title ?? data.usecase.title),
    primary_actor: data.primary_actor ?? { name: "" },
    level: levelFrom(data.usecase.level),
    status: statusFrom(data.usecase.status),
    main_scenario: {
      steps: main?.steps ?? []
    },
    extensions: scenarios
      .filter((scenario) => scenario.type === "EXTENSION")
      .map((scenario) => ({
        condition: scenario.condition ?? "",
        outcome: stringFrom(scenario.outcome)
      })),
    stakeholder_interests: data.stakeholder_interests ?? [],
    invoked_by: invokedByFrom(data.invoked_by)
  };
}

function invokedByFrom(value: unknown[] | undefined): UsecaseInvokedBy[] {
  return (value ?? [])
    .filter(isInvokedBy)
    .map(({ key, step_number, title }) => ({ key, step_number, title }));
}

function isInvokedBy(value: unknown): value is UsecaseInvokedBy {
  return (
    value !== null &&
    typeof value === "object" &&
    "key" in value &&
    "step_number" in value &&
    "title" in value &&
    typeof value.key === "string" &&
    typeof value.step_number === "number" &&
    typeof value.title === "string"
  );
}

function levelFrom(value: unknown): UsecaseSummary["level"] {
  if (value === "SUMMARY" || value === "USER_GOAL" || value === "SUBFUNCTION") {
    return value;
  }
  return "USER_GOAL";
}

function statusFrom(value: unknown): UsecaseSummary["status"] {
  if (
    value === "DRAFT" ||
    value === "IN_REVIEW" ||
    value === "APPROVED" ||
    value === "DEPRECATED"
  ) {
    return value;
  }
  return "DRAFT";
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
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
    body: projectCreateRequestSchema.parse({
      name: input.name,
      key: input.key,
      visibility: input.visibility ?? "PRIVATE"
    })
  });

  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  const body = projectCreateResponseSchema.parse(response.body);
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
    body: projectRenameRequestSchema.parse({ name })
  });

  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  const body = projectRenameResponseSchema.parse(response.body);
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
