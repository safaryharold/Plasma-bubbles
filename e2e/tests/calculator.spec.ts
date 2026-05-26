import { test, expect } from "@playwright/test";

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@ibp.dev";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

test.describe("Calculator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email"]', ADMIN_EMAIL);
    await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await page.goto("/calculator");
  });

  test("renders form fields", async ({ page }) => {
    await expect(page.getByTestId("calc-page")).toBeVisible();
  });

  test("submits calculation and shows result", async ({ page }) => {
    // Fill form using data-testid attributes
    await page.fill('[data-testid="calc-day-month"]', "3");
    await page.fill('[data-testid="calc-lon"]',        "0");
    await page.fill('[data-testid="calc-lt"]',         "21");
    await page.fill('[data-testid="calc-f107"]',       "150");
    await page.click('[data-testid="calc-submit"]');
    // Wait for result panel
    await expect(page.getByTestId("calc-result")).toBeVisible({ timeout: 10000 });
  });
});
