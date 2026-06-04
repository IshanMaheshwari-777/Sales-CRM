import { chromium } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4175';
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL;
const superAdminPassword = process.env.E2E_SUPER_ADMIN_PASSWORD;
const userEmail = process.env.E2E_USER_EMAIL;
const userPassword = process.env.E2E_USER_PASSWORD;

if (!superAdminEmail || !superAdminPassword || !userEmail || !userPassword) {
  throw new Error('Missing E2E_SUPER_ADMIN_* or E2E_USER_* credentials');
}

const findings = [];

function recordFinding(module, title, severity, details) {
  findings.push({ module, title, severity, details });
  console.log(`[finding][${severity}][${module}] ${title}: ${details}`);
}

async function attachObservers(page, label) {
  page.on('pageerror', (error) => {
    recordFinding(label, 'Unhandled page error', 'P1', error.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('Failed to load resource')) {
        recordFinding(label, 'Console error', 'P2', text);
      }
    }
  });
  page.on('response', async (response) => {
    if (response.status() >= 400) {
      const url = response.url();
      if (!url.includes('favicon') && !url.includes('playwright')) {
        recordFinding(label, `HTTP ${response.status()}`, 'P2', url);
      }
    }
  });
}

async function login(page, email, password) {
  await page.goto(baseURL);
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-login-submit').click();
  await page.getByTestId('app-sidebar').waitFor({ state: 'visible' });
}

async function logout(page) {
  await page.getByTestId('header-user-menu-toggle').click();
  await page.getByTestId('header-sign-out-button').click();
  await page.getByTestId('auth-login-view').waitFor({ state: 'visible' });
}

async function checkSuperAdminSweep(page) {
  await page.getByTestId('nav-analytics').click();
  await page.getByText(/System Analytics/i).first().waitFor();

  await page.getByTestId('nav-bulk-actions').click();
  await page.getByText(/Bulk Actions/i).first().waitFor();

  await page.getByTestId('nav-workflow').click();
  await page.getByTestId('workflow-create-button').click();
  await page.getByTestId('workflow-modal').waitFor();
  await page.getByRole('button', { name: /Create Workflow/i }).last().click();
  await page.getByText(/Workflow name is required/i).waitFor();
  await page.getByTestId('workflow-modal').getByRole('button').first().click();
  await page.getByTestId('workflow-modal').waitFor({ state: 'hidden' });

  await page.getByTestId('nav-admin').click();
  await page.getByRole('button', { name: /Invitations/i }).click();
  await page.getByTestId('admin-invite-user-button').waitFor();
  await page.getByRole('button', { name: /Roles & Permissions/i }).click();
  await page.getByText(/Roles & Permissions/i).first().waitFor();
  await page.getByRole('button', { name: /Team Management/i }).click();
  await page.getByText(/Team Management/i).first().waitFor();
  await page.getByRole('button', { name: /Assignment Rules/i }).click();
  await page.getByText(/Assignment Rules/i).first().waitFor();
  await page.getByRole('button', { name: /Webhook Integrations/i }).click();
  await page.getByText(/Webhook Integrations/i).first().waitFor();

  await page.getByTestId('nav-super-admin').click();
  await page.getByText(/Super Admin Dashboard/i).first().waitFor();

  const orgSwitcher = page.getByRole('button', { name: /Default Organization/i });
  if (await orgSwitcher.count()) {
    const isDisabled = await orgSwitcher.isDisabled();
    if (!isDisabled) {
      await orgSwitcher.click();
    }
    const optionCount = isDisabled ? 0 : await page.locator('[data-testid^=\"organization-switcher-option-\"]').count();
    if (!isDisabled && optionCount === 0) {
      recordFinding('Super Admin Dashboard', 'Org switcher opens with no options', 'P2', 'Organization switcher is visible but exposes no selectable organizations.');
    }
    if (!isDisabled) {
      await page.keyboard.press('Escape');
    }
    const blockingOverlay = page.locator('div.fixed.inset-0.z-40');
    if (await blockingOverlay.count()) {
      const visible = await blockingOverlay.first().isVisible().catch(() => false);
      if (visible) {
        recordFinding('Super Admin Dashboard', 'Org switcher backdrop blocks page interactions', 'P1', 'After opening the organization switcher, the full-screen overlay remains active and intercepts clicks on the rest of the CRM.');
        await page.reload();
      }
    }
  }
}

async function checkTeamLeadSweep(page) {
  await page.getByTestId('nav-settings').click();
  await page.getByTestId('settings-tab-email').click();
  await page.getByRole('button', { name: /Create/i }).first().click();
  await page.getByTestId('template-modal').waitFor();
  await page.getByTestId('template-modal-close').click();

  await page.getByTestId('nav-followups').click();
  await page.getByText(/Follow-ups Manager/i).first().waitFor();

  await page.getByTestId('nav-leads').click();
  await page.getByTestId('header-add-lead-button').click();
  await page.getByTestId('add-lead-mobile').fill('12345');
  await page.getByTestId('add-lead-email').click();
  await page.getByText(/Mobile number must be \+91 followed by 10 digits/i).waitFor();
  await page.getByTestId('add-lead-close').click();
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await attachObservers(page, 'Global');

try {
  console.log('Running super admin exploratory sweep...');
  await login(page, superAdminEmail, superAdminPassword);
  await checkSuperAdminSweep(page);
  await logout(page);

  console.log('Running team lead exploratory sweep...');
  await login(page, userEmail, userPassword);
  await checkTeamLeadSweep(page);
  await logout(page);
} finally {
  await context.close();
  await browser.close();
}

console.log('\n=== SUMMARY ===');
if (findings.length === 0) {
  console.log('No exploratory findings recorded.');
} else {
  for (const finding of findings) {
    console.log(`${finding.severity} | ${finding.module} | ${finding.title} | ${finding.details}`);
  }
}
