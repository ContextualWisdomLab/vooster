import type { TestServer } from "./server.js";
import { signup, type ProjectSetup } from "./uc-fixtures.js";

export async function createWorkspaceMember(
  server: TestServer,
  workspaceId: string,
  name: string,
  slug: string,
  code: string
): Promise<Omit<ProjectSetup, "projectId">> {
  const signedUp = await signup(server, name, slug, code);
  await server.fetch(`/__test/workspaces/${workspaceId}/members/${signedUp.userId}`, {
    method: "POST"
  });
  return signedUp;
}
