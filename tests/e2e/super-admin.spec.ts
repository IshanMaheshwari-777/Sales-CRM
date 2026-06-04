import { expect, getCredentials, test } from './fixtures';

test.describe('Super Admin Smoke', () => {
  test('organization switcher opens and closes without blocking the app', async ({ page, loginAs }) => {
    test.skip(!getCredentials('super_admin'), 'Super admin credentials not configured');

    await loginAs('super_admin');

    const trigger = page.getByTestId('organization-switcher-trigger');
    await expect(trigger).toBeVisible();

    if (await trigger.isDisabled()) {
      return;
    }

    await trigger.click();
    await expect(page.getByTestId('organization-switcher-menu')).toBeVisible();
    await expect(page.locator('[data-testid^="organization-switcher-option-"]').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('organization-switcher-menu')).toBeHidden();

    await page.getByTestId('nav-admin').click();
    await expect(page.getByText(/Admin Dashboard/).first()).toBeVisible();
  });
});
