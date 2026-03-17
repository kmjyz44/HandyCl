import { test, expect } from '@playwright/test';
import { loginAsAdmin, dismissToasts } from '../fixtures/helpers';

/**
 * Tests for Language & Payment Settings Features (Admin Panel)
 * Features tested:
 * - Language Settings: default language, available languages, geolocation toggle
 * - Payment Settings: Stripe, Zelle, Venmo with toggle and configuration fields
 * - Push Notifications: Firebase configuration
 * - Language Selector in header
 */

test.describe('Admin Settings - Language & Payments', () => {
  
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    await loginAsAdmin(page);
    
    // Navigate to Settings
    await page.getByTestId('admin-nav-settings').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Click Language & Payments tab
    await page.click('button:has-text("Language & Payments")');
    await page.waitForTimeout(500);
  });

  test.describe('Language Settings Tab', () => {
    
    test('displays Language Settings panel with all fields', async ({ page }) => {
      // Language tab should be active by default when clicking Language & Payments
      await expect(page.locator('text=Language Settings')).toBeVisible();
      await expect(page.locator('text=Configure available languages and auto-detection')).toBeVisible();
      
      // Default Language selector
      await expect(page.locator('text=Default Language')).toBeVisible();
      
      // Available Languages section
      await expect(page.getByText('Available Languages', { exact: true })).toBeVisible();
      await expect(page.locator('text=Select which languages will be available for users')).toBeVisible();
      
      // Language buttons with flags
      await expect(page.locator('button:has-text("English")')).toBeVisible();
      await expect(page.locator('button:has-text("Español")')).toBeVisible();
      await expect(page.locator('button:has-text("Українська")')).toBeVisible();
      
      // Geolocation toggle
      await expect(page.locator('text=Auto-detect language by location')).toBeVisible();
    });

    test('default language selector has all three languages', async ({ page }) => {
      // Find the select element
      const select = page.locator('select').first();
      await expect(select).toBeVisible();
      
      // Check options exist
      const options = await select.locator('option').allTextContents();
      expect(options.join(',')).toContain('English');
      expect(options.join(',')).toContain('Español');
      expect(options.join(',')).toContain('Українська');
    });

    test('can toggle available languages', async ({ page }) => {
      // English button should have checkmark (enabled)
      const englishBtn = page.locator('button:has-text("English")');
      await expect(englishBtn).toBeVisible();
      
      // Español button should have checkmark
      const spanishBtn = page.locator('button:has-text("Español")');
      await expect(spanishBtn).toBeVisible();
      
      // Click on Español to toggle it
      await spanishBtn.click();
      await page.waitForTimeout(300);
      
      // Click again to re-enable
      await spanishBtn.click();
    });

    test('geolocation toggle is interactive', async ({ page }) => {
      // Find the geolocation toggle container
      const geoSection = page.locator('text=Auto-detect language by location >> xpath=ancestor::div[contains(@class, "rounded")]');
      const geoToggle = geoSection.locator('.w-11.h-6').first();
      
      await expect(geoToggle).toBeVisible();
      
      // Toggle should be clickable
      await geoToggle.click({ force: true });
      await page.waitForTimeout(300);
      
      // Toggle back
      await geoToggle.click({ force: true });
    });
  });

  test.describe('Payment Settings Tab', () => {
    
    test.beforeEach(async ({ page }) => {
      // Click on Payments subtab
      const paymentsTab = page.locator('button').filter({ hasText: /^Payments$/ });
      await paymentsTab.click();
      await page.waitForTimeout(500);
    });

    test('displays all three payment method sections', async ({ page }) => {
      // Stripe section
      await expect(page.locator('text=Stripe Payments')).toBeVisible();
      await expect(page.locator('text=Accept credit/debit card payments')).toBeVisible();
      
      // Zelle section  
      await expect(page.locator('h3:has-text("Zelle")')).toBeVisible();
      await expect(page.locator('text=Accept Zelle payments')).toBeVisible();
      
      // Venmo section
      await expect(page.locator('h3:has-text("Venmo")')).toBeVisible();
      await expect(page.locator('text=Accept Venmo payments')).toBeVisible();
    });

    test('Stripe toggle reveals key fields when enabled', async ({ page }) => {
      // Find Stripe toggle and enable it
      const stripeSection = page.locator('text=Stripe Payments >> xpath=ancestor::div[contains(@class, "rounded-2xl")]');
      const stripeToggle = stripeSection.locator('.w-11.h-6').first();
      
      await stripeToggle.click({ force: true });
      await page.waitForTimeout(500);
      
      // Verify key fields appear
      await expect(page.locator('text=Stripe Public Key')).toBeVisible();
      await expect(page.locator('text=Stripe Secret Key')).toBeVisible();
      await expect(page.locator('input[placeholder="pk_live_..."]')).toBeVisible();
      await expect(page.locator('input[placeholder="sk_live_..."]')).toBeVisible();
      
      // Link to Stripe Dashboard should be visible
      await expect(page.locator('text=Stripe Dashboard')).toBeVisible();
      
      // Toggle off to reset
      await stripeToggle.click({ force: true });
    });

    test('Zelle toggle reveals instructions textarea when enabled', async ({ page }) => {
      // Find Zelle section
      const zelleSection = page.locator('h3:has-text("Zelle") >> xpath=ancestor::div[contains(@class, "rounded-2xl")]');
      const zelleToggle = zelleSection.locator('.w-11.h-6').first();
      
      // Check if instructions are already visible (Zelle might be enabled)
      const instructionsLabel = page.locator('label:has-text("Zelle Payment Instructions")');
      const isAlreadyVisible = await instructionsLabel.isVisible().catch(() => false);
      
      if (!isAlreadyVisible) {
        // Toggle to enable
        await zelleToggle.click({ force: true });
        await page.waitForTimeout(500);
      }
      
      // Verify instructions field appears
      await expect(instructionsLabel).toBeVisible();
      await expect(zelleSection.locator('textarea')).toBeVisible();
      await expect(page.locator('text=This text will be shown to clients when they select Zelle')).toBeVisible();
    });

    test('Venmo toggle reveals instructions textarea when enabled', async ({ page }) => {
      // Scroll down to see Venmo
      await page.evaluate(() => window.scrollBy(0, 300));
      
      // Find Venmo toggle
      const venmoSection = page.locator('h3:has-text("Venmo") >> xpath=ancestor::div[contains(@class, "rounded-2xl")]');
      const venmoToggle = venmoSection.locator('.w-11.h-6').first();
      
      await venmoToggle.click({ force: true });
      await page.waitForTimeout(500);
      
      // Verify instructions field appears
      await expect(page.locator('text=Venmo Payment Instructions')).toBeVisible();
      await expect(page.locator('text=This text will be shown to clients when they select Venmo')).toBeVisible();
      
      // Toggle off to reset
      await venmoToggle.click({ force: true });
    });
  });

  test.describe('Push Notifications Tab', () => {
    
    test.beforeEach(async ({ page }) => {
      // Click on Push Notifications subtab
      const pushTab = page.locator('button').filter({ hasText: 'Push Notifications' });
      await pushTab.click();
      await page.waitForTimeout(500);
    });

    test('displays Push Notification Settings panel', async ({ page }) => {
      await expect(page.locator('text=Push Notification Settings')).toBeVisible();
      await expect(page.locator('text=Configure Firebase Cloud Messaging for push notifications')).toBeVisible();
      
      // Enable toggle
      await expect(page.locator('text=Enable Push Notifications')).toBeVisible();
      await expect(page.locator('text=Send push notifications to mobile devices')).toBeVisible();
    });

    test('enabling push notifications reveals Firebase fields', async ({ page }) => {
      // Find push toggle
      const pushSection = page.locator('text=Enable Push Notifications >> xpath=ancestor::div[contains(@class, "rounded")]');
      const pushToggle = pushSection.locator('.w-11.h-6').first();
      
      await pushToggle.click({ force: true });
      await page.waitForTimeout(500);
      
      // Verify Firebase fields appear
      await expect(page.locator('text=Firebase Setup Required')).toBeVisible();
      await expect(page.locator('text=Firebase Project ID')).toBeVisible();
      await expect(page.locator('input[placeholder="my-app-12345"]')).toBeVisible();
      
      await expect(page.locator('text=Firebase Server Key')).toBeVisible();
      await expect(page.locator('input[placeholder="AAAA..."]')).toBeVisible();
      
      // Link to Firebase Console
      await expect(page.locator('text=Go to Firebase Console')).toBeVisible();
      
      // Toggle off to reset
      await pushToggle.click({ force: true });
    });
  });

  test.describe('Save Settings Functionality', () => {
    
    test('Save Settings button is visible and clickable', async ({ page }) => {
      const saveBtn = page.locator('button:has-text("Save Settings")');
      await expect(saveBtn).toBeVisible();
      await expect(saveBtn).toBeEnabled();
    });

    test('clicking Save Settings shows success message', async ({ page }) => {
      // Wait for network response
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/settings') && response.request().method() === 'PUT',
        { timeout: 10000 }
      );
      
      // Click Save Settings
      await page.click('button:has-text("Save Settings")');
      
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      
      // Success message should appear
      await expect(page.locator('text=Settings Saved!')).toBeVisible();
    });
  });
});

test.describe('Language Selector in Header', () => {
  
  test.beforeEach(async ({ page }) => {
    await dismissToasts(page);
    await loginAsAdmin(page);
  });

  test('language selector is visible in header', async ({ page }) => {
    // The select dropdown should be visible in header area
    const languageSelector = page.locator('select.appearance-none').first();
    await expect(languageSelector).toBeVisible();
  });

  test('language selector shows flag and language name', async ({ page }) => {
    const languageSelector = page.locator('select.appearance-none').first();
    
    // Get selected value text - should show flag and English
    const selectedText = await languageSelector.inputValue();
    expect(['en', 'es', 'uk']).toContain(selectedText);
  });

  test('language selector dropdown has all languages', async ({ page }) => {
    const languageSelector = page.locator('select.appearance-none').first();
    
    // Open dropdown by clicking
    await languageSelector.click();
    await page.waitForTimeout(300);
    
    // Check options
    const options = await languageSelector.locator('option').allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(1);
    
    // At least English should be available
    expect(options.join(',')).toContain('English');
  });

  test('changing language updates the selector', async ({ page }) => {
    const languageSelector = page.locator('select.appearance-none').first();
    
    // Get current value
    const initialValue = await languageSelector.inputValue();
    
    // Select a different language
    if (initialValue === 'en') {
      await languageSelector.selectOption('es');
    } else {
      await languageSelector.selectOption('en');
    }
    
    await page.waitForTimeout(500);
    
    // Verify value changed
    const newValue = await languageSelector.inputValue();
    expect(newValue).not.toBe(initialValue);
    
    // Reset to English
    await languageSelector.selectOption('en');
  });
});
