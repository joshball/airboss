/**
 * Chrome bands carry the per-chart provenance + framing. Title /
 * subtitle / source attribution / library version all surface to the
 * learner; a regression ('library_version was an empty string in the
 * footer') wouldn't crash but would silently degrade the chart's
 * usefulness as a referenceable artifact.
 */

import { describe, expect, it } from 'vitest';
import { buildChrome } from '../chrome';

describe('buildChrome()', () => {
	it('renders title (uppercased) and subtitle in the title band', () => {
		const result = buildChrome({
			title: 'Surface Analysis',
			subtitle: 'WPC -- 2024-12-23 12Z',
		});
		expect(result.titleBand).toContain('SURFACE ANALYSIS');
		expect(result.titleBand).toContain('WPC -- 2024-12-23 12Z');
	});

	it('renders right-aligned title + subtitle when supplied', () => {
		const result = buildChrome({
			title: 'Radar',
			rightTitle: 'CONUS - Lambert Conformal 33/45',
			rightSubtitle: 'spike prototype',
		});
		expect(result.titleBand).toContain('CONUS - Lambert Conformal 33/45');
		expect(result.titleBand).toContain('spike prototype');
		expect(result.titleBand).toContain('text-anchor="end"');
	});

	it('embeds library version in the footer band when supplied', () => {
		const result = buildChrome({
			title: 'X',
			sourceAttribution: 'WPC archive',
			libraryVersion: '@ab/wx-charts@0.1.0',
		});
		expect(result.footerBand).toContain('WPC archive');
		expect(result.footerBand).toContain('@ab/wx-charts@0.1.0');
	});

	it('omits the footer band when no footer field is set', () => {
		const result = buildChrome({ title: 'X' });
		expect(result.footerBand).toBe('');
	});

	it('escapes XML entities in user-supplied strings', () => {
		const result = buildChrome({
			title: '<bad>',
			subtitle: 'A & B',
		});
		expect(result.titleBand).toContain('&lt;BAD&gt;');
		expect(result.titleBand).toContain('A &amp; B');
		expect(result.titleBand).not.toContain('<bad>');
	});
});
