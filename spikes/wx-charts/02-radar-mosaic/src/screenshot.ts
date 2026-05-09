/**
 * Render spike-output.html via headless chromium and save a PNG
 * screenshot for quick visual inspection. The user opens
 * spike-output.html in their own browser for the real check.
 *
 * Lifted from Spike 1's screenshot.ts -- same pattern, same viewport.
 */

import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

async function main(): Promise<void> {
	const root = resolve(import.meta.dir, '..');
	const htmlPath = resolve(root, 'spike-output.html');
	const outPath = resolve(root, 'spike-preview.png');

	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	await page.goto(`file://${htmlPath}`);
	await page.waitForLoadState('networkidle');
	const svg = page.locator('.chart svg');
	await svg.screenshot({ path: outPath });
	await browser.close();
	console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
