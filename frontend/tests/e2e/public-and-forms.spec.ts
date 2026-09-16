import { expect, test } from "@playwright/test";

test.describe("public product surfaces", () => {
  test("landing page presents product navigation and no runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("link", { name: "B Bookable" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /bookable/i }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("auth pages expose the intended forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /start with a workspace/i })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});

test.describe("unauthenticated route guards", () => {
  for (const path of ["/dashboard", "/organizations/demo", "/organizations/demo/bookables", "/organizations/demo/bookables/new", "/organizations/demo/bookables/demo/availability"]) {
    test(`${path} does not expose protected content anonymously`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login|\/dashboard/);
    });
  }
});
