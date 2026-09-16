import { expect, test } from "@playwright/test";

test("authenticated workspace, generated slug, publish redirect, and availability UX", async ({
  page,
}) => {
  const email = `playwright-${Date.now()}@example.test`;
  const organizationName = `Playwright Workspace ${Date.now()}`;
  const bookableName = "Playwright Consultation Room";

  await page.goto("/register");
  await page.getByLabel("Name").fill("Playwright Operator");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: /create workspace/i }).click();
  await page.getByLabel("Workspace name").fill(organizationName);
  await page.getByLabel("Local timezone").selectOption("Africa/Lagos");
  await page
    .locator("form")
    .getByRole("button", { name: "Create workspace" })
    .click();
  await expect(page).toHaveURL(/\/organizations\//);

  await page.getByRole("link", { name: /view all/i }).click();
  await page.getByRole("link", { name: /create bookable/i }).click();
  await page.getByLabel("Name").fill(bookableName);
  await page
    .getByLabel("Description")
    .fill("A resource for browser-level workflow testing.");
  await page.getByLabel("Capacity").fill("2");
  await expect(page.getByLabel(/slug|public address/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Create bookable" }).click();
  await expect(page).toHaveURL(/\/bookables\/[^/]+$/);
  await expect(page.getByText("playwright-consultation-room")).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/organizations\/[^/]+\/bookables$/);

  await page.getByRole("link", { name: bookableName }).click();
  await page.getByRole("link", { name: /configure availability/i }).click();
  await expect(
    page.getByText("Organization timezone", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Day")).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveCount(2);
  await expect(page.getByLabel("Duration")).toBeVisible();
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
  await expect(page.getByText("Africa/Lagos")).toBeVisible();
});
