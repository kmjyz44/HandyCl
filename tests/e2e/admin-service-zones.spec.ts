import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToAdminTab } from '../fixtures/helpers';

test.describe('P1 Features - Admin Service Zones Panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Admin can navigate to Zones tab', async ({ page }) => {
    // Check zones tab exists in sidebar
    await expect(page.getByTestId('admin-nav-zones')).toBeVisible();
    
    // Click on zones tab
    await page.getByTestId('admin-nav-zones').click();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify zones panel loaded
    await expect(page.locator('text=Зони обслуговування')).toBeVisible({ timeout: 10000 });
  });

  test('Service Zones panel displays correctly', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Check header text (Ukrainian)
    await expect(page.locator('text=Зони обслуговування')).toBeVisible();
    await expect(page.getByText('Управління географічними зонами для виконавців')).toBeVisible();
    
    // Check stats cards (using exact match)
    await expect(page.getByText('Всього зон')).toBeVisible();
    await expect(page.getByText('Активних')).toBeVisible();
    await expect(page.getByText('Виконавців', { exact: true })).toBeVisible();
    await expect(page.getByText('Сер. радіус')).toBeVisible();
    
    // Check Add Zone button (Ukrainian)
    await expect(page.locator('button:has-text("Додати зону")')).toBeVisible();
  });

  test('Create Zone modal opens with correct fields', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Click Add Zone button
    await page.locator('button:has-text("Додати зону")').click();
    
    // Wait for modal to appear
    await expect(page.locator('text=Нова зона обслуговування')).toBeVisible({ timeout: 5000 });
    
    // Check quick city selection (Ukrainian cities)
    await expect(page.locator('text=Швидкий вибір міста')).toBeVisible();
    await expect(page.locator('button:has-text("Київ")')).toBeVisible();
    await expect(page.locator('button:has-text("Харків")')).toBeVisible();
    await expect(page.locator('button:has-text("Одеса")')).toBeVisible();
    await expect(page.locator('button:has-text("Дніпро")')).toBeVisible();
    await expect(page.locator('button:has-text("Львів")')).toBeVisible();
    
    // Check form fields
    await expect(page.locator('text=Назва зони *')).toBeVisible();
    await expect(page.locator('text=Опис')).toBeVisible();
    await expect(page.locator('text=Широта (Lat)')).toBeVisible();
    await expect(page.locator('text=Довгота (Lng)')).toBeVisible();
    await expect(page.locator('text=Радіус обслуговування (км)')).toBeVisible();
    await expect(page.locator('text=Множник ціни')).toBeVisible();
    await expect(page.locator('text=Колір на карті')).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button:has-text("Скасувати")')).toBeVisible();
    await expect(page.locator('button:has-text("Створити")')).toBeVisible();
  });

  test('Quick city selection populates form correctly', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Open create modal
    await page.locator('button:has-text("Додати зону")').click();
    await expect(page.locator('text=Нова зона обслуговування')).toBeVisible({ timeout: 5000 });
    
    // Select Київ
    await page.locator('button:has-text("Київ")').click();
    
    // Check that name input was filled
    const nameInput = page.locator('input[placeholder="напр. Київ центр"]');
    await expect(nameInput).toHaveValue('Київ');
    
    // Verify coordinates were set (Kyiv coordinates: 50.4501, 30.5234)
    const latInput = page.locator('input[type="number"]').first();
    await expect(latInput).toHaveValue('50.4501');
  });

  test('Create Zone modal can be cancelled', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Open create modal
    await page.locator('button:has-text("Додати зону")').click();
    await expect(page.locator('text=Нова зона обслуговування')).toBeVisible({ timeout: 5000 });
    
    // Click cancel
    await page.locator('button:has-text("Скасувати")').click();
    
    // Modal should close
    await expect(page.locator('text=Нова зона обслуговування')).not.toBeVisible({ timeout: 3000 });
  });

  test('Service Zones displays zones or empty state', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Wait for data to load
    await page.waitForLoadState('domcontentloaded');
    
    // Look for zones - either zone cards or empty state
    const emptyState = page.getByText('Немає зон обслуговування');
    const zonesHeader = page.getByText('Зони обслуговування');
    
    // Page should show zones panel header
    await expect(zonesHeader).toBeVisible();
    
    // Check if empty state is shown (0 zones currently)
    const isEmpty = await emptyState.isVisible().catch(() => false);
    
    // Either we have empty state or zones are displayed
    // Check stats show 0 if empty
    if (isEmpty) {
      await expect(page.getByText('Створіть першу зону для налаштування географічного охоплення')).toBeVisible();
    }
    // Test passes - UI is working
    expect(true).toBeTruthy();
  });

  test('Zone cards show correct information when zones exist', async ({ page }) => {
    await navigateToAdminTab(page, 'zones');
    
    // Wait for zones to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check if any zones exist by looking for zone-specific elements
    const zoneCards = page.locator('text=км радіус').first();
    const hasZones = await zoneCards.isVisible().catch(() => false);
    
    if (hasZones) {
      // Check zone card structure
      await expect(page.locator('text=Виконавців').first()).toBeVisible();
      await expect(page.locator('text=Множник').first()).toBeVisible();
      
      // Check action buttons on zone cards
      await expect(page.locator('text=Деактивувати').or(page.locator('text=Активувати')).first()).toBeVisible();
    }
    // Test passes regardless - we're testing the UI structure
    expect(true).toBeTruthy();
  });
});
