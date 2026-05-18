import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import {
  createActor,
  createProject,
  createStakeholder,
  createUseCase,
  type Stakeholder
} from "../helpers/uc-fixtures.js";

type StakeholderInterest = {
  id: string;
  interest: string;
  protection_mechanism: string;
  stakeholder_id: string;
  usecase_id: string;
};
type InterestResponse = {
  next_missing_role_hint: string;
  revision: {
    change_summary: string;
    entity_id: string;
    entity_type: string;
    severity: string;
    version_number: number;
  };
  stakeholder_interest: StakeholderInterest;
  stakeholder_interests: Array<{
    interest: StakeholderInterest;
    stakeholder: Stakeholder;
  }>;
};

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
});

afterAll(async () => {
  await server.stop();
});

describe("UC-010 - Define stakeholder interests", () => {
  test("MAIN: add stakeholder interest and append use case revision", async () => {
    const setup = await createProject(server, "Interest Project", "interest-project", "stub-interest-project");
    await createActor(server, setup, "Customer");
    const usecase = await createUseCase(server, setup, "Customer", "Places an order");
    const stakeholder = await createStakeholder(server, setup, "Product Manager");

    const response = await server.fetch(`/v1/usecases/${usecase.id}/stakeholder-interests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: setup.cookie },
      body: JSON.stringify({
        interest: "Checkout revenue is protected.",
        protection_mechanism: "Success guarantee",
        stakeholder: "Product Manager"
      })
    });

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
});
