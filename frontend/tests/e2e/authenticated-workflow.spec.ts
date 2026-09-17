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

  await page.getByRole("button", { name: /^Create workspace$/i }).first().click();
  await page.getByLabel("Workspace name").fill(organizationName);
  await page.getByLabel("Local timezone").selectOption("Africa/Lagos");
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Workspace name") })
    .getByRole("button", { name: "Create workspace" })
    .click();
  await expect(page).toHaveURL(/\/organizations\//);

  await page.getByRole("link", { name: /^View all$/i }).click();
  await page
    .locator("button")
    .filter({ hasText: /^Create Bookable$/i })
    .first()
    .click();
  await page.getByLabel("Name").fill(bookableName);
  await expect(page.getByLabel("Reservation length")).toBeVisible();
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
  await page.getByRole("link", { name: /manage availability/i }).click();
  await expect(
    page.getByText("Workspace timezone", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle Monday" })).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveCount(2);
  await expect(page.getByLabel("Duration")).toBeVisible();
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
  await expect(page.getByText("Africa/Lagos")).toBeVisible();
});

test("availability supports multi-day selection and apply-to-selected-days flow", async ({
  page,
}) => {
  const email = `playwright-availability-${Date.now()}@example.test`;
  const organizationName = `Availability Workspace ${Date.now()}`;
  const bookableName = "Availability Test Room";

  await page.goto("/register");
  await page.getByLabel("Name").fill("Availability Operator");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: /^Create workspace$/i }).first().click();
  await page.getByLabel("Workspace name").fill(organizationName);
  await page.getByLabel("Local timezone").selectOption("UTC");
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Workspace name") })
    .getByRole("button", { name: "Create workspace" })
    .click();
  await expect(page).toHaveURL(/\/organizations\//);

  await page.getByRole("link", { name: /^View all$/i }).click();
  await page
    .locator("button")
    .filter({ hasText: /^Create Bookable$/i })
    .first()
    .click();
  await page.getByLabel("Name").fill(bookableName);
  await page.getByLabel("Description").fill("A room used for multi-day availability checks.");
  await page.getByLabel("Capacity").fill("4");
  await page.getByRole("button", { name: "Create bookable" }).click();
  await expect(page).toHaveURL(/\/bookables\/[^/]+$/);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/organizations\/[^/]+\/bookables$/);

  await page.getByRole("link", { name: bookableName }).click();
  await page.getByRole("link", { name: /manage availability/i }).click();

  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri"]) {
    const dayButton = page.getByRole("button", { name: `Toggle ${day}` });
    if ((await dayButton.getAttribute("aria-pressed")) !== "true") {
      await dayButton.click();
    }
  }
  const recurringForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Apply to selected days" }),
  });
  await recurringForm.getByLabel("Start").fill("09:00");
  await recurringForm.getByLabel("End").fill("17:00");
  await page.getByRole("button", { name: "Apply to selected days" }).click();

  await expect(
    page.getByRole("button", { name: /Remove .*availability/ }),
  ).toHaveCount(5);
  await expect(page.getByText("Mon").first()).toBeVisible();
  await expect(page.getByText("Fri").first()).toBeVisible();
});
