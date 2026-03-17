import { test, expect } from '@playwright/test';

test.describe('Chat and Notification Panels - P0 Features', () => {
  
  // ==================== ADMIN TESTS ====================
  test.describe('Admin Dashboard - Chat & Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.fill('input[type="email"]', 'admin@handyhub.com');
      await page.fill('input[type="password"]', 'admin123');
      await page.click('button:has-text("Sign In")');
      await expect(page.locator('text=HandyHub Admin')).toBeVisible({ timeout: 10000 });
    });

    test('Admin can open and close chat panel', async ({ page }) => {
      // Click chat button
      await page.getByTestId('open-chat-btn').click();
      
      // Verify chat panel opens with Ukrainian text
      await expect(page.locator('text=Повідомлення')).toBeVisible();
      await expect(page.locator('text=Немає повідомлень')).toBeVisible();
      await expect(page.locator('text=Ваші розмови з\'являться тут')).toBeVisible();
      
      // Verify panel is open (the slide-in panel container)
      await expect(page.locator('.fixed.inset-0.bg-black\\/50')).toBeVisible();
    });

    test('Admin can open notification panel', async ({ page }) => {
      // Click notification bell
      await page.getByTestId('notification-bell').click();
      
      // Verify notification panel opens with Ukrainian text
      await expect(page.locator('text=Сповіщення').first()).toBeVisible();
      await expect(page.locator('text=Немає сповіщень')).toBeVisible();
      await expect(page.locator('text=Нові сповіщення з\'являться тут')).toBeVisible();
    });

    test('Admin has chat and notification buttons in header', async ({ page }) => {
      // Check header has chat button
      await expect(page.getByTestId('open-chat-btn')).toBeVisible();
      
      // Check header has notification bell
      await expect(page.getByTestId('notification-bell')).toBeVisible();
    });
  });

  // ==================== PROVIDER TESTS ====================
  test.describe('Provider Dashboard - Chat & Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.fill('input[type="email"]', 'provider.test@handyhub.com');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button:has-text("Sign In")');
      await expect(page.getByTestId('provider-nav-home')).toBeVisible({ timeout: 10000 });
    });

    test('Provider dashboard loads correctly', async ({ page }) => {
      // Check provider name (Ukrainian)
      await expect(page.locator('text=Hello, Тестовий!')).toBeVisible();
      
      // Check bottom navigation
      await expect(page.getByTestId('provider-nav-home')).toBeVisible();
      await expect(page.getByTestId('provider-nav-tasks')).toBeVisible();
      await expect(page.getByTestId('provider-nav-calendar')).toBeVisible();
      await expect(page.getByTestId('provider-nav-invoices')).toBeVisible();
      await expect(page.getByTestId('provider-nav-profile')).toBeVisible();
    });

    test('Provider can open chat panel', async ({ page }) => {
      await page.getByTestId('provider-chat-btn').click();
      
      // Verify chat panel opens with Ukrainian text
      await expect(page.locator('text=Повідомлення')).toBeVisible();
      await expect(page.locator('text=Немає повідомлень')).toBeVisible();
    });

    test('Provider can open notification panel', async ({ page }) => {
      await page.getByTestId('notification-bell').click();
      
      // Verify notification panel opens with Ukrainian text
      await expect(page.locator('text=Сповіщення').first()).toBeVisible();
      await expect(page.locator('text=Немає сповіщень')).toBeVisible();
    });
  });

  // ==================== CLIENT TESTS ====================
  test.describe('Client Dashboard - Chat & Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'test123');
      await page.click('button:has-text("Sign In")');
      await expect(page.getByTestId('client-nav-home')).toBeVisible({ timeout: 10000 });
    });

    test('Client dashboard loads with services', async ({ page }) => {
      // Check services section is displayed
      await expect(page.locator('text=All Services')).toBeVisible();
      // Use .first() to handle multiple instances
      await expect(page.locator('text=Plumbing Repair').first()).toBeVisible();
      
      // Check bottom navigation
      await expect(page.getByTestId('client-nav-home')).toBeVisible();
      await expect(page.getByTestId('client-nav-tasks')).toBeVisible();
      await expect(page.getByTestId('client-nav-profile')).toBeVisible();
    });

    test('Client can open chat panel', async ({ page }) => {
      await page.getByTestId('client-chat-btn').click();
      
      // Verify chat panel opens with Ukrainian text
      await expect(page.locator('text=Повідомлення')).toBeVisible();
      await expect(page.locator('text=Немає повідомлень')).toBeVisible();
    });

    test('Client can open notification panel', async ({ page }) => {
      await page.getByTestId('notification-bell').click();
      
      // Verify notification panel opens with Ukrainian text
      await expect(page.locator('text=Сповіщення').first()).toBeVisible();
      await expect(page.locator('text=Немає сповіщень')).toBeVisible();
    });
  });
});
