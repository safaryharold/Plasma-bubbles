import { test, expect } from "@playwright/test";

const TEST_EMAIL = `playwright_${Date.now()}@ibp-test.dev`;
const TEST_PASSWORD = "Test@1234!";
const TEST_NAME = "Playwright Tester";

test.describe("Authentication flows", () => {
  test("register a new user and land on dashboard", async ({ page }) => {
    await page.goto("/register");
    await page.fill('[data-testid="register-email"]', TEST_EMAIL);
    await page.fill('[data-testid="register-name"]',  TEST_NAME);
    await page.fill('[data-testid="register-password"]', TEST_PASSWORD);
    await page.click('[data-testid="register-submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
  });

  test("login with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email"]',    TEST_EMAIL);
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email"]',    "bad@bad.com");
    await page.fill('[data-testid="login-password"]', "wrongpassword123");
    await page.click('[data-testid="login-submit"]');
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout redirects to landing", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('[data-testid="login-email"]',    TEST_EMAIL);
    await page.fill('[data-testid="login-password"]', TEST_PASSWORD);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    // Now logout
    await page.click('[data-testid="logout-btn"]');
    await expect(page).toHaveURL("/");
  });
});
