/**
 * End-to-end render test for the Phase C pirep-plot-grid chart.
 *
 * Per WP test plan WXC-32 ("PIREP plot grid renders distinct symbology
 * per intensity") + WXC-11 ("renderer is pure / no I/O").
 */

import { LAYER_BAND_VALUES, referenceFixtureChartSlug } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type PirepPlotGridSpec, renderPirepPlotGrid } from '../charts/pirep-plot-grid';

const SPEC: PirepPlotGridSpec = {
	slug: referenceFixtureChartSlug('pirep-plot-grid', '2024-05-21-22z'),
	type: 'pirep-plot-grid',
	title: 'PIREP Plot',
	subtitle: '2024-05-21 22Z',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: { reports: 'cache://pirep/2024-05-21-22z.json' },
};

const FIXTURE_ENVELOPE = JSON.stringify({
	targetTimestamp: '2024-05-21T22:00:00Z',
	source: 'in-test fixture',
	reports: [
		{ raw: 'KOKC UA /OV OKC120015/TM 2155/FL080/TP B738/TB MOD 070-090', lat: 35.39, lon: -97.6 },
		{ raw: 'KICT UUA /OV ICT060020/TM 2210/FL060/TP C172/TB SEV 050-070/RM TS', lat: 37.65, lon: -97.43 },
		{ raw: 'KMCI UA /OV MCI090030/TM 2200/FL090/TP B190/IC LGT RIME 080-100', lat: 39.3, lon: -94.71 },
		{ raw: 'KCLT UA /OV CLT030015/TM 2200/FL080/TP A320/IC MOD MX 070-090', lat: 35.21, lon: -80.94 },
		{ raw: 'KJFK UUA /OV JFK210010/TM 2225/FL050/TP C172/IC SEV CLR 040-060', lat: 40.63, lon: -73.78 },
		{ raw: 'KORD UA /OV ORD135025/TM 2150/FL130/TP B738/TB LGT', lat: 41.97, lon: -87.9 },
	],
});

const MINIMAL_BASEMAP = JSON.stringify({
	type: 'Topology',
	objects: { states: { type: 'GeometryCollection', geometries: [] } },
	arcs: [],
	transform: { scale: [1, 1], translate: [0, 0] },
});

// We need a real basemap for the projection.fitExtent call to land
// reasonable pixel coords; an empty topojson means the projection
// doesn't fit and every point projects to NaN. The test seam therefore
// reads the committed substrate basemap.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

describe('renderPirepPlotGrid (Phase C end-to-end)', () => {
	it('renders the canonical 6-report fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderPirepPlotGrid({
			spec: SPEC,
			sources: { reports: FIXTURE_ENVELOPE, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		// 6 PIREPs rendered as <g class="pirep">.
		expect((result.svg.match(/class="pirep"/g) ?? []).length).toBe(6);
		// Urgent UUA reports get a red halo.
		expect(result.svg).toContain('data-urgent="true"');
		// PIREP icon legend present in the footer.
		expect(result.svg).toContain('PIREP ICONS');
		// Title band carries the chart title (uppercased).
		expect(result.svg).toContain('PIREP PLOT');

		expect(result.meta.layer_counts['point-symbology']).toBe(6);
		expect(result.meta.parser_warnings).toEqual([]);
	});

	it('is pure: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { reports: FIXTURE_ENVELOPE, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderPirepPlotGrid(input);
		const b = await renderPirepPlotGrid(input);
		expect(a.svg).toBe(b.svg);
	});

	it('emits a warning when a report has unparseable wind', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const envelope = JSON.stringify({
			reports: [{ raw: 'KORD UA /OV ORD/TM 1500/FL090/TP B738/WV BADWIND', lat: 41.97, lon: -87.9 }],
		});
		const result = await renderPirepPlotGrid({
			spec: SPEC,
			sources: { reports: envelope, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.parser_warnings.some((w) => w.includes('WV'))).toBe(true);
	});

	it('rejects an envelope missing the reports array', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderPirepPlotGrid({
				spec: SPEC,
				sources: { reports: '{}', basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});
});

// Silence unused -- kept for future tests that exercise the empty-basemap path.
void MINIMAL_BASEMAP;
