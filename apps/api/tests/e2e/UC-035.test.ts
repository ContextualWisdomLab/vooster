import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  commitChange,
  expectTitleDiff,
  expirePreview,
  historyRevisionIds,
  proposeChange,
  titlePatch,
  type ChangeCommitResponse,
  type ChangePreviewResponse,
  type ChangeProblem
} from "../helpers/change-fixtures.js";
import { lockUseCase } from "../helpers/lock-fixtures.js";
import { advanceMain, projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  startWorkSession,
  type SessionStartResponse
} from "../helpers/session-fixtures.js";
let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
});
describe("UC-035 - Propose a spec change (AI agent)", () => {
  test("MAIN: propose a title change preview without writing a revision", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Change Preview",
      "change-preview",
      "stub-change-preview"
    );

    const response = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a refund with audit trail")
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as ChangePreviewResponse;
    expect(body.preview_id).toEqual(expect.any(String));
    expect(body.severity).toBe("NON_BREAKING");
    expect(body.impact).toMatchObject({
      affected_sessions: [],
      severity: "NON_BREAKING"
    });
    expect(Date.parse(body.expires_at)).toBeGreaterThan(Date.now());
    expect(Date.parse(body.expires_at)).toBeLessThanOrEqual(Date.now() + 16 * 60_000);
    expectTitleDiff(body, usecase, "Reviews a refund with audit trail");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec change commit --preview-id ${body.preview_id}`,
      reason: "Commit the preview after human review."
    });
    expect(body.warnings).toEqual([]);
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });
  test("MAIN: commit a valid preview appends a revision", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Commit Preview",
      "commit-preview",
      "stub-commit-preview"
    );
    const previewResponse = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a committed preview")
    );
    const preview = (await previewResponse.json()) as ChangePreviewResponse;

    const response = await commitChange(server, setup.cookie, {
      confirmed: true,
      preview_id: preview.preview_id
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as ChangeCommitResponse;
    expect(body.revisions).toHaveLength(1);
    expect(body.revisions[0]?.entity_id).toBe(usecase.id);
    expect(typeof body.revisions[0]?.revision_id).toBe("string");
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      body.revisions[0]?.revision_id,
      usecase.current_revision_id
    ]);
  });
  test("4a: stale base revision returns current revision and no preview", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Stale Preview",
      "stale-preview",
      "stub-stale-preview"
    );
    const current = await advanceMain(
      server,
      setup,
      usecase.id,
      "Reviews a refund manually"
    );

    const response = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a refund with audit trail")
    );

    expect(response.status).toBe(409);
    const problem = (await response.json()) as ChangeProblem;
    expect(problem.title).toMatch(/stale base revision/i);
    expect(problem.current_revision).toBe(current.revision_id);
    expect(problem.impact).toMatchObject({
      affected_sessions: [],
      severity: "BREAKING"
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key} --format=agent`,
      reason: "Re-read the current use case before proposing again."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec change propose ${usecase.key}`,
      reason: "Propose the change again against the fresh base revision."
    });
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      current.revision_id,
      usecase.current_revision_id
    ]);
  });
  test("7a: commit with unknown preview id is rejected", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Missing Preview",
      "missing-preview",
      "stub-missing-preview"
    );

    const response = await commitChange(server, setup.cookie, {
      confirmed: true,
      preview_id: "preview-missing"
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as ChangeProblem;
    expect(problem.title).toMatch(/still-valid preview/i);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec change propose",
      reason: "Generate a preview before committing a spec change."
    });
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });
  test("*a: commit with expired preview is rejected", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Expired Preview",
      "expired-preview",
      "stub-expired-preview"
    );
    const previewResponse = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews an expired preview")
    );
    const preview = (await previewResponse.json()) as ChangePreviewResponse;
    await expirePreview(server, preview.preview_id);

    const response = await commitChange(server, setup.cookie, {
      confirmed: true,
      preview_id: preview.preview_id
    });

    expect(response.status).toBe(410);
    const problem = (await response.json()) as ChangeProblem;
    expect(problem.title).toMatch(/preview expired/i);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec change propose",
      reason: "Regenerate the preview before committing."
    });
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });
  test("7b: auto-commit non-cosmetic change returns preview with warning", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Auto Commit",
      "auto-commit",
      "stub-auto-commit"
    );

    const response = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a refund with reviewer approval", {
        auto_commit: true
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as ChangePreviewResponse;
    expect(body.severity).toBe("NON_BREAKING");
    expect(body.warnings).toContainEqual({
      message: "NON_BREAKING changes require explicit human commit.",
      type: "AUTO_COMMIT_REFUSED"
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec change commit --preview-id ${body.preview_id}`,
      reason: "Commit the preview after human review."
    });
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });
  test("6a: preview lists active sessions pinning touched revisions", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Affected Sessions",
      "affected-sessions",
      "stub-affected"
    );
    const started = await startWorkSession(server, setup, {
      agent_type: "CODEX",
      intent: "Implement affected flow",
      pins: [usecase.key]
    });
    const session = ((await started.json()) as SessionStartResponse).session;
    const response = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a refund with affected sessions")
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as ChangePreviewResponse;
    expect(body.impact.affected_sessions).toContainEqual({
      agent_type: "CODEX",
      id: session.id,
      owner: setup.userId,
      pinned_usecase_keys: [usecase.key]
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Coordinate with active sessions before committing."
    });
  });
  test("2a: hard lock held by another session blocks propose", async () => {
    const { setup, usecase } = await projectUseCase(
      server,
      "Hard Locked",
      "hard-locked",
      "stub-hard-locked"
    );
    await lockUseCase(
      server,
      setup,
      usecase.id,
      {
        lock_type: "HARD",
        reason: "Another session is rewriting this use case."
      },
      "session-hard-lock-holder"
    );

    const response = await proposeChange(
      server,
      setup.cookie,
      titlePatch(usecase, "Reviews a refund while locked")
    );

    expect(response.status).toBe(409);
    const problem = (await response.json()) as ChangeProblem;
    expect(problem.title).toMatch(/hard lock/i);
    expect(problem.holding_session).toBe("session-hard-lock-holder");
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec who ${usecase.key}`,
      reason: "Inspect the session holding the lock."
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec unlock ${usecase.key}`,
      reason: "Owners can release the lock when appropriate."
    });
  });
});
