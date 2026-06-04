import { expect, getCredentials, test } from './fixtures';

const adminNavTargets = [
  { id: 'nav-leads', heading: /Lead Manager|Lead/ },
  { id: 'nav-followups', heading: /Follow-ups Manager|Follow-ups/ },
  { id: 'nav-analytics', heading: /System Analytics|Analytics/ },
  { id: 'nav-bulk-actions', heading: /Bulk Actions/ },
  { id: 'nav-workflow', heading: /Workflow Automation/ },
  { id: 'nav-settings', heading: /Email Templates|WhatsApp Templates/ },
  { id: 'nav-admin', heading: /Admin Dashboard/ },
];

test.describe('Navigation Smoke', () => {
  test('admin can open major CRM modules', async ({ page, loginAs }) => {
    test.skip(!getCredentials('admin'), 'Admin credentials not configured');

    await loginAs('admin');

    for (const target of adminNavTargets) {
      await page.getByTestId(target.id).click();
      await expect(page.getByText(target.heading).first()).toBeVisible();
    }
  });
});
