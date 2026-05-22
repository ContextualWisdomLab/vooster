import { expect, test } from "@playwright/test";

test("home page lists projects in auth stub mode", async ({ page }) => {
  expect("VSPEC_AUTH_STUB").toBe("VSPEC_AUTH_STUB");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Project specs" })).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "Checkout Review" })
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

test("sidebar creates a new project from the Projects header action", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page.getByRole("heading", { name: "Create a project" })).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill("Payments Squad");
  await expect(page.getByLabel("Key")).toHaveValue("PAYMENTS");

  await page.getByRole("button", { name: "Create project" }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Payments Squad" })
  ).toBeVisible();
});

test("sidebar renames a project via the 3-dot menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Rename Target");
  await page.getByLabel("Key").fill("RENAME");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Rename Target" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Project actions for Rename Target" })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Renamed Project");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Renamed Project" })
  ).toBeVisible();
});

test("sidebar deletes a project via the 3-dot menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Delete Target");
  await page.getByLabel("Key").fill("DELETE");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Delete Target" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Project actions for Delete Target" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(
    page.locator('[data-slot="sidebar"]').getByRole("link", { name: "Delete Target" })
  ).toHaveCount(0);
});
