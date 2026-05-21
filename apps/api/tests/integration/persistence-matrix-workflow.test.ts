import { afterEach, describe, expect, test } from "vitest";

import {
  addComment,
  addStakeholderInterest,
  addStakeholderInterestResponse,
  bootServer,
  createActor,
  createBranch,
  createBranchResponse,
  createMainScenario,
  createProject,
  createStakeholder,
  createStep,
  createTestDatabaseRegistry,
  createUseCase,
  listComments,
  listRevisionHistory,
  login,
  openFailedMerge,
  signupWorkspace
} from "./persistence-matrix-helpers.js";

const registry = createTestDatabaseRegistry();

describe("Goal 2 persistence matrix — workflow cluster", () => {
  afterEach(async () => {
    await registry.teardownAll();
  });

  test("Comment survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "comment-owner");
    const project = await createProject(first.url, signup, "Comment Matrix", "CMT");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a commented workflow",
      "Customer"
    );
    const comment = await addComment(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Persist this review note"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "comment-owner");
    const listed = await listComments(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      comments?: Array<{ body?: unknown; id?: unknown }>;
    };
    expect(listedBody.comments ?? []).toContainEqual(
      expect.objectContaining({
        body: "Persist this review note",
        id: comment.id
      })
    );
  }, 90_000);

  test("MergeRequest survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "merge-owner");
    const project = await createProject(first.url, signup, "Merge Matrix", "MERGE");
    const source = await createBranch(
      first.url,
      signup.sessionCookie,
      project.id,
      "feature/open-merge"
    );
    const merge = await openFailedMerge(first.url, signup.sessionCookie, source.id);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "merge-owner");
    const warned = await createBranchResponse(
      second.url,
      loggedIn.sessionCookie,
      project.id,
      "feature/next"
    );

    await second.stop();

    expect(warned.status).toBe(201);
    const warnedBody = (await warned.json()) as {
      warnings?: Array<{ merge_request_id?: unknown; type?: unknown }>;
    };
    expect(warnedBody.warnings ?? []).toContainEqual({
      merge_request_id: merge.id,
      type: "IN_FLIGHT_MERGE_REQUEST"
    });
  }, 90_000);

  test("StakeholderInterest survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "stakeholder-interest-owner");
    const project = await createProject(
      first.url,
      signup,
      "Stakeholder Interest Matrix",
      "SIM"
    );
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a protected workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "stakeholder-interest-owner");
    const duplicate = await addStakeholderInterestResponse(
      second.url,
      loggedIn.sessionCookie,
      usecase.id,
      "Operations"
    );

    await second.stop();

    expect(duplicate.status).toBe(409);
    const duplicateBody = (await duplicate.json()) as {
      existing_interest?: unknown;
      title?: unknown;
    };
    expect(duplicateBody.existing_interest).toBe("Scenario outcome remains auditable");
    expect(duplicateBody.title).toEqual(
      expect.stringMatching(/stakeholder interest.*already exists/i)
    );
  }, 90_000);

  test("Revision survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "revision-owner");
    const project = await createProject(first.url, signup, "Revision Matrix", "REV");
    await createActor(first.url, signup.sessionCookie, project.id, "Customer");
    await createStakeholder(first.url, signup.sessionCookie, project.id, "Operations");
    const usecase = await createUseCase(
      first.url,
      signup.sessionCookie,
      project.id,
      "Reviews a revised workflow",
      "Customer"
    );
    await addStakeholderInterest(
      first.url,
      signup.sessionCookie,
      usecase.id,
      "Operations"
    );
    const scenario = await createMainScenario(first.url, signup.sessionCookie, usecase.id);
    await createStep(
      first.url,
      signup.sessionCookie,
      scenario.id,
      "Customer",
      "Submit the support request."
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "revision-owner");
    const history = await listRevisionHistory(second.url, loggedIn.sessionCookie, usecase.id);

    await second.stop();

    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as {
      revisions?: Array<{
        change_summary?: unknown;
        entity_id?: unknown;
        entity_type?: unknown;
        version_number?: unknown;
      }>;
    };
    expect(historyBody.revisions ?? []).toContainEqual(
      expect.objectContaining({
        change_summary: "Added step 1 to main success scenario",
        entity_id: usecase.id,
        entity_type: "USECASE",
        version_number: 4
      })
    );
  }, 90_000);
});
