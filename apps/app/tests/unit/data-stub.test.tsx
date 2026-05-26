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
  __vspecDemoProjects?: unknown;
};

afterEach(() => {
  delete (globalThis as StubGlobal).__vspecDemoProjects;
  vi.unstubAllEnvs();
});

describe("web data auth stub", () => {
  test("serves rich, project-scoped demo data", async () => {
    vi.stubEnv("VSPEC_AUTH_STUB", "1");

    await expect(fetchProjects()).resolves.toMatchObject([
      { key: "CHECKOUT", name: "커머스 체크아웃", visibility: "PRIVATE" },
      { key: "ONBOARD", name: "팀 워크스페이스 온보딩", visibility: "INTERNAL" },
      { key: "SUPPORT", name: "고객 지원 티켓", visibility: "PRIVATE" }
    ]);

    const usecases = await fetchProjectUsecases("CHECKOUT");
    expect(usecases).toHaveLength(5);
    expect(usecases[0]).toMatchObject({
      key: "CHECKOUT-001",
      title: "장바구니 상품을 주문한다",
      level: "USER_GOAL",
      status: "IN_REVIEW",
      primary_actor: "고객",
      extension_count: 3,
      scenario_count: 4
    });

    // Projects with no seeded specs (e.g. freshly created) return nothing.
    await expect(fetchProjectUsecases("UNKNOWN")).resolves.toEqual([]);

    await expect(fetchProjectActors("CHECKOUT")).resolves.toMatchObject([
      { name: "고객", type: "PRIMARY" },
      { name: "결제 게이트웨이", type: "SUPPORTING" },
      { name: "재고 관리 시스템", type: "SUPPORTING" },
      { name: "정산 담당자", type: "OFFSTAGE" }
    ]);

    const detail = await fetchUsecaseDetail("CHECKOUT", "CHECKOUT-001");
    expect(detail).toMatchObject({
      title: "장바구니 상품을 주문한다",
      primary_actor: { name: "고객" },
      level: "USER_GOAL",
      status: "IN_REVIEW"
    });
    expect(detail.main_scenario.steps).toHaveLength(6);
    expect(detail.extensions).toHaveLength(3);
    expect(detail.stakeholder_interests.length).toBeGreaterThan(0);
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
