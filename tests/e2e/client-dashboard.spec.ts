import { test, expect } from '@playwright/test';

test.describe('Client Dashboard - Language, Profile & Forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Login as client
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('text=HandyHub').first()).toBeVisible({ timeout: 10000 });
  });

  test('Client dashboard loads with bottom navigation', async ({ page }) => {
    // Check bottom navigation menu items
    await expect(page.getByTestId('client-nav-home')).toBeVisible();
    await expect(page.getByTestId('client-nav-tasks')).toBeVisible();
    await expect(page.getByTestId('client-nav-profile')).toBeVisible();
  });

  test('Language selector is visible in client dashboard header', async ({ page }) => {
    // Check that language selector dropdown is present
    const languageSelector = page.locator('select').first();
    await expect(languageSelector).toBeVisible();
    
    // Check it has language options
    const options = languageSelector.locator('option');
    await expect(options).toHaveCount(3); // EN, ES, UK
  });

  test('Language switching to Ukrainian translates client dashboard UI', async ({ page }) => {
    // Get the language selector
    const languageSelector = page.locator('select').first();
    
    // Switch to Ukrainian
    await languageSelector.selectOption('uk');
    await page.waitForLoadState('domcontentloaded');
    
    // Verify UI is translated to Ukrainian
    await expect(page.locator('text=Ваше місцезнаходження')).toBeVisible();
    await expect(page.locator('text=Всі послуги')).toBeVisible();
    
    // Check bottom nav is translated
    await expect(page.locator('text=Головна')).toBeVisible();
    await expect(page.locator('text=Завдання')).toBeVisible();
    await expect(page.locator('text=Профіль')).toBeVisible();
    
    // Check Book button is translated
    await expect(page.locator('text=Замовити').first()).toBeVisible();
  });

  test('Language switching to Spanish translates client dashboard UI', async ({ page }) => {
    const languageSelector = page.locator('select').first();
    
    // Switch to Spanish
    await languageSelector.selectOption('es');
    await page.waitForLoadState('domcontentloaded');
    
    // Verify UI is translated to Spanish
    await expect(page.locator('text=Tu ubicación')).toBeVisible();
    await expect(page.locator('text=Todos los Servicios')).toBeVisible();
    
    // Check bottom nav is translated
    await expect(page.locator('text=Inicio')).toBeVisible();
    await expect(page.locator('text=Tareas')).toBeVisible();
    await expect(page.locator('text=Perfil')).toBeVisible();
  });

  test('Client profile menu items are clickable and expand properly', async ({ page }) => {
    // Go to Profile tab
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check profile header is visible
    await expect(page.locator('text=Test User').first()).toBeVisible();
    await expect(page.locator('text=test@example.com').first()).toBeVisible();
    
    // Check menu items are present
    await expect(page.locator('text=Account details')).toBeVisible();
    await expect(page.locator('text=Payment methods')).toBeVisible();
    await expect(page.locator('text=Addresses')).toBeVisible();
    
    // Click Account details to expand
    await page.locator('text=Account details').click();
    
    // Verify expanded content shows user details
    await expect(page.locator('text=Name:').first()).toBeVisible();
    await expect(page.locator('text=Email:').first()).toBeVisible();
    await expect(page.locator('text=Phone:').first()).toBeVisible();
  });

  test('Client profile - Payment methods section expands and shows Add button', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Payment methods
    await page.locator('text=Payment methods').click();
    
    // Check expanded content - should show no payment methods message
    await expect(page.locator('text=No payment methods added')).toBeVisible();
    
    // Check Add payment button is visible
    await expect(page.getByTestId('add-payment-btn')).toBeVisible();
  });

  test('Client profile - Add Payment button opens form with card fields', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Payment methods
    await page.locator('text=Payment methods').click();
    
    // Click Add payment button
    await page.getByTestId('add-payment-btn').click();
    
    // Verify form fields are visible
    await expect(page.locator('input[placeholder="Card Number"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Expiry"]')).toBeVisible();
    await expect(page.locator('input[placeholder="CVV"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Name"]')).toBeVisible();
    
    // Check Cancel and Save buttons
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('Client profile - Add Payment form Cancel button hides form', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Payment methods
    await page.locator('text=Payment methods').click();
    
    // Click Add payment button
    await page.getByTestId('add-payment-btn').click();
    
    // Form should be visible
    await expect(page.locator('input[placeholder="Card Number"]')).toBeVisible();
    
    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Form should be hidden, Add button should be visible again
    await expect(page.locator('input[placeholder="Card Number"]')).not.toBeVisible();
    await expect(page.getByTestId('add-payment-btn')).toBeVisible();
  });

  test('Client profile - Addresses section expands and shows Add button', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Addresses
    await page.locator('text=Addresses').click();
    
    // Check expanded content - should show no addresses message
    await expect(page.locator('text=No saved addresses')).toBeVisible();
    
    // Check Add address button is visible
    await expect(page.getByTestId('add-address-btn')).toBeVisible();
  });

  test('Client profile - Add Address button opens form with address fields', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Addresses
    await page.locator('text=Addresses').click();
    
    // Click Add address button
    await page.getByTestId('add-address-btn').click();
    
    // Verify form fields are visible
    await expect(page.locator('input[placeholder*="Label"]').or(page.locator('input[placeholder="label"]'))).toBeVisible();
    await expect(page.locator('input[placeholder="Street and building number"]')).toBeVisible();
    await expect(page.locator('input[placeholder="City"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="ZIP"]').or(page.locator('input[placeholder="zip"]'))).toBeVisible();
    
    // Check Cancel and Save buttons
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('Client profile - Add Address form Cancel button hides form', async ({ page }) => {
    await page.getByTestId('client-nav-profile').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Addresses
    await page.locator('text=Addresses').click();
    
    // Click Add address button
    await page.getByTestId('add-address-btn').click();
    
    // Form should be visible
    await expect(page.locator('input[placeholder="Street and building number"]')).toBeVisible();
    
    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Form should be hidden, Add button should be visible again
    await expect(page.locator('input[placeholder="Street and building number"]')).not.toBeVisible();
    await expect(page.getByTestId('add-address-btn')).toBeVisible();
  });

  test('Tasks tab shows correct UI and filter buttons', async ({ page }) => {
    await page.getByTestId('client-nav-tasks').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Check filter tabs are present (in English by default)
    await expect(page.locator('button:has-text("All")')).toBeVisible();
    await expect(page.locator('button:has-text("Active")')).toBeVisible();
    await expect(page.locator('button:has-text("Completed")')).toBeVisible();
  });

  test('Navigation between all tabs works correctly', async ({ page }) => {
    // Go to Tasks
    await page.getByTestId('client-nav-tasks').click();
    await expect(page.locator('h2:has-text("Your Tasks")')).toBeVisible();
    
    // Go to Profile
    await page.getByTestId('client-nav-profile').click();
    await expect(page.locator('text=Test User').first()).toBeVisible();
    
    // Go back to Home
    await page.getByTestId('client-nav-home').click();
    await expect(page.locator('text=All Services')).toBeVisible();
  });
});
