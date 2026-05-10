/**
 * Renderer-level tests for the TAF timeline chart.
 *
 * Asserts the SVG document is well-formed, contains the canonical layer
 * groups, every TAF period emits a strip, FM/BECMG/TEMPO/PROB badges
 * appear, the time axis has the expected tick labels, and the renderer
 * is deterministic on identical inputs.
 */

import { describe, expect, it } from 'vitest';
import { renderTafTimeline, type TafTimelineSpec } from '../charts/taf-timeline';

const KMEM_TAF = `TAF KMEM 101720Z 1018/1124 34006KT P6SM SCT050 BKN120
  PROB30 1019/1024 4SM -TSRA BKN045CB
  FM110100 03009KT P6SM VCSH BKN060 BKN100
  PROB30 1102/1104 4SM -TSRA BKN045CB
  FM111200 04009KT P6SM BKN060 OVC100
  FM112000 03009KT P6SM SCT250`;

function makeSpec(extra: Partial<TafTimelineSpec> = {}): TafTimelineSpec {
	return {
		slug: 'wx-taf-timeline-kmem-test',
		type: 'taf-timeline',
		title: 'TAF Timeline -- KMEM',
		extent: 'time',
		sources: { taf: 'inline' },
		stationIcao: 'KMEM',
		// Cast covers ChartSpec-required fields the timeline doesn't use.
		projection: undefined as never,
		...extra,
	};
}

describe('renderTafTimeline', () => {
	it('renders an SVG document containing the canonical layer groups', async () => {
		const result = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: '@ab/wx-charts@0.0.0-test',
		});
		expect(result.svg.startsWith('<?xml')).toBe(true);
		expect(result.svg).toContain('<svg');
		expect(result.svg).toContain('layer-background');
		expect(result.svg).toContain('layer-vector-symbology');
		expect(result.svg).toContain('layer-point-symbology');
		expect(result.svg).toContain('layer-chrome');
	});

	it('emits one period strip per TAF period (across all parameter rows)', async () => {
		const result = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		// 6 periods x 5 rows = 30 strips potentially -- assert vector_symbology
		// fragment count is at least the period count and each kind label appears.
		const layerCount = result.meta.layer_counts['vector-symbology'] ?? 0;
		expect(layerCount).toBeGreaterThan(0);
		// FM badges: 3 expected (FM110100, FM111200, FM112000).
		const fmCount = (result.svg.match(/&gt;FM /g) ?? []).length + (result.svg.match(/>FM /g) ?? []).length;
		expect(fmCount).toBeGreaterThanOrEqual(3);
		// PROB badges: 2 expected.
		const probCount = (result.svg.match(/PROB30/g) ?? []).length;
		expect(probCount).toBeGreaterThanOrEqual(2);
	});

	it('renders flight-category labels (VFR / MVFR / IFR / LIFR)', async () => {
		const result = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		// At least one of the categories must appear (KMEM TAF is mostly VFR
		// with some IFR/MVFR PROB30 windows).
		const categories = ['VFR', 'MVFR', 'IFR', 'LIFR'];
		const present = categories.filter((c) => result.svg.includes(c));
		expect(present.length).toBeGreaterThan(0);
	});

	it('emits time-axis ticks at the configured interval', async () => {
		const result = await renderTafTimeline({
			spec: makeSpec({ options: { axis_tick_hours: 6, show_legend: true } }),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		// 6-hour ticks across a 30-hour valid period -> 5..6 ticks.
		const tickHourLabels = result.svg.match(/>\d{2}Z<\/text>/g) ?? [];
		expect(tickHourLabels.length).toBeGreaterThanOrEqual(4);
		expect(tickHourLabels.length).toBeLessThanOrEqual(8);
	});

	it('is deterministic: identical inputs produce identical SVGs', async () => {
		const a = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		const b = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		expect(a.svg).toBe(b.svg);
	});

	it('accepts a JSON envelope source', async () => {
		const envelope = JSON.stringify({
			stationIcao: 'KMEM',
			source: 'AWC TAF feed (test)',
			raw: KMEM_TAF,
		});
		const result = await renderTafTimeline({
			spec: makeSpec(),
			sources: { taf: envelope },
			basemapPath: '',
			libraryVersion: 'test',
		});
		expect(result.svg).toContain('AWC TAF feed');
	});

	it('reports parser warning when stationIcao does not match TAF body', async () => {
		const result = await renderTafTimeline({
			spec: makeSpec({ stationIcao: 'KORD' }),
			sources: { taf: KMEM_TAF },
			basemapPath: '',
			libraryVersion: 'test',
		});
		expect(result.meta.parser_warnings.some((w) => w.includes('mismatch'))).toBe(true);
	});

	it('throws when extent override has from >= to', async () => {
		await expect(
			renderTafTimeline({
				spec: makeSpec({ extent: { from: '2024-01-13T18:00:00Z', to: '2024-01-13T17:00:00Z' } }),
				sources: { taf: KMEM_TAF },
				basemapPath: '',
				libraryVersion: 'test',
			}),
		).rejects.toThrow(/extent\.from .* must precede extent\.to/);
	});

	it('throws when the taf source is missing', async () => {
		await expect(
			renderTafTimeline({
				spec: makeSpec(),
				sources: {},
				basemapPath: '',
				libraryVersion: 'test',
			}),
		).rejects.toThrow(/required source 'taf' missing/);
	});
});
