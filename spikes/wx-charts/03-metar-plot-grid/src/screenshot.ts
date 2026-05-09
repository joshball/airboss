/**
 * Headless chromium screenshot. Lifted from Spikes 1+2.
 *
 * Renders any of the spike-3 HTMLs to a PNG for inspection. By default
 * captures spike-output.html -> spike-preview.png. Pass an arg to
 * capture a different page.
 */

import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

async function main(): Promise<void> {
	const root = resolve(import.meta.dir, '..');
	const target = process.argv[2] ?? 'spike-output';
	const htmlPath = resolve(root, `${target}.html`);
	const outPath = resolve(root, `${target === 'spike-output' ? 'spike-preview' : `${target}-preview`}.png`);

	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 2400, height: 1600 }, deviceScaleFactor: 1 });
	const page = await context.newPage();
	await page.goto(`file://${htmlPath}`);
	await page.waitForLoadState('networkidle');
	const svg = page.locator('svg').first();
	await svg.screenshot({ path: outPath });
	await browser.close();
	console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
