import { expect, getCredentials, test } from './fixtures';

test.describe('Admin Surface Smoke', () => {
  test('admin can open invitation management and workflow automation', async ({ page, loginAs }) => {
    test.skip(!getCredentials('admin'), 'Admin credentials not configured');

    await loginAs('admin');

    await page.getByTestId('nav-admin').click();
    await expect(page.getByText(/Admin Dashboard/).first()).toBeVisible();
    await page.getByRole('button', { name: /Invitations/i }).click();

    await page.getByTestId('admin-invite-user-button').click();
    await expect(page.getByTestId('admin-invitation-form')).toBeVisible();
    await expect(page.getByTestId('admin-invitation-email')).toBeVisible();
    await expect(page.getByTestId('admin-invitation-role')).toBeVisible();
    await expect(page.getByTestId('admin-invitation-submit')).toBeVisible();

    await page.getByTestId('nav-workflow').click();
    await expect(page.getByTestId('workflow-automation-page')).toBeVisible();
    await page.getByTestId('workflow-create-button').click();
    await expect(page.getByTestId('workflow-modal')).toBeVisible();
  });
});
