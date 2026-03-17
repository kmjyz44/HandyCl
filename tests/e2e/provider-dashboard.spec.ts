import { test, expect } from '@playwright/test';

test.describe('Provider Dashboard - Redesigned UI with Bottom Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'provider@example.com');
    await page.fill('input[type="password"]', 'provider123');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=HandyHub').first()).toBeVisible({ timeout: 10000 });
  });

  test('Provider dashboard loads with bottom navigation', async ({ page }) => {
    // Check bottom navigation menu items - updated to match new design
    await expect(page.getByTestId('provider-nav-home')).toBeVisible();
    await expect(page.getByTestId('provider-nav-tasks')).toBeVisible();
    await expect(page.getByTestId('provider-nav-invoices')).toBeVisible();
    await expect(page.getByTestId('provider-nav-calendar')).toBeVisible();
    await expect(page.getByTestId('provider-nav-profile')).toBeVisible();
  });

  test('Home tab shows welcome message and stats', async ({ page }) => {
    // By default, home tab should be active
    await expect(page.locator('text=Hello')).toBeVisible();
    await expect(page.locator('text=Ready to take on some tasks today?')).toBeVisible();
    
    // Check stats cards
    await expect(page.locator('text=This Month')).toBeVisible();
    await expect(page.locator('text=Earnings')).toBeVisible();
    await expect(page.locator('text=Rating')).toBeVisible();
    
    // Check active tasks section - use heading
    await expect(page.getByRole('heading', { name: 'Active Tasks' })).toBeVisible();
  });

  test('Tasks tab shows filter tabs', async ({ page }) => {
    await page.getByTestId('provider-nav-tasks').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check filter tabs
    await expect(page.locator('button:has-text("Available")')).toBeVisible();
    await expect(page.locator('button:has-text("Active")')).toBeVisible();
    await expect(page.locator('button:has-text("Past")')).toBeVisible();
  });

  test('Calendar tab shows availability settings', async ({ page }) => {
    await page.getByTestId('provider-nav-calendar').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check calendar content
    await expect(page.locator('text=Set Availability')).toBeVisible();
    
    // Check week days selector
    await expect(page.locator('text=Mon')).toBeVisible();
    await expect(page.locator('text=Tue')).toBeVisible();
    await expect(page.locator('text=Wed')).toBeVisible();
    
    // Check add availability button
    await expect(page.locator('button:has-text("Add Availability")')).toBeVisible();
  });

  test('Performance/Invoices tab exists in nav', async ({ page }) => {
    // Performance tab was replaced by Invoices tab in the new design
    // This test verifies the Invoices tab works
    await page.getByTestId('provider-nav-invoices').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check invoices content
    await expect(page.getByText('Мої інвойси')).toBeVisible();
    await expect(page.locator('button:has-text("Створити інвойс")')).toBeVisible();
  });

  test('Profile tab shows menu items', async ({ page }) => {
    await page.getByTestId('provider-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check profile header
    await expect(page.locator('text=Profile').first()).toBeVisible();
    await expect(page.locator('text=Provider Example')).toBeVisible();
    await expect(page.locator('text=provider@example.com')).toBeVisible();
    
    // Check menu items
    await expect(page.getByTestId('profile-menu-account')).toBeVisible();
    await expect(page.getByTestId('profile-menu-tasker-profile')).toBeVisible();
    await expect(page.getByTestId('profile-menu-documents')).toBeVisible();
    await expect(page.getByTestId('profile-menu-payments')).toBeVisible();
    await expect(page.getByTestId('profile-menu-support')).toBeVisible();
  });

  test('Profile Account details subpage works', async ({ page }) => {
    await page.getByTestId('provider-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Account details
    await page.getByTestId('profile-menu-account').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check account details form
    await expect(page.locator('text=Account Details')).toBeVisible();
    await expect(page.locator('text=Full Name')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Phone')).toBeVisible();
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible();
    
    // Check back button
    await expect(page.locator('text=Back')).toBeVisible();
  });

  test('Profile Tasker profile subpage works', async ({ page }) => {
    await page.getByTestId('provider-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Tasker profile
    await page.getByTestId('profile-menu-tasker-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check tasker profile form
    await expect(page.locator('text=Tasker Profile')).toBeVisible();
    await expect(page.locator('text=Bio')).toBeVisible();
    await expect(page.locator('text=Hourly Rate')).toBeVisible();
    await expect(page.locator('button:has-text("Save Profile")')).toBeVisible();
  });

  test('Profile Verification documents subpage works', async ({ page }) => {
    await page.getByTestId('provider-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Documents
    await page.getByTestId('profile-menu-documents').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check documents page
    await expect(page.locator('text=Verification Documents')).toBeVisible();
    await expect(page.locator('text=Upload Document')).toBeVisible();
    await expect(page.locator('text=My Documents')).toBeVisible();
  });

  test('Profile Payments subpage works', async ({ page }) => {
    await page.getByTestId('provider-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Payments
    await page.getByTestId('profile-menu-payments').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check payments page - use headings
    await expect(page.locator('text=Payment Settings')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payout Accounts' })).toBeVisible();
    await expect(page.locator('text=Payout History')).toBeVisible();
  });
});
