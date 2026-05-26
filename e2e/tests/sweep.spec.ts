import { test, expect } from "@playwright/test";

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@ibp.dev";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

test.describe("Parameter Sweep", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email"]', ADMIN_EMAIL);
    await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await page.goto("/sweep");
    await expect(page.getByTestId("sweep-page")).toBeVisible();
  });

  test("grid cell counter updates when step changes", async ({ page }) => {
    const counter = page.getByTestId("grid-cells-indicator");
    await expect(counter).toBeVisible();
    const initial = await counter.textContent();
    // Changing lon_step to a larger value should reduce cell count
    await page.fill('[data-testid="sweep-lon-step"]', "20");
    const updated = await counter.textContent();
    expect(updated).not.toBe(initial);
  });

  test("submitting a sweep creates a job", async ({ page }) => {
    await page.click('[data-testid="sweep-submit"]');
    // Job progress bar or result panel should appear
    await expect(page.locator('[data-testid="sweep-result"]')).toBeVisible({ timeout: 30000 });
  });
});
