import { expect, test } from "@playwright/test";

test("home page lists projects in auth stub mode", async ({ page }) => {
  expect("VSPEC_AUTH_STUB").toBe("VSPEC_AUTH_STUB");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Project specs" })).toBeVisible();
  await expect(
    page.locator("ul.list").getByRole("link", { name: "Checkout Review" })
  ).toBeVisible();
});

test("login page links to the API GitHub flow", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
    "href",
    "/v1/auth/github/start"
  );
});

test("project detail lists use cases", async ({ page }) => {
  await page.goto("/projects/DEMO");
  await expect(page.getByRole("link", { name: "Places an order" })).toBeVisible();
});

test("use case detail renders Cockburn fields", async ({ page }) => {
  await page.goto("/projects/DEMO/usecases/DEMO-001");
  await expect(page.getByRole("heading", { name: "Places an order" })).toBeVisible();
  await expect(page.getByText("primary_actor")).toBeVisible();
  await expect(page.getByText("main_scenario")).toBeVisible();
  await expect(page.getByText("stakeholder_interests")).toBeVisible();
});
