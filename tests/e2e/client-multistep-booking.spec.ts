import { test, expect } from '@playwright/test';
import { loginAsClient, navigateToClientTab } from '../fixtures/helpers';

test.describe('Client Multi-Step Booking Form with i18n', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page);
  });

  test('Client home shows services and booking option', async ({ page }) => {
    // Home tab should be default
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Check for service cards
    await expect(page.getByText('Plumbing Repair').first()).toBeVisible();
    
    // Should have Book buttons
    await expect(page.getByText('Book').first()).toBeVisible();
  });

  test('Clicking service opens Multi-Step Booking Modal in English', async ({ page }) => {
    // Wait for services to load
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service card
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    
    // Multi-step modal should open in English (default)
    await expect(page.getByText('New Booking')).toBeVisible({ timeout: 5000 });
    
    // Check step labels are in English
    await expect(page.getByText('Details')).toBeVisible();
    await expect(page.getByText('Address')).toBeVisible();
    await expect(page.getByText('Time')).toBeVisible();
    await expect(page.getByText('Additional')).toBeVisible();
    await expect(page.getByText('Confirm')).toBeVisible();
  });

  test('Booking Modal Step 1 shows English content', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service card
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    
    // Step 1 should show task details in English
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Task Type')).toBeVisible();
    
    // Check task type options in English - use more specific selector (button with emoji)
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('button', { name: /Repair/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Cleaning/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Installation/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Moving/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Delivery/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Other/ })).toBeVisible();
    
    // Check description field
    await expect(page.getByText('Detailed problem description')).toBeVisible();
    
    // Check Next button in English
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });

  test('Language switch to Ukrainian translates booking modal', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Switch to Ukrainian
    const languageSelector = page.locator('select').first();
    await languageSelector.selectOption('uk');
    await page.waitForLoadState('domcontentloaded');
    
    // Click on first service card
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    
    // Modal should be in Ukrainian
    await expect(page.getByText('Нове замовлення')).toBeVisible({ timeout: 5000 });
    
    // Check step labels are in Ukrainian
    await expect(page.getByText('Деталі')).toBeVisible();
    await expect(page.getByText('Адреса')).toBeVisible();
    await expect(page.getByText('Час')).toBeVisible();
    await expect(page.getByText('Додатково')).toBeVisible();
    await expect(page.getByText('Підтвердження')).toBeVisible();
  });

  test('Booking Modal Step 1 shows Ukrainian content after language switch', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Switch to Ukrainian
    const languageSelector = page.locator('select').first();
    await languageSelector.selectOption('uk');
    await page.waitForLoadState('domcontentloaded');
    
    // Click on first service card
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    
    // Step 1 should show task details in Ukrainian
    await expect(page.getByText('Опишіть завдання')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Тип завдання')).toBeVisible();
    
    // Check task type options in Ukrainian - use more specific selector (button with emoji)
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('button', { name: /Ремонт/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Прибирання/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Монтаж/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Переїзд/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Доставка/ })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Інше/ })).toBeVisible();
    
    // Check description field in Ukrainian
    await expect(page.getByText('Детальний опис проблеми')).toBeVisible();
    
    // Check Next button in Ukrainian
    await expect(page.getByRole('button', { name: 'Далі' })).toBeVisible();
  });

  test('Multi-Step Form navigation - Next button advances step', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
    
    // Fill required description field (min 10 chars)
    const descriptionField = page.locator('textarea').first();
    await descriptionField.fill('I need help fixing a leaky faucet in my bathroom');
    
    // Click Next button
    const nextButton = page.getByRole('button', { name: 'Next' });
    await nextButton.click();
    
    // Should advance to Step 2 - Address
    await expect(page.getByText('Service Address')).toBeVisible({ timeout: 5000 });
  });

  test('Multi-Step Form Step 2 - Address fields in English', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
    
    // Fill Step 1
    const descriptionField = page.locator('textarea').first();
    await descriptionField.fill('I need help fixing a leaky faucet');
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Step 2 should show address form in English
    await expect(page.getByText('Service Address')).toBeVisible({ timeout: 5000 });
    
    // Check address fields in English
    await expect(page.getByText('City')).toBeVisible();
    await expect(page.getByText('Street and building number')).toBeVisible();
    await expect(page.getByText('Apartment / Office')).toBeVisible();
    await expect(page.getByText('Notes for tasker')).toBeVisible();
  });

  test('Multi-Step Form Back button returns to previous step', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
    
    // Fill Step 1 and go to Step 2
    const descriptionField = page.locator('textarea').first();
    await descriptionField.fill('I need help fixing a leaky faucet');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Service Address')).toBeVisible({ timeout: 5000 });
    
    // Click Back button
    const backButton = page.getByRole('button', { name: 'Back' });
    await backButton.click();
    
    // Should return to Step 1
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
  });

  test('Multi-Step Form progress bar shows 5 steps', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    
    // Check progress indicators in English
    await expect(page.getByText('Details')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Address')).toBeVisible();
    await expect(page.getByText('Time')).toBeVisible();
    await expect(page.getByText('Additional')).toBeVisible();
    await expect(page.getByText('Confirm')).toBeVisible();
  });

  test('Multi-Step Form modal can be closed', async ({ page }) => {
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 10000 });
    
    // Click on first service
    const serviceCard = page.locator('.bg-white.rounded-2xl.border.cursor-pointer').first();
    await serviceCard.click();
    await expect(page.getByText('Describe your task')).toBeVisible({ timeout: 5000 });
    
    // Close modal using X button
    const closeButton = page.locator('.fixed.inset-0 button').filter({ has: page.locator('svg') }).first();
    await closeButton.click();
    
    // Modal should close, back to services
    await expect(page.getByText('All Services')).toBeVisible({ timeout: 5000 });
  });
});
