import { randomUUID } from "node:crypto";
import type { SignupState, StoredSpecBranch, StoredWorkSession } from "./signup-types.js";
import type { BranchStore } from "../ports/branch-store.js";

export async function createAutoBranch(
  state: SignupState,
  branchStore: BranchStore,
  projectId: string,
  requestedName: string,
  session: StoredWorkSession
): Promise<StoredSpecBranch | undefined> {
  const project = state.projectsById.get(projectId);
  const name = await uniqueBranchName(branchStore, projectId, requestedName);
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
  await branchStore.saveBranch(branch);
  return branch;
}

async function uniqueBranchName(
  branchStore: BranchStore,
  projectId: string,
  requestedName: string
): Promise<string | undefined> {
  const existing = new Set(
    (await branchStore.listBranches(projectId)).map((branch) => branch.name)
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
