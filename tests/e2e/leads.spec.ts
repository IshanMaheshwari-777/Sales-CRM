import { expect, getCredentials, test } from './fixtures';

test.describe('Lead Manager Smoke', () => {
  test('admin can open the add lead modal and inspect key fields', async ({ page, loginAs }) => {
    test.skip(!getCredentials('admin'), 'Admin credentials not configured');

    await loginAs('admin');
    await page.getByTestId('nav-leads').click();
    await page.getByTestId('header-add-lead-button').click();

    await expect(page.getByTestId('add-lead-modal')).toBeVisible();
    await expect(page.getByTestId('add-lead-first-name')).toBeVisible();
    await expect(page.getByTestId('add-lead-last-name')).toBeVisible();
    await expect(page.getByTestId('add-lead-email')).toBeVisible();
    await expect(page.getByTestId('add-lead-mobile')).toBeVisible();

    await page.getByTestId('add-lead-tab-source_details').click();
    await expect(page.getByTestId('add-lead-channel')).toBeVisible();
    await expect(page.getByTestId('add-lead-source')).toBeVisible();
    await expect(page.getByTestId('add-lead-campaign-name')).toBeVisible();
  });
});
