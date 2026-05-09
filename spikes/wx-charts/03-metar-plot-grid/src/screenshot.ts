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

	// For the spike-output, also capture a 1200x780 chart-only crop that
	// matches Spikes 1+2's preview dimensions (the brief calls for
	// "1200x780 screenshot via playwright -- mirror Spikes 1+2"). The
	// footer with legends sits below.
	if (target === 'spike-output') {
		const box = await svg.boundingBox();
		if (box) {
			await page.screenshot({
				path: resolve(root, 'spike-preview-1200x780.png'),
				clip: { x: box.x, y: box.y, width: 1200, height: 780 },
			});
			console.log(`Wrote spike-preview-1200x780.png (chart-only, matches Spikes 1+2 dims)`);
		}
	}

	await browser.close();
	console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
