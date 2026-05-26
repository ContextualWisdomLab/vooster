import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createProjectRequest,
  deleteProjectRequest,
  fetchProjectActors,
  fetchProjectUsecases,
  fetchProjects,
  fetchUsecaseDetail,
  renameProjectRequest
} from "../../app/data";

type StubGlobal = {
  __vsepecDemoProjects?: unknown;
};

afterEach(() => {
  delete (globalThis as StubGlobal).__vsepecDemoProjects;
  vi.unstubAllEnvs();
});

describe("web data auth stub", () => {
  test("serves deterministic demo projects and use case detail", async () => {
    vi.stubEnv("VSPEC_AUTH_STUB", "1");

    await expect(fetchProjects()).resolves.toMatchObject([
      { key: "DEMO", name: "Checkout Review" }
    ]);
    await expect(fetchProjectUsecases("OPS")).resolves.toMatchObject([
      { key: "OPS-001", title: "Places an order" }
    ]);
    await expect(fetchUsecaseDetail("OPS", "OPS-001")).resolves.toMatchObject({
      title: "OPS-001 spec",
      primary_actor: { name: "Customer" }
    });
    await expect(fetchProjectActors("OPS")).resolves.toMatchObject([
      { name: "Customer", type: "PRIMARY" }
    ]);
  });

  test("creates, rejects duplicates, renames, and deletes stub projects", async () => {
    vi.stubEnv("VSPEC_AUTH_STUB", "1");

    const created = await createProjectRequest({
      key: "PAY",
      name: "Payments",
      visibility: "INTERNAL"
    });
    expect(created).toMatchObject({
      ok: true,
      project: { key: "PAY", name: "Payments", visibility: "INTERNAL" }
    });

    await expect(
      createProjectRequest({ key: "PAY", name: "Duplicate" })
    ).resolves.toEqual({
      ok: false,
      error: "Project key PAY is already in use."
    });

    if (!created.ok) {
      throw new Error("expected project creation to succeed");
    }
    await expect(renameProjectRequest(created.project.id, "Billing")).resolves.toEqual({
      ok: true,
      project: { ...created.project, name: "Billing" }
    });
    await expect(deleteProjectRequest(created.project.id)).resolves.toEqual({
      ok: true
    });
    await expect(renameProjectRequest(created.project.id, "Missing")).resolves.toEqual({
      ok: false,
      error: "Project not found."
    });
  });
});
