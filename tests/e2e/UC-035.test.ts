import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  commitChange,
  expirePreview,
  historyRevisionIds,
  proposeChange,
  type ChangePreviewResponse,
  type ChangeProblem
} from "../helpers/change-fixtures.js";
import { advanceMain, projectUseCase } from "../helpers/merge-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-035 - Propose a spec change (AI agent)", () => {
  test("MAIN: propose a title change preview without writing a revision", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Change Preview", "change-preview", "stub-change-preview");

    const response = await proposeChange(server, setup.cookie, {
      base_revision: usecase.current_revision_id,
      patch: {
        entity_id: usecase.id,
        entity_type: "USECASE",
        fields: { title: "Reviews a refund with audit trail" }
      },
      usecase_key: usecase.key
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ChangePreviewResponse;
    expect(body.preview_id).toEqual(expect.any(String));
    expect(body.severity).toBe("NON_BREAKING");
    expect(body.impact).toMatchObject({ affected_sessions: [], severity: "NON_BREAKING" });
    expect(Date.parse(body.expires_at)).toBeGreaterThan(Date.now());
    expect(Date.parse(body.expires_at)).toBeLessThanOrEqual(Date.now() + 16 * 60_000);
    expect(body.diff).toEqual([
      {
        after: "Reviews a refund with audit trail",
        before: "Reviews a refund",
        entity_id: usecase.id,
        entity_type: "USECASE",
        path: "title",
        severity: "NON_BREAKING"
      }
    ]);
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec change commit --preview-id ${body.preview_id}`,
      reason: "Commit the preview after human review."
    });
    expect(body.warnings).toEqual([]);
    expect(await historyRevisionIds(server, usecase.id, setup.cookie)).toEqual([
      usecase.current_revision_id
    ]);
  });

  test("4a: stale base revision returns current revision and no preview", async () => {
    const { setup, usecase } =
      await projectUseCase(server, "Stale Preview", "stale-preview", "stub-stale-preview");
    const current = await advanceMain(server, setup, usecase.id, "Reviews a refund manually");

    const response = await proposeChange(server, setup.cookie, {
      base_revision: usecase.current_revision_id,
      patch: {
        entity_id: usecase.id,
        entity_type: "USECASE",
        fields: { title: "Reviews a refund with audit trail" }
      },
      usecase_key: usecase.key
    });

    expect(response.status).toBe(409);
    const problem = (await response.json()) as ChangeProblem;
    expect(problem.title).toMatch(/stale base revision/i);
    expect(problem.current_revision).toBe(current.revision_id);
    expect(problem.impact).toMatchObject({ affected_sessions: [], severity: "BREAKING" });
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
    const { setup, usecase } =
      await projectUseCase(server, "Missing Preview", "missing-preview", "stub-missing-preview");

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
    const { setup, usecase } =
      await projectUseCase(server, "Expired Preview", "expired-preview", "stub-expired-preview");
    const previewResponse = await proposeChange(server, setup.cookie, {
      base_revision: usecase.current_revision_id,
      patch: {
        entity_id: usecase.id,
        entity_type: "USECASE",
        fields: { title: "Reviews an expired preview" }
      },
      usecase_key: usecase.key
    });
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
});
