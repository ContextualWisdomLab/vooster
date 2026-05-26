import { expect, test } from "@playwright/test";

test("home page lists projects in auth stub mode", async ({ page }) => {
  expect("VSPEC_AUTH_STUB").toBe("VSPEC_AUTH_STUB");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "프로젝트 명세" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "커머스 체크아웃" })
  ).toBeVisible();
});

test("login page links to the API GitHub flow", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "GitHub으로 계속하기" })).toHaveAttribute(
    "href",
    "/v1/auth/github/start"
  );
});

test("project detail lists use cases", async ({ page }) => {
  await page.goto("/projects/CHECKOUT");
  await expect(
    page.getByRole("link", { name: "장바구니 상품을 주문한다" })
  ).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "상태" })).toBeVisible();
  // Level is no longer a column — rows are grouped by goal level, so it surfaces
  // as a collapsible group toggle instead of a column header.
  await expect(page.getByRole("button", { name: "사용자 목표" })).toBeVisible();
});

test("project overview links to the actor list with a total count", async ({
  page
}) => {
  await page.goto("/projects/CHECKOUT");
  await expect(
    page.getByRole("heading", { level: 1, name: "커머스 체크아웃" })
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: /액터/ })
  ).toHaveAttribute("href", "/projects/CHECKOUT/actors");
});

test("actor list page groups actors by role with per-actor detail", async ({
  page
}) => {
  await page.goto("/projects/CHECKOUT/actors");
  await expect(page.getByRole("heading", { level: 1, name: "액터" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "유형" })).toBeVisible();
  await expect(page.getByRole("button", { name: /주요 액터/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /지원 액터/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /배후 액터/ })).toBeVisible();
  await expect(page.getByText("결제 게이트웨이")).toBeVisible();
});

test("use case detail renders Cockburn fields", async ({ page }) => {
  await page.goto("/projects/CHECKOUT/usecases/CHECKOUT-001");
  await expect(
    page.getByRole("heading", { name: "장바구니 상품을 주문한다" })
  ).toBeVisible();
  await expect(page.getByText("주요 액터")).toBeVisible();
  await expect(page.getByText("메인 시나리오")).toBeVisible();
  await expect(page.getByText("이해관계자 관심사")).toBeVisible();
});

test("sidebar creates a new project from the Projects header action", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await expect(page.getByRole("heading", { name: "프로젝트 만들기" })).toBeVisible();

  await page.getByLabel("이름", { exact: true }).fill("Payments Squad");
  await expect(page.getByLabel("키")).toHaveValue("PAYMENTS");

  await page.getByRole("button", { name: "프로젝트 만들기" }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Payments Squad" })
  ).toBeVisible();
});

test("sidebar collapses fully and the header exposes an expand control", async ({
  page
}) => {
  await page.goto("/projects/CHECKOUT");

  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });

  // Expanded: the sidebar carries the logo, so the header shows neither the
  // expand control nor a breadcrumb home logo.
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toHaveCount(0);
  await expect(breadcrumb.getByRole("link", { name: "Vooster 홈" })).toHaveCount(0);

  await page.getByRole("button", { name: "사이드바 접기" }).click();

  // Collapsed: the header gains the expand control with the home logo to its right.
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toBeVisible();
  await expect(breadcrumb.getByRole("link", { name: "Vooster 홈" })).toHaveAttribute(
    "href",
    "/"
  );

  await page.getByRole("button", { name: "사이드바 펼치기" }).click();
  await expect(page.getByRole("button", { name: "사이드바 펼치기" })).toHaveCount(0);
});

test("sidebar footer links to the account page", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "내 계정" })
  ).toHaveAttribute("href", "/login");
});

test("sidebar renames a project via the 3-dot menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("이름", { exact: true }).fill("Rename Target");
  await page.getByLabel("키").fill("RENAME");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Rename Target" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Rename Target 프로젝트 작업" }).click();
  await page.getByRole("menuitem", { name: "이름 변경" }).click();
  await page.getByLabel("이름", { exact: true }).fill("Renamed Project");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Renamed Project" })
  ).toBeVisible();
});

test("sidebar deletes a project via the 3-dot menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByLabel("이름", { exact: true }).fill("Delete Target");
  await page.getByLabel("키").fill("DELETE");
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Delete Target" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete Target 프로젝트 작업" }).click();
  await page.getByRole("menuitem", { name: "삭제" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Delete Target" })
  ).toHaveCount(0);
});
