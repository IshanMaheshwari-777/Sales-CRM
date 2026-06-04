import { expect, test as base, type Page } from '@playwright/test';

export type UserRole = 'user' | 'admin' | 'super_admin';

type RoleCredentials = {
  email: string;
  password: string;
};

type TestFixtures = {
  loginAs: (role: UserRole) => Promise<void>;
};

export function getCredentials(role: UserRole): RoleCredentials | null {
  const keyPrefix =
    role === 'user'
      ? 'E2E_USER'
      : role === 'admin'
        ? 'E2E_ADMIN'
        : 'E2E_SUPER_ADMIN';

  const email = process.env[`${keyPrefix}_EMAIL`];
  const password = process.env[`${keyPrefix}_PASSWORD`];

  if (!email || !password) {
    return null;
  }

  return { email, password };
}

async function loginWithCredentials(page: Page, credentials: RoleCredentials) {
  await page.goto('/');
  await page.getByTestId('auth-email-input').fill(credentials.email);
  await page.getByTestId('auth-password-input').fill(credentials.password);
  await page.getByTestId('auth-login-submit').click();
  await expect(page.getByTestId('app-sidebar')).toBeVisible();
}

export const test = base.extend<TestFixtures>({
  loginAs: async ({ page }, use) => {
    await use(async (role: UserRole) => {
      const credentials = getCredentials(role);
      if (!credentials) {
        throw new Error(`Missing credentials for ${role}. Set the matching E2E_*_EMAIL and E2E_*_PASSWORD values.`);
      }

      await loginWithCredentials(page, credentials);
    });
  },
});

export { expect };
