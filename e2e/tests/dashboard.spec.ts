import { test, expect } from "@playwright/test";

// Assumes a seeded admin account (from seed_admin)
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@ibp.dev";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

async function loginAdmin(page: any) {
  await page.goto("/login");
  await page.fill('[data-testid="login-email"]',    ADMIN_EMAIL);
  await page.fill('[data-testid="login-password"]', ADMIN_PASSWORD);
  await page.click('[data-testid="login-submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => { await loginAdmin(page); });

  test("renders stat strip and quick actions", async ({ page }) => {
    await expect(page.getByTestId("stat-strip")).toBeVisible();
    await expect(page.getByTestId("qa-calculator")).toBeVisible();
    await expect(page.getByTestId("qa-sweep")).toBeVisible();
    await expect(page.getByTestId("qa-experiments")).toBeVisible();
  });

  test("recent jobs section is visible", async ({ page }) => {
    await expect(page.getByTestId("recent-jobs")).toBeVisible();
  });

  test("navigation links work", async ({ page }) => {
    await page.click('[data-testid="nav-calculator"]');
    await expect(page).toHaveURL(/\/calculator/);
  });
});

test.describe("Mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => { await loginAdmin(page); });

  test("hamburger opens mobile menu", async ({ page }) => {
    const btn = page.getByTestId("mobile-menu-btn");
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
  });

  test("mobile menu closes on nav click", async ({ page }) => {
    await page.getByTestId("mobile-menu-btn").click();
    await page.locator("#mobile-nav").locator('[data-testid="nav-calculator"]').click();
    await expect(page).toHaveURL(/\/calculator/);
  });
});
