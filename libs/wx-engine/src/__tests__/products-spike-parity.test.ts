/**
 * Phase B test plan -- spike-parity integration (WXENG-17).
 *
 * Asserts that `generateScenario({ kind: 'frontal-xc-march' }).products`
 * matches the spike's recorded outputs at
 * `data/wx-scenarios/frontal-xc-march/products/` byte-for-byte (raw strings)
 * and deeply (AIRMETs JSON). This is the load-bearing regression test for
 * Phase B: any change to a derivation that breaks parity fails here.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateScenario } from '../engine';

const PRODUCTS_DIR = resolve(process.cwd(), 'data/wx-scenarios/frontal-xc-march/products');

function readBaseline(relativeName: string): string {
	return readFileSync(resolve(PRODUCTS_DIR, relativeName), 'utf8');
}

describe('products spike-parity (frontal-xc-march)', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });

	it('METAR raw strings match the recorded metars.txt', () => {
		const baseline = readBaseline('metars.txt').trimEnd();
		const actual = bundle.products.metars.map((m) => m.raw).join('\n');
		expect(actual).toBe(baseline);
	});

	it('TAF raw strings match the recorded tafs.txt', () => {
		const baseline = readBaseline('tafs.txt').trimEnd();
		const actual = bundle.products.tafs.map((t) => t.raw).join('\n\n');
		expect(actual).toBe(baseline);
	});

	it('FB bulletin raw string matches the recorded fb-bulletin.txt', () => {
		const baseline = readBaseline('fb-bulletin.txt').trimEnd();
		expect(bundle.products.fbGrid).not.toBeNull();
		if (bundle.products.fbGrid === null) throw new Error('unreachable');
		expect(bundle.products.fbGrid.raw.trimEnd()).toBe(baseline);
	});

	it('PIREP raw strings match the recorded pireps.txt', () => {
		const baseline = readBaseline('pireps.txt').trimEnd();
		const actual = bundle.products.pireps.map((p) => p.raw).join('\n');
		expect(actual).toBe(baseline);
	});

	it('AIRMETs deep-equal the recorded airmets.json', () => {
		const baseline = JSON.parse(readBaseline('airmets.json')) as unknown;
		expect(bundle.products.airmets).toEqual(baseline);
	});
});
