import { randomUUID } from "node:crypto";
import type { SignupState, StoredSpecBranch, StoredWorkSession } from "./signup-types.js";

export function createAutoBranch(
  state: SignupState,
  projectId: string,
  requestedName: string,
  session: StoredWorkSession
): StoredSpecBranch | undefined {
  const project = state.projectsById.get(projectId);
  const name = uniqueBranchName(state, projectId, requestedName);
  if (project === undefined || name === undefined) {
    return undefined;
  }
  const branch = {
    id: randomUUID(),
    project_id: projectId,
    name,
    owner_type: "AGENT" as const,
    owner_id: session.id,
    base_branch_id: project.default_branch_id
  };
  state.branchesById.set(branch.id, branch);
  return branch;
}

function uniqueBranchName(
  state: SignupState,
  projectId: string,
  requestedName: string
): string | undefined {
  const existing = new Set(
    [...state.branchesById.values()]
      .filter((branch) => branch.project_id === projectId)
      .map((branch) => branch.name)
  );
  if (!existing.has(requestedName)) {
    return requestedName;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = `${requestedName}-${randomUUID().replaceAll("-", "").slice(0, 6)}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
