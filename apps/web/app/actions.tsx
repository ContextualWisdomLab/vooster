"use server";

import {
  createProjectRequest,
  deleteProjectRequest,
  renameProjectRequest,
  type CreateProjectInput,
  type ProjectSummary
} from "./data";

export type ActionState<T> = { ok: true; value: T } | { ok: false; error: string };

export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionState<ProjectSummary>> {
  const result = await createProjectRequest(input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.project };
}

export async function renameProjectAction(
  projectId: string,
  name: string
): Promise<ActionState<ProjectSummary>> {
  const result = await renameProjectRequest(projectId, name);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, value: result.project };
}

export async function deleteProjectAction(
  projectId: string
): Promise<ActionState<null>> {
  const result = await deleteProjectRequest(projectId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, value: null };
}
