# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-and-forms.spec.ts >> public product surfaces >> public booking shows a friendly missing-bookable state
- Location: tests\e2e\public-and-forms.spec.ts:49:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'This booking page is unavailable' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'This booking page is unavailable' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'This booking page is unavailable' })

```

```yaml
- main:
  - link "B Bookable":
    - /url: /
  - text: Public catalog
  - heading "This organization is unavailable" [level=1]
  - paragraph: Check the link and try again.
  - link "Return to Bookable":
    - /url: /
  - link "Bookable":
    - /url: /
  - paragraph: Make anything bookable
  - paragraph: © 2026 Bookable
- alert
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test.describe("public product surfaces", () => {
  4   |   for (const status of ["SUCCEEDED", "FAILED"] as const) {
  5   |     test(`fake checkout simulates ${status.toLowerCase()} payment`, async ({
  6   |       page,
  7   |     }) => {
  8   |       let payload: Record<string, unknown> | undefined;
  9   |       let signature = "";
  10  | 
  11  |       await page.route("**/api/v1/payments/webhooks/fake", async (route) => {
  12  |         payload = route.request().postDataJSON() as Record<string, unknown>;
  13  |         signature = route.request().headers()["x-fake-signature"] ?? "";
  14  |         await route.fulfill({
  15  |           status: 201,
  16  |           contentType: "application/json",
  17  |           body: JSON.stringify({ status, idempotent: false }),
  18  |         });
  19  |       });
  20  | 
  21  |       await page.goto(
  22  |         "/fake-checkout?providerReference=fake_reservation:e2e-reservation&amount=1250&currency=USD",
  23  |       );
  24  |       await expect(
  25  |         page.getByRole("heading", { name: "Fake Payment Checkout" }),
  26  |       ).toBeVisible();
  27  |       await page.getByRole("button", {
  28  |         name:
  29  |           status === "SUCCEEDED"
  30  |             ? "Simulate successful payment"
  31  |             : "Simulate failed payment",
  32  |       }).click();
  33  | 
  34  |       await expect(
  35  |         page.getByText(
  36  |           status === "SUCCEEDED" ? "Payment successful" : "Payment failed",
  37  |         ),
  38  |       ).toBeVisible();
  39  |       expect(payload).toEqual({
  40  |         providerReference: "fake_reservation:e2e-reservation",
  41  |         status,
  42  |         amount: 1250,
  43  |         currency: "USD",
  44  |       });
  45  |       expect(signature).toBe("phase8-test-signature");
  46  |     });
  47  |   }
  48  | 
  49  |   test("public booking shows a friendly missing-bookable state", async ({
  50  |     page,
  51  |   }) => {
  52  |     await page.goto("/book/missing-stage-7-bookable");
  53  |     await expect(
  54  |       page.getByRole("heading", { name: "This booking page is unavailable" }),
> 55  |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  56  |     await expect(page.getByText(/ask the organizer/i)).toBeVisible();
  57  |     await expect(page.getByText(/Bookable not found/i)).toHaveCount(0);
  58  |   });
  59  | 
  60  |   test("public booking explains missing reservation configuration", async ({
  61  |     page,
  62  |   }) => {
  63  |     await page.goto("/book/windhoek-hall");
  64  |     await page
  65  |       .getByRole("textbox", { name: "Select a date" })
  66  |       .fill("2026-09-17");
  67  |     await expect(
  68  |       page.getByText(/organizer has not finished configuring booking times/i),
  69  |     ).toBeVisible();
  70  |     await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
  71  |   });
  72  | 
  73  |   test("landing page presents product navigation and no runtime errors", async ({
  74  |     page,
  75  |   }) => {
  76  |     const errors: string[] = [];
  77  |     page.on("pageerror", (error) => errors.push(error.message));
  78  |     await page.goto("/");
  79  |     await expect(page.getByRole("link", { name: "B Bookable" })).toBeVisible();
  80  |     await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  81  |     await expect(
  82  |       page.locator("nav").getByRole("link", { name: "Get started" }),
  83  |     ).toBeVisible();
  84  |     await expect(
  85  |       page.getByRole("heading", { name: /bookable/i }).first(),
  86  |     ).toBeVisible();
  87  |     expect(errors).toEqual([]);
  88  |   });
  89  | 
  90  |   test("auth pages expose the intended forms", async ({ page }) => {
  91  |     await page.goto("/login");
  92  |     await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  93  |     await expect(page.getByLabel("Email")).toBeVisible();
  94  |     await expect(page.getByLabel("Password")).toBeVisible();
  95  | 
  96  |     await page.goto("/register");
  97  |     await expect(
  98  |       page.getByRole("heading", { name: /create your workspace/i }),
  99  |     ).toBeVisible();
  100 |     await expect(page.getByLabel("Name")).toBeVisible();
  101 |     await expect(page.getByLabel("Email")).toBeVisible();
  102 |   });
  103 | });
  104 | 
  105 | test.describe("unauthenticated route guards", () => {
  106 |   for (const path of [
  107 |     "/dashboard",
  108 |     "/organizations/demo",
  109 |     "/organizations/demo/bookables",
  110 |     "/organizations/demo/bookables/new",
  111 |     "/organizations/demo/bookables/demo/availability",
  112 |   ]) {
  113 |     test(`${path} does not expose protected content anonymously`, async ({
  114 |       page,
  115 |     }) => {
  116 |       await page.goto(path);
  117 |       await expect(page).toHaveURL(/\/login|\/dashboard/);
  118 |     });
  119 |   }
  120 | });
  121 | 
```