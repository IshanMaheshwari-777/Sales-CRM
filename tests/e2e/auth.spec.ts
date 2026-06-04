import { expect, getCredentials, test } from './fixtures';

test.describe('Auth and Session', () => {
  test('renders login and forgot-password entry points', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('auth-login-view')).toBeVisible();
    await expect(page.getByTestId('auth-email-input')).toBeVisible();
    await expect(page.getByTestId('auth-password-input')).toBeVisible();

    await page.getByTestId('auth-forgot-password-trigger').click();
    await expect(page.getByTestId('auth-forgot-password-view')).toBeVisible();
    await expect(page.getByTestId('auth-reset-email-input')).toBeVisible();
  });

  test('admin can sign in and sign out', async ({ page, loginAs }) => {
    test.skip(!getCredentials('admin'), 'Admin credentials not configured');

    await loginAs('admin');
    await expect(page.getByTestId('nav-leads')).toBeVisible();

    await page.getByTestId('header-user-menu-toggle').click();
    await page.getByTestId('header-sign-out-button').click();

    await expect(page.getByTestId('auth-login-view')).toBeVisible();
  });
});
