import { expect, getCredentials, test } from './fixtures';

test.describe('Templates Smoke', () => {
  test('user can open email template creation flow', async ({ page, loginAs }) => {
    test.skip(!getCredentials('user'), 'Regular user credentials not configured');

    await loginAs('user');
    await page.getByTestId('nav-settings').click();
    await page.getByTestId('settings-tab-email').click();

    await page.getByRole('button', { name: /create template|add template|new template/i }).first().click();

    await expect(page.getByTestId('template-modal')).toBeVisible();
    await expect(page.getByTestId('template-name-input')).toBeVisible();
    await expect(page.getByTestId('template-subject-input')).toBeVisible();
    await expect(page.getByTestId('template-body-input')).toBeVisible();
    await expect(page.getByTestId('template-select-all-users')).toBeVisible();
    await expect(page.getByTestId('template-save-draft-button')).toBeVisible();
    await expect(page.getByTestId('template-submit-approval-button')).toBeVisible();
  });
});
