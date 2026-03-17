import { Page, expect } from '@playwright/test';

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
}

export async function dismissToasts(page: Page) {
  await page.addLocatorHandler(
    page.locator('[data-sonner-toast], .Toastify__toast, [role="status"].toast, .MuiSnackbar-root'),
    async () => {
      const close = page.locator('[data-sonner-toast] [data-close], [data-sonner-toast] button[aria-label="Close"], .Toastify__close-button, .MuiSnackbar-root button');
      await close.first().click({ timeout: 2000 }).catch(() => {});
    },
    { times: 10, noWaitAfter: true }
  );
}

export async function checkForErrors(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const errorElements = Array.from(
      document.querySelectorAll('.error, [class*="error"], [id*="error"]')
    );
    return errorElements.map(el => el.textContent || '').filter(Boolean);
  });
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  await page.fill('input[type="email"]', 'admin@handyhub.com');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button:has-text("Sign In")');
  
  // Wait for admin dashboard to load
  await expect(page.locator('text=HandyHub Admin')).toBeVisible({ timeout: 10000 });
}

export async function loginAsProvider(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  await page.fill('input[type="email"]', 'provider.test@handyhub.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button:has-text("Sign In")');
  
  // Wait for provider dashboard (bottom nav)
  await expect(page.getByTestId('provider-nav-home')).toBeVisible({ timeout: 10000 });
}

export async function loginAsClient(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'test123');
  await page.click('button:has-text("Sign In")');
  
  // Wait for client dashboard (bottom nav)
  await expect(page.getByTestId('client-nav-home')).toBeVisible({ timeout: 10000 });
}

export async function navigateToAdminTab(page: Page, tabId: string) {
  await page.getByTestId(`admin-nav-${tabId}`).click();
  await page.waitForLoadState('domcontentloaded');
}

export async function navigateToProviderTab(page: Page, tabId: string) {
  await page.getByTestId(`provider-nav-${tabId}`).click();
  await page.waitForLoadState('domcontentloaded');
}

export async function navigateToClientTab(page: Page, tabId: string) {
  await page.getByTestId(`client-nav-${tabId}`).click();
  await page.waitForLoadState('domcontentloaded');
}
