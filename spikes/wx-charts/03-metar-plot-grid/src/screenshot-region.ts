/**
 * Capture a higher-resolution screenshot of a region of the chart
 * (Northeast / Florida) to inspect dense-glyph behavior closely.
 */

import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

async function main(): Promise<void> {
	const root = resolve(import.meta.dir, '..');
	const htmlPath = resolve(root, 'spike-output.html');
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 3000, height: 2000 }, deviceScaleFactor: 2 });
	const page = await context.newPage();
	await page.goto(`file://${htmlPath}`);
	await page.waitForLoadState('networkidle');
	const svg = page.locator('svg').first();
	// Use page.screenshot with explicit clip in viewport coords.
	// First, get SVG bounding box in viewport coords.
	const box = await svg.boundingBox();
	if (!box) throw new Error('no svg bbox');
	console.log(`SVG bbox: ${JSON.stringify(box)}`);
	// Northeast region: in SVG coords approx x=860..1080, y=240..420 (NJ/NY/CT/MA)
	await page.screenshot({
		path: resolve(root, 'spike-zoom-northeast.png'),
		clip: {
			x: box.x + 860,
			y: box.y + 240,
			width: 240,
			height: 200,
		},
	});
	// Also capture Florida (MIA/MCO/TPA cluster)
	await page.screenshot({
		path: resolve(root, 'spike-zoom-florida.png'),
		clip: {
			x: box.x + 760,
			y: box.y + 540,
			width: 220,
			height: 200,
		},
	});
	await browser.close();
	console.log('Wrote spike-zoom-full.png and spike-zoom-northeast.png');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
