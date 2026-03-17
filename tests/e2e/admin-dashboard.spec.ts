import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard - Redesigned UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', 'admin@handyhub.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=HandyHub Admin')).toBeVisible({ timeout: 10000 });
  });

  test('Admin dashboard loads with sidebar navigation', async ({ page }) => {
    // Check sidebar menu items
    await expect(page.getByTestId('admin-nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('admin-nav-users')).toBeVisible();
    await expect(page.getByTestId('admin-nav-bookings')).toBeVisible();
    await expect(page.getByTestId('admin-nav-services')).toBeVisible();
    await expect(page.getByTestId('admin-nav-analytics')).toBeVisible();
    await expect(page.getByTestId('admin-nav-settings')).toBeVisible();
    
    // Check logout button
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('Dashboard panel shows stats', async ({ page }) => {
    await page.getByTestId('admin-nav-dashboard').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check dashboard stats cards - use main area to avoid sidebar conflicts
    await expect(page.getByRole('main').locator('text=Total Users')).toBeVisible();
    await expect(page.getByRole('main').locator('text=Total Bookings')).toBeVisible();
    await expect(page.getByRole('main').locator('text=Services').first()).toBeVisible();
    await expect(page.getByRole('main').locator('text=Pending')).toBeVisible();
  });

  test('Users panel displays table with password column', async ({ page }) => {
    await page.getByTestId('admin-nav-users').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check table headers - use getByRole for more reliable selection
    const tableHead = page.locator('thead');
    await expect(tableHead.locator('text=NAME')).toBeVisible();
    await expect(tableHead.locator('text=EMAIL')).toBeVisible();
    await expect(tableHead.locator('text=PASSWORD')).toBeVisible();
    await expect(tableHead.locator('text=ROLE')).toBeVisible();
    await expect(tableHead.locator('text=STATUS')).toBeVisible();
    await expect(tableHead.locator('text=ACTIONS')).toBeVisible();
    
    // Check users are displayed - use table to avoid sidebar conflicts
    await expect(page.getByRole('table').locator('text=Admin User')).toBeVisible();
    await expect(page.getByRole('table').locator('text=admin@handyhub.com')).toBeVisible();
  });

  test('Admin Users panel shows passwords as plaintext without toggle', async ({ page }) => {
    await page.getByTestId('admin-nav-users').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Get the table body
    const tableBody = page.locator('tbody');
    
    // Check that password column shows actual passwords in plaintext (not masked with ****)
    // We should see password like "test123" or "admin123" directly displayed
    const passwordCells = tableBody.locator('td:nth-child(3)'); // Password is the 3rd column
    
    // Verify at least one password is visible in plaintext
    // Admin user's password should be "admin123"
    await expect(tableBody.locator('text=admin123')).toBeVisible();
    
    // Client user's password should be "test123"
    await expect(tableBody.locator('text=test123').first()).toBeVisible();
    
    // Verify there is NO toggle button (eye icon) for passwords
    // The fix removed the toggle, so we check there are no visibility toggle buttons in the password column
    const passwordColumn = page.locator('td:nth-child(3)');
    const toggleButtons = passwordColumn.locator('button');
    
    // There should be no buttons in the password column (no toggle)
    await expect(toggleButtons).toHaveCount(0);
  });

  test('Bookings panel shows filters and table', async ({ page }) => {
    await page.getByTestId('admin-nav-bookings').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check filter buttons
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Pending")')).toBeVisible();
    await expect(page.locator('button:has-text("Active")')).toBeVisible();
    await expect(page.locator('button:has-text("Completed")')).toBeVisible();
    
    // Check table headers
    await expect(page.locator('text=SERVICE').first()).toBeVisible();
    await expect(page.locator('text=CLIENT').first()).toBeVisible();
    await expect(page.locator('text=PROVIDER').first()).toBeVisible();
    await expect(page.locator('text=DATE').first()).toBeVisible();
    await expect(page.locator('text=PRICE').first()).toBeVisible();
    await expect(page.locator('text=STATUS').first()).toBeVisible();
  });

  test('Bookings can be filtered', async ({ page }) => {
    await page.getByTestId('admin-nav-bookings').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Pending filter
    await page.locator('button:has-text("Pending")').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Active filter
    await page.locator('button:has-text("Active")').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click on Completed filter
    await page.locator('button:has-text("Completed")').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click back to All
    await page.locator('button:has-text("All")').click();
    await page.waitForLoadState('domcontentloaded');
  });

  test('Services panel shows grid view with add button', async ({ page }) => {
    await page.getByTestId('admin-nav-services').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check Add Service button
    await expect(page.locator('button:has-text("Add Service")')).toBeVisible();
    
    // Check services are displayed in grid
    await expect(page.locator('text=Plumbing Repair')).toBeVisible();
    await expect(page.locator('text=Electrical Work')).toBeVisible();
    await expect(page.locator('text=Deep Cleaning')).toBeVisible();
  });

  test('Analytics panel shows charts and stats', async ({ page }) => {
    await page.getByTestId('admin-nav-analytics').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check analytics header
    await expect(page.locator('text=Analytics').first()).toBeVisible();
    
    // Check period filters - use exact match with role
    await expect(page.getByRole('button', { name: 'Week' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Year' })).toBeVisible();
    
    // Check stats cards
    await expect(page.locator('text=Total Revenue')).toBeVisible();
    await expect(page.locator('text=Commission Earned')).toBeVisible();
    await expect(page.locator('text=Completion Rate')).toBeVisible();
    
    // Check charts sections
    await expect(page.locator('text=Bookings Trend')).toBeVisible();
    await expect(page.locator('text=Top Categories')).toBeVisible();
    await expect(page.locator('text=User Growth')).toBeVisible();
  });

  test('Settings panel is accessible', async ({ page }) => {
    await page.getByTestId('admin-nav-settings').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check settings content loads
    await expect(page.locator('text=Settings').first()).toBeVisible({ timeout: 5000 });
  });

  test('Admin can logout', async ({ page }) => {
    await page.getByTestId('logout-button').click();
    
    // Should be redirected to login page
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible({ timeout: 5000 });
  });
});
