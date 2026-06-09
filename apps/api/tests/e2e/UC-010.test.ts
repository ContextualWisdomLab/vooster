import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  addInterest,
  type InterestResponse,
  type ProblemResponse,
  type RemoveInterestResponse
} from "../helpers/interest-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createActor,
  createProject,
  createStakeholder,
  createUseCase
} from "../helpers/uc-fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-010 - Define stakeholder interests", () => {
  test("MAIN: add stakeholder interest and append use case revision", async () => {
    const setup = await createProject(
      server,
      "Interest Project",
      "interest-project",
      "stub-interest-project"
    );
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    const stakeholder = await createStakeholder(server, setup, "Product Manager");

    const response = await server.fetch(
      `/v1/usecases/${usecase.id}/stakeholder-interests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: setup.cookie },
        body: JSON.stringify({
          interest: "Checkout revenue is protected.",
          protection_mechanism: "Success guarantee",
          stakeholder: "Product Manager"
        })
      }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as InterestResponse;
    expect(body.stakeholder_interest).toMatchObject({
      interest: "Checkout revenue is protected.",
      protection_mechanism: "Success guarantee",
      stakeholder_id: stakeholder.id,
      usecase_id: usecase.id
    });
    expect(body.revision).toMatchObject({
      change_summary: `Added stakeholder interest ${body.stakeholder_interest.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "NON_BREAKING",
      version_number: 2
    });
    expect(body.stakeholder_interests).toEqual([
      { interest: body.stakeholder_interest, stakeholder }
    ]);
    expect(body.next_missing_role_hint).toBe("No regulatory stakeholder yet.");
  });

  test("3a: duplicate stakeholder interest returns edit guidance", async () => {
    const setup = await createProject(
      server,
      "Duplicate Interest",
      "duplicate-interest",
      "stub-duplicate-interest"
    );
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");
    const first = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });
    expect(first.status).toBe(201);

    const duplicate = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue remains protected.",
      stakeholder: "Product Manager"
    });

    expect(duplicate.status).toBe(409);
    const body = (await duplicate.json()) as ProblemResponse;
    expect(body.title).toMatch(/stakeholder interest.*already exists/i);
    expect(body.code).toBe("STAKEHOLDER_ALREADY_ATTACHED");
    expect(body.existing_interest).toBe("Checkout revenue is protected.");
    expect(body.suggested_next_actions).toContainEqual({
      command: `vspec usecase show ${usecase.id}`,
      reason: "Review the existing stakeholder interest before changing it."
    });
  });

  test("4a: remove stakeholder interest appends breaking revision", async () => {
    const setup = await createProject(
      server,
      "Remove Interest",
      "remove-interest",
      "stub-remove-interest"
    );
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");
    const added = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });
    const interest = ((await added.json()) as InterestResponse).stakeholder_interest;

    const removed = await server.fetch(
      `/v1/usecases/${usecase.id}/stakeholder-interests/${interest.id}`,
      { method: "DELETE", headers: { Cookie: setup.cookie } }
    );

    expect(removed.status).toBe(200);
    const body = (await removed.json()) as RemoveInterestResponse;
    expect(body.removed_stakeholder_interest_id).toBe(interest.id);
    expect(body.revision).toMatchObject({
      change_summary: `Removed stakeholder interest ${interest.id}`,
      entity_id: usecase.id,
      entity_type: "USECASE",
      severity: "BREAKING",
      version_number: 3
    });
    expect(body.stakeholder_interests).toEqual([]);
  });

  test("5a: removing last interest warns and blocks status transition", async () => {
    const setup = await createProject(
      server,
      "Last Interest",
      "last-interest",
      "stub-last-interest"
    );
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");
    const added = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });
    const interest = ((await added.json()) as InterestResponse).stakeholder_interest;

    const removed = await server.fetch(
      `/v1/usecases/${usecase.id}/stakeholder-interests/${interest.id}`,
      { method: "DELETE", headers: { Cookie: setup.cookie } }
    );
    const body = (await removed.json()) as RemoveInterestResponse;
    expect(body.warnings).toContainEqual({
      type: "NO_STAKEHOLDER_INTERESTS",
      message: "Use case cannot leave DRAFT until an interest is added."
    });

    const transition = await server.fetch(`/v1/usecases/${usecase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({ status: "IN_REVIEW" })
    });
    expect(transition.status).toBe(422);
  });

  test("*a: unknown stakeholder returns candidates and preserves revisions", async () => {
    const setup = await createProject(
      server,
      "Unknown Stakeholder",
      "unknown-stakeholder",
      "stub-unknown-stakeholder"
    );
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    await createStakeholder(server, setup, "Product Manager");

    const missing = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Launch risk is protected.",
      stakeholder: "Product"
    });

    expect(missing.status).toBe(422);
    const problem = (await missing.json()) as ProblemResponse;
    expect(problem.title).toMatch(/stakeholder.*not.*resolve/i);
    expect(problem.candidate_stakeholders).toEqual(["Product Manager"]);
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec stakeholder create",
      reason: "Create the stakeholder before adding an interest."
    });

    const valid = await addInterest(server, usecase.id, setup.cookie, {
      interest: "Checkout revenue is protected.",
      stakeholder: "Product Manager"
    });
    const body = (await valid.json()) as InterestResponse;
    expect(body.revision.version_number).toBe(2);
    expect(body.stakeholder_interests).toHaveLength(1);
  });
});
