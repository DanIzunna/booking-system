import { expect, test } from "@playwright/test";

test.describe("public product surfaces", () => {
  for (const status of ["SUCCEEDED", "FAILED"] as const) {
    test(`fake checkout simulates ${status.toLowerCase()} payment`, async ({
      page,
    }) => {
      let payload: Record<string, unknown> | undefined;
      let signature = "";

      await page.route("**/api/v1/payments/webhooks/fake", async (route) => {
        payload = route.request().postDataJSON() as Record<string, unknown>;
        signature = route.request().headers()["x-fake-signature"] ?? "";
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ status, idempotent: false }),
        });
      });

      await page.goto(
        "/fake-checkout?providerReference=fake_reservation:e2e-reservation&amount=1250&currency=USD",
      );
      await expect(
        page.getByRole("heading", { name: "Fake Payment Checkout" }),
      ).toBeVisible();
      await page.getByRole("button", {
        name:
          status === "SUCCEEDED"
            ? "Simulate successful payment"
            : "Simulate failed payment",
      }).click();

      await expect(
        page.getByText(
          status === "SUCCEEDED" ? "Payment successful" : "Payment failed",
        ),
      ).toBeVisible();
      expect(payload).toEqual({
        providerReference: "fake_reservation:e2e-reservation",
        status,
        amount: 1250,
        currency: "USD",
      });
      expect(signature).toBe("phase8-test-signature");
    });
  }

  test("public booking shows a friendly missing-bookable state", async ({
    page,
  }) => {
    await page.goto("/book/missing-stage-7-bookable");
    await expect(
      page.getByRole("heading", { name: "This booking page is unavailable" }),
    ).toBeVisible();
    await expect(page.getByText(/ask the organizer/i)).toBeVisible();
    await expect(page.getByText(/Bookable not found/i)).toHaveCount(0);
  });

  test("public booking explains missing reservation configuration", async ({
    page,
  }) => {
    await page.goto("/book/windhoek-hall");
    await page
      .getByRole("textbox", { name: "Select a date" })
      .fill("2026-09-17");
    await expect(
      page.getByText(/organizer has not finished configuring booking times/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("landing page presents product navigation and no runtime errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.getByRole("link", { name: "B Bookable" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(
      page.locator("nav").getByRole("link", { name: "Get started" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /bookable/i }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("auth pages expose the intended forms", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();

    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: /create your workspace/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});

test.describe("unauthenticated route guards", () => {
  for (const path of [
    "/dashboard",
    "/organizations/demo",
    "/organizations/demo/bookables",
    "/organizations/demo/bookables/new",
    "/organizations/demo/bookables/demo/availability",
  ]) {
    test(`${path} does not expose protected content anonymously`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login|\/dashboard/);
    });
  }
});
