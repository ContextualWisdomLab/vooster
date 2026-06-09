import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createExtensionScenario,
  createUseCaseWithMainStep
} from "../helpers/scenario-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { createActor, createProject, createUseCase } from "../helpers/uc-fixtures.js";

type SearchResponse = {
  items: Array<{
    extension_count: number;
    archived_at?: string | null;
    key: string;
    level: string;
    primary_actor: string;
    scenario_count: number;
    status: string;
    title: string;
    trigger_excerpt: string;
  }>;
  next_cursor: null | string;
  suggested_next_actions?: Array<{ command: string; reason: string }>;
};
type SearchProblem = {
  items?: unknown[];
  title: string;
  valid_levels?: string[];
  valid_statuses?: string[];
};

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.stop();
});

describe("UC-014 - Search and filter use cases", () => {
  test("MAIN: list filtered use case previews with cursor pagination", async () => {
    const setup = await createProject(
      server,
      "Search Use Cases",
      "search-usecases",
      "stub-search"
    );
    const customer = await createActor(server, setup, "Customer");
    await createUseCase(server, setup, "Customer", "Reviews a refund");
    await createUseCase(server, setup, "Customer", "Reviews an invoice");
    await createActor(server, setup, "Admin");
    await createUseCase(server, setup, "Admin", "Reviews an admin report");
    const archived = await createUseCase(
      server,
      setup,
      "Customer",
      "Reviews an archived refund"
    );
    await archiveUseCase(archived.id, setup.cookie);

    const first = await searchUseCases(setup.cookie, setup.projectId, {
      actor_id: customer.id,
      level: "USER_GOAL",
      limit: "1",
      q: "Reviews",
      status: "DRAFT"
    });

    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as SearchResponse;
    expect(firstBody.items).toEqual([
      {
        key: "CHK-001",
        extension_count: 0,
        level: "USER_GOAL",
        primary_actor: "Customer",
        scenario_count: 0,
        status: "DRAFT",
        title: "Reviews a refund",
        trigger_excerpt: ""
      }
    ]);
    expect(firstBody.next_cursor).toEqual(expect.any(String));

    const second = await searchUseCases(setup.cookie, setup.projectId, {
      actor_id: customer.id,
      cursor: firstBody.next_cursor ?? "",
      level: "USER_GOAL",
      limit: "1",
      q: "Reviews",
      status: "DRAFT"
    });

    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as SearchResponse;
    expect(secondBody.items.map((item) => item.key)).toEqual(["CHK-002"]);
    expect(secondBody.next_cursor).toBeNull();
  });

  test("MAIN: every listed use case includes scenario and extension counts", async () => {
    const ready = await createUseCaseWithMainStep(
      server,
      "Search Counts",
      "search-counts",
      "stub-search-counts"
    );
    await createExtensionScenario(server, ready.usecase.id, ready.setup.cookie, {
      condition: "Payment fails",
      extension_point: "1a"
    });
    await createUseCase(server, ready.setup, "Customer", "Reviews empty scenarios");

    const response = await searchUseCases(
      ready.setup.cookie,
      ready.setup.projectId,
      {}
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SearchResponse;
    expect(body.items).toEqual([
      expect.objectContaining({
        extension_count: 1,
        key: "CHK-001",
        scenario_count: 2
      }),
      expect.objectContaining({
        extension_count: 0,
        key: "CHK-002",
        scenario_count: 0
      })
    ]);
  });

  test("2a: unknown enum filters are rejected with valid values", async () => {
    const setup = await createProject(
      server,
      "Search Filters",
      "search-filters",
      "stub-filter"
    );

    const response = await searchUseCases(setup.cookie, setup.projectId, {
      level: "EPIC",
      status: "READY"
    });

    expect(response.status).toBe(400);
    const problem = (await response.json()) as SearchProblem;
    expect(problem.title).toMatch(/unknown use case filter/i);
    expect(problem.valid_statuses).toEqual([
      "DRAFT",
      "IN_REVIEW",
      "APPROVED",
      "DEPRECATED"
    ]);
    expect(problem.valid_levels).toEqual(["SUMMARY", "USER_GOAL", "SUBFUNCTION"]);
    expect(problem.items).toBeUndefined();
  });

  test("2b: unresolved actor filter returns empty result with guidance", async () => {
    const setup = await createProject(
      server,
      "Search Actor",
      "search-actor",
      "stub-actor-filter"
    );

    const response = await searchUseCases(setup.cookie, setup.projectId, {
      actor_id: "actor-missing"
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SearchResponse;
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec actor list",
      reason: "Find a valid actor id for this project."
    });
  });

  test("*a: no matching use cases suggests broadening filters", async () => {
    const setup = await createProject(
      server,
      "Search Empty",
      "search-empty",
      "stub-empty"
    );

    const response = await searchUseCases(setup.cookie, setup.projectId, {
      q: "no matching use case"
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as SearchResponse;
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase list --status=DRAFT,IN_REVIEW",
      reason: "Broaden lifecycle filters and retry."
    });
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec usecase list",
      reason: "Drop the search text to browse all visible use cases."
    });
  });

  test("*b: archived use cases can be listed explicitly without changing state", async () => {
    const setup = await createProject(
      server,
      "Search Archived",
      "search-archived",
      "stub-search-archived"
    );
    await createActor(server, setup, "Customer");
    const active = await createUseCase(
      server,
      setup,
      "Customer",
      "Reviews active case"
    );
    const archived = await createUseCase(
      server,
      setup,
      "Customer",
      "Reviews archived case"
    );
    await archiveUseCase(archived.id, setup.cookie);

    const archivedOnly = await searchUseCases(setup.cookie, setup.projectId, {
      archived: "only"
    });
    const all = await searchUseCases(setup.cookie, setup.projectId, {
      archived: "all"
    });

    expect(archivedOnly.status).toBe(200);
    const archivedBody = (await archivedOnly.json()) as SearchResponse;
    expect(archivedBody.items).toHaveLength(1);
    expect(archivedBody.items[0]?.key).toBe(archived.key);
    expect(archivedBody.items[0]?.title).toBe(archived.title);
    expect(typeof archivedBody.items[0]?.archived_at).toBe("string");

    expect(all.status).toBe(200);
    const allBody = (await all.json()) as SearchResponse;
    expect(allBody.items.map((item) => item.key)).toEqual([active.key, archived.key]);
  });

  test("4a: malformed cursor fails and stale cursor returns plain empty page", async () => {
    const setup = await createProject(
      server,
      "Search Cursor",
      "search-cursor",
      "stub-cursor"
    );
    await createActor(server, setup, "Customer");
    await createUseCase(server, setup, "Customer", "Reviews a cursor");

    const malformed = await searchUseCases(setup.cookie, setup.projectId, {
      cursor: "not-a-cursor"
    });
    expect(malformed.status).toBe(400);
    const problem = (await malformed.json()) as SearchProblem;
    expect(problem.title).toBe(
      "cursor is opaque — pass exactly what the previous response returned"
    );

    const stale = await searchUseCases(setup.cookie, setup.projectId, {
      cursor: Buffer.from(JSON.stringify({ key: "ZZZ" }), "utf8").toString("base64url")
    });
    expect(stale.status).toBe(200);
    const body = (await stale.json()) as SearchResponse;
    expect(body.items).toEqual([]);
    expect(body.next_cursor).toBeNull();
    expect(body.suggested_next_actions).toBeUndefined();
  });
});

async function archiveUseCase(usecaseId: string, cookie: string) {
  await server.fetch(`/__test/usecases/${usecaseId}/archive`, {
    method: "POST",
    headers: { Cookie: cookie }
  });
}

function searchUseCases(
  cookie: string,
  projectId: string,
  query: Record<string, string>
) {
  return server.fetch(
    `/v1/projects/${projectId}/usecases?${String(new URLSearchParams(query))}`,
    {
      headers: { Cookie: cookie }
    }
  );
}
