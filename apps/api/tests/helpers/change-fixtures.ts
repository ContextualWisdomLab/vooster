import type { TestServer } from "./server.js";
import type { UseCase } from "./uc-fixtures.js";
import { expect } from "vitest";

export type ChangePreviewResponse = {
  diff: Array<{
    after: string;
    before: string;
    entity_id: string;
    entity_type: string;
    path: string;
    severity: string;
  }>;
  expires_at: string;
  impact: { affected_sessions: unknown[]; severity: string };
  preview_id: string;
  severity: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  warnings: unknown[];
};
export type ChangeProblem = {
  current_revision?: string;
  holding_session?: string;
  impact?: { affected_sessions: unknown[]; severity: string };
  suggested_next_actions: Array<{ command: string; reason: string }>;
  title: string;
};
export type ChangeCommitResponse = {
  revisions: Array<{ entity_id: string; revision_id: string }>;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type HistoryResponse = { revisions: Array<{ revision: string }> };

export function proposeChange(server: TestServer, cookie: string, body: Record<string, unknown>) {
  return server.fetch("/v1/changes/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

export function commitChange(server: TestServer, cookie: string, body: Record<string, unknown>) {
  return server.fetch("/v1/changes/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body)
  });
}

export async function expirePreview(server: TestServer, previewId: string) {
  await server.fetch(`/__test/changes/previews/${previewId}/expire`, { method: "POST" });
}

export async function historyRevisionIds(server: TestServer, usecaseId: string, cookie: string) {
  const history = await server.fetch(`/v1/usecases/${usecaseId}/revisions`, {
    headers: { Cookie: cookie }
  });
  const body = (await history.json()) as HistoryResponse;
  return body.revisions.map((revision) => revision.revision);
}

export function titlePatch(usecase: UseCase, title: string, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    base_revision: usecase.current_revision_id,
    patch: { entity_id: usecase.id, entity_type: "USECASE", fields: { title } },
    usecase_key: usecase.key
  };
}

export function expectTitleDiff(body: ChangePreviewResponse, usecase: UseCase, title: string) {
  expect(body.diff).toEqual([{
    after: title,
    before: usecase.title,
    entity_id: usecase.id,
    entity_type: "USECASE",
    path: "title",
    severity: "NON_BREAKING"
  }]);
}
