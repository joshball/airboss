import { expect, test as setup } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEV_ACCOUNTS, DEV_PASSWORD, ROUTES } from '../../libs/constants/src';

const STORAGE = 'tests/e2e/.auth/learner.json';

setup('authenticate learner', async ({ page }) => {
	await mkdir(dirname(STORAGE), { recursive: true });

	const learner = DEV_ACCOUNTS.find((a) => a.role === 'learner');
	if (!learner) throw new Error('DEV_ACCOUNTS missing a learner role');

	await page.goto(ROUTES.LOGIN);
	await page.getByLabel('Email').fill(learner.email);
	await page.getByLabel('Password').fill(DEV_PASSWORD);
	await Promise.all([
		page.waitForURL((url) => url.pathname === ROUTES.DASHBOARD),
		page.getByRole('button', { name: /sign in/i }).click(),
	]);

	await expect(page.getByRole('heading', { name: 'Learning Dashboard' })).toBeVisible();

	await page.context().storageState({ path: STORAGE });
});
