import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createUseCaseWithMainStep
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createPinnedSession,
  patchStep,
  type StepPatchResponse,
  type StepProblemResponse
} from "../helpers/step-fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-013 - Edit a use case step", () => {
  test("MAIN: edit step action and append breaking revision", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Edit Step",
        "edit-step",
        "stub-edit-step"
      );

    const response = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: mainStepRevision.id
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as StepPatchResponse;
    expect(body.step).toMatchObject({
      action: "Reviews the order.",
      id: mainStep.id,
      scenario_id: mainStep.scenario_id,
      step_number: 1
    });
    expect(body.revision).toMatchObject({
      change_summary: `Edited step ${mainStep.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "BREAKING",
      version_number: 5
    });
    expect(body.affected_sessions).toEqual([]);
  });

  test("2a: stale base revision returns current revision and leaves step unchanged", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Stale Step",
        "stale-step",
        "stub-stale-step"
      );

    const stale = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: usecase.current_revision_id
    });

    expect(stale.status).toBe(409);
    const problem = (await stale.json()) as StepProblemResponse;
    expect(problem.title).toMatch(/base revision is stale/i);
    expect(problem.current_revision_id).toBe(mainStepRevision.id);
    expect(problem.revision_diff).toEqual({
      base_revision: usecase.current_revision_id,
      current_revision: mainStepRevision.id
    });
    expect(problem.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.key}`,
      reason: "Inspect the current use case before retrying the step edit."
    });

    const valid = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: mainStepRevision.id
    });
    const body = (await valid.json()) as StepPatchResponse;
    expect(body.step.action).toBe("Reviews the order.");
    expect(body.revision.version_number).toBe(5);
  });

  test("3a: invalid action edits require correction or force", async () => {
    const { mainStep, mainStepRevision, setup } = await createUseCaseWithMainStep(
      server,
      "Invalid Step Edit",
      "invalid-step-edit",
      "stub-invalid-step-edit"
    );

    const empty = await patchStep(server, mainStep.id, setup.cookie, {
      action: "",
      base_revision: mainStepRevision.id
    });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as StepProblemResponse).title).toMatch(/step action is required/i);

    const passive = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Order is processed.",
      base_revision: mainStepRevision.id
    });
    expect(passive.status).toBe(422);
    const problem = (await passive.json()) as StepProblemResponse;
    expect(problem.title).toMatch(/passive voice/i);
    expect(problem.suggested_action).toBe("Processed the order.");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec step edit --force",
      reason: "Persist this wording after reviewing the passive voice warning."
    });

    const forced = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Order is processed.",
      base_revision: mainStepRevision.id,
      force: true
    });
    const body = (await forced.json()) as StepPatchResponse;
    expect(body.step.action).toBe("Order is processed.");
    expect(body.revision).toMatchObject({
      severity: "BREAKING",
      version_number: 5
    });
  });

  test("5a: semantic lock allows notes but blocks semantic edits", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Semantic Lock",
        "semantic-lock",
        "stub-semantic-lock"
      );
    const expiresAt = "2026-06-01T00:00:00.000Z";
    const locked = await server.fetch(`/__test/usecases/${usecase.id}/locks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        expires_at: expiresAt,
        holder: "agent-session-1",
        mode: "SEMANTIC",
        reason: "Agent is editing implementation."
      })
    });
    expect(locked.status).toBe(201);

    const notes = await patchStep(server, mainStep.id, setup.cookie, {
      base_revision: mainStepRevision.id,
      notes: "Clarifies the checkout wording."
    });
    const notesBody = (await notes.json()) as StepPatchResponse;
    expect(notesBody.step.notes).toBe("Clarifies the checkout wording.");
    expect(notesBody.revision).toMatchObject({ severity: "COSMETIC", version_number: 5 });

    const semantic = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: notesBody.revision.id
    });
    expect(semantic.status).toBe(409);
    const problem = (await semantic.json()) as StepProblemResponse;
    expect(problem.title).toMatch(/semantic lock/i);
    expect(problem.lock_holder).toBe("agent-session-1");
    expect(problem.lock_reason).toBe("Agent is editing implementation.");
    expect(problem.expires_at).toBe(expiresAt);
  });

  test("6a: active sessions pinning the use case are affected", async () => {
    const { mainStep, mainStepRevision, setup, usecase } =
      await createUseCaseWithMainStep(
        server,
        "Pinned Session",
        "pinned-session",
        "stub-pinned-session"
      );
    const session = await createPinnedSession(server, usecase.id, setup.cookie, {
      id: "agent-session-2",
      pinned_revision_id: mainStepRevision.id
    });
    expect(session.status).toBe(201);

    const edited = await patchStep(server, mainStep.id, setup.cookie, {
      action: "Reviews the order.",
      base_revision: mainStepRevision.id
    });
    const body = (await edited.json()) as StepPatchResponse;
    expect(body.affected_sessions).toEqual(["agent-session-2"]);
  });
});
