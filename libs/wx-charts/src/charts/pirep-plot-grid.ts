/**
 * PIREP plot-grid chart renderer.
 *
 * Composes the substrate (basemap + projection + graticule + chrome +
 * layer-band composer) with PIREP glyphs at every reported observation.
 * Pairwise repulsion via `point/collision` keeps overlapping reports
 * legible; displaced reports leave a leader line back to their true
 * position.
 *
 * Source data shape (the spec.yaml's `reports` source):
 *
 *   {
 *     "targetTimestamp": "2024-05-21T22:00:00Z",
 *     "source": "...",
 *     "reports": [
 *       {
 *         "raw": "KCLE UA /OV CLE090030/TM 1538/FL080/TP B737/TB MOD 060-080",
 *         "lat": 41.5,         // resolved by the source author when OV
 *         "lon": -81.6,        //   uses a station+radial+distance form
 *         "observedAt": "2024-05-21T15:38:00Z"
 *       },
 *       ...
 *     ]
 *   }
 *
 * The PIREP parser captures the `OV` block (station + optional radial /
 * distance), but lon/lat resolution requires a station-coord lookup that
 * lives outside the parser. The source envelope provides the resolved
 * lon/lat per report; the renderer projects those directly. (Future
 * work could add a station-coord lookup library; for v1 the source
 * author resolves coords manually -- consistent with the manual-capture
 * authoring flow per spec.md.)
 *
 * Pure function: bytes in, SVG string out. The CLI handles file I/O.
 *
 * Browser-safe: pure d3-geo + library substrate, no Node imports.
 */

import { CHART_TYPES, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { type CollisionPoint, resolveCollisions } from '../point/collision';
import { renderLeaderLines } from '../point/leader-lines';
import { type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { renderPirepGlyph } from '../symbology/pirep-glyph';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { parsePirep } from '../wx/pirep/parser';

// ----------------------------------------------------------------------
// Spec schema
// ----------------------------------------------------------------------

const projectionSchema = z.object({
	kind: z.literal('lambert'),
	parallels: z.tuple([z.number(), z.number()]),
	rotate: z.tuple([z.number(), z.number()]),
});

const extentSchema = z.union([
	z.literal('conus'),
	z.literal('alaska'),
	z.literal('hawaii'),
	z.object({
		lon_min: z.number(),
		lat_min: z.number(),
		lon_max: z.number(),
		lat_max: z.number(),
	}),
]);

const pirepPlotGridOptionsSchema = z.object({
	/** Pairwise repulsion min distance (px). Default 28 (smaller than METAR; fewer fields per glyph). */
	collision_min_distance_px: z.number().int().positive().default(28),
	/** Max repulsion iterations. Default 40. */
	collision_max_iterations: z.number().int().positive().default(40),
	/** Show the FL altitude label below each glyph. Default true. */
	show_altitude_label: z.boolean().default(true),
	/** Show the legend (icon key) in the footer band. Default true. */
	show_legend: z.boolean().default(true),
	/** Footer attribution; defaults to the source envelope's `source` field if available. */
	source_attribution: z.string().optional(),
});

export const pirepPlotGridSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.PIREP_PLOT_GRID),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		reports: z.string(),
	}),
	options: pirepPlotGridOptionsSchema.optional(),
});

export type PirepPlotGridSpec = z.infer<typeof pirepPlotGridSpecSchema> & ChartSpec;

// ----------------------------------------------------------------------
// Source-data shape
// ----------------------------------------------------------------------

const pirepReportSchema = z.object({
	raw: z.string().min(1),
	lat: z.number(),
	lon: z.number(),
	observedAt: z.string().optional(),
});

const pirepEnvelopeSchema = z.object({
	targetTimestamp: z.string().optional(),
	source: z.string().optional(),
	fetchedAt: z.string().optional(),
	count: z.number().int().nonnegative().optional(),
	reports: z.array(pirepReportSchema),
});

type PirepEnvelope = z.infer<typeof pirepEnvelopeSchema>;

// ----------------------------------------------------------------------
// Footer chrome layout
// ----------------------------------------------------------------------

const FOOTER_HEIGHT = 110;
const TOTAL_HEIGHT = SVG_HEIGHT + FOOTER_HEIGHT;

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

// ----------------------------------------------------------------------
// Renderer entry point
// ----------------------------------------------------------------------

export async function renderPirepPlotGrid(input: ChartRenderInput<PirepPlotGridSpec>): Promise<ChartRenderResult> {
	const opts = pirepPlotGridOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source envelope.
	const envelopeBytes = input.sources.reports;
	if (envelopeBytes === undefined) {
		throw new Error("pirep-plot-grid: required source 'reports' missing from input.sources");
	}
	const envelopeText = decodeSourceText(envelopeBytes);
	const envelope: PirepEnvelope = pirepEnvelopeSchema.parse(JSON.parse(envelopeText));

	// 2. Parse every PIREP body. Failures emit a warning + skip the report
	//    rather than aborting the whole chart.
	const parserWarnings: string[] = [];
	const parsed = envelope.reports
		.map((report, idx) => {
			try {
				const p = parsePirep(report.raw);
				if (p.warnings.length > 0) {
					for (const w of p.warnings) {
						parserWarnings.push(`${p.station}: ${w}`);
					}
				}
				return { report, parsed: p, idx };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				parserWarnings.push(`report #${idx}: parse failed -- ${message}`);
				return null;
			}
		})
		.filter(
			(
				entry,
			): entry is { report: z.infer<typeof pirepReportSchema>; parsed: ReturnType<typeof parsePirep>; idx: number } =>
				entry !== null,
		);

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapFile(input.basemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson);

	// 4. Projection.
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 5. Project every report to screen-space.
	const projected = parsed
		.map((entry) => {
			const xy = projection([entry.report.lon, entry.report.lat]);
			if (xy === null || Number.isNaN(xy[0]) || Number.isNaN(xy[1])) return null;
			return { ...entry, x: xy[0], y: xy[1] };
		})
		.filter((p): p is (typeof parsed)[number] & { x: number; y: number } => p !== null);

	// 6. Pairwise collision avoidance. Use the report's index in the
	//    envelope as the collision key -- the same station can issue
	//    multiple PIREPs (different times / altitudes), so the ICAO is
	//    not unique.
	const collisionPoints: CollisionPoint[] = projected.map((p) => ({
		id: `pirep-${p.idx}`,
		x: p.x,
		y: p.y,
	}));
	const collisionResult = resolveCollisions({
		points: collisionPoints,
		minDistance: opts.collision_min_distance_px,
		maxIterations: opts.collision_max_iterations,
	});
	const placedById = new Map(collisionResult.placed.map((pp) => [pp.id, pp]));
	if (collisionResult.unresolved.length > 0) {
		parserWarnings.push(
			`collision: ${collisionResult.unresolved.length} pair(s) remain inside ${opts.collision_min_distance_px}px after ${collisionResult.iterations} iterations`,
		);
	}

	// 7. Build per-band fragments.
	const bands: LayerBandMap = {};
	bands[LAYER_BANDS.BACKGROUND] = `<rect x="0" y="0" width="${SVG_WIDTH}" height="${TOTAL_HEIGHT}" fill="#fafaf7" />
<line x1="0" y1="${SVG_HEIGHT}" x2="${SVG_WIDTH}" y2="${SVG_HEIGHT}" stroke="#d8d4c8" stroke-width="0.6" />`;
	bands[LAYER_BANDS.GRATICULE] = renderGraticule(projection);
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;

	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderLeaderLines(collisionResult.leaders);

	const glyphFragments = projected.map((p) => {
		const placed = placedById.get(`pirep-${p.idx}`);
		if (placed === undefined) return '';
		return renderPirepGlyph(
			{
				parsed: p.parsed,
				cx: placed.x,
				cy: placed.y,
				trueX: placed.displaced ? placed.originalX : undefined,
				trueY: placed.displaced ? placed.originalY : undefined,
			},
			{ showAltitudeLabel: opts.show_altitude_label },
		);
	});
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = glyphFragments.join('\n');

	// Chrome -- title + footer legend strip.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? envelope.source ?? 'PIREPs (UA/UUA)',
		libraryVersion: input.libraryVersion,
		height: TOTAL_HEIGHT,
	});

	const legendFragment = opts.show_legend ? renderPirepLegend() : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands, { height: TOTAL_HEIGHT, viewBox: `0 0 ${SVG_WIDTH} ${TOTAL_HEIGHT}` });

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: collisionResult.leaders.length,
				[LAYER_BANDS.POINT_SYMBOLOGY]: glyphFragments.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}

// ----------------------------------------------------------------------
// PIREP icon legend (footer)
// ----------------------------------------------------------------------

function renderPirepLegend(): string {
	const x0 = 24;
	const y0 = SVG_HEIGHT + 5;
	const w = SVG_WIDTH - 48;
	const h = FOOTER_HEIGHT - 10;

	// Legend rows: turbulence + icing intensity scales side-by-side.
	const turbX = x0 + 14;
	const icingX = x0 + 280;
	const skyX = x0 + 540;
	const labelStart = 28;

	return `<g class="footer-pirep-legend">
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">PIREP ICONS</text>

  <text x="${turbX}" y="${y0 + 36}" font-size="9" font-weight="600" fill="#3d3a32">TURBULENCE (TB)</text>
  ${renderLegendIconRow(
		turbX,
		y0 + 48,
		[
			{ label: 'LGT', svg: '<path d="M -7 7 L 7 7 L 0 -7 Z" fill="none" stroke="#b5651d" stroke-width="1.1" />' },
			{ label: 'MOD', svg: '<path d="M -7 7 L 7 7 L 0 -7 Z" fill="#b5651d" stroke="#b5651d" stroke-width="1.1" />' },
			{
				label: 'SEV',
				svg: '<path d="M -7 7 L 7 7 L 0 -7 Z" fill="#b5651d" stroke="#b5651d" stroke-width="1.1" /><g transform="translate(0,-8)"><path d="M -6 6 L 6 6 L 0 -6 Z" fill="none" stroke="#b5651d" stroke-width="1.1" /></g>',
			},
		],
		labelStart,
	)}

  <text x="${icingX}" y="${y0 + 36}" font-size="9" font-weight="600" fill="#3d3a32">ICING (IC)</text>
  ${renderLegendIconRow(
		icingX,
		y0 + 48,
		[
			{
				label: 'RIME',
				svg: '<polyline points="-7,2.5 -3.5,-2.5 0,2.5 3.5,-2.5 7,2.5" fill="none" stroke="#2c5f9b" stroke-width="1.2" />',
			},
			{
				label: 'MX',
				svg: '<polyline points="-7,2.5 -3.5,-2.5 0,2.5 3.5,-2.5 7,2.5" fill="none" stroke="#2c5f9b" stroke-width="1.2" /><circle cx="-7" cy="6" r="1.2" fill="#2c5f9b" /><circle cx="7" cy="6" r="1.2" fill="#2c5f9b" />',
			},
			{
				label: 'CLR',
				svg: '<polyline points="-7,2.5 -3.5,-2.5 0,2.5 3.5,-2.5 7,2.5" fill="none" stroke="#2c5f9b" stroke-width="1.2" /><circle cx="-7" cy="6" r="1.6" fill="none" stroke="#2c5f9b" stroke-width="0.8" /><circle cx="7" cy="6" r="1.6" fill="none" stroke="#2c5f9b" stroke-width="0.8" />',
			},
		],
		labelStart,
	)}

  <text x="${skyX}" y="${y0 + 36}" font-size="9" font-weight="600" fill="#3d3a32">SKY COVER (SK)</text>
  ${renderLegendIconRow(
		skyX,
		y0 + 48,
		[
			{ label: 'CLR', svg: '<circle cx="0" cy="0" r="3.5" fill="white" stroke="#1f1d18" stroke-width="0.8" />' },
			{
				label: 'SCT',
				svg: '<circle cx="0" cy="0" r="3.5" fill="white" stroke="#1f1d18" stroke-width="0.8" /><path d="M 0 0 L 0 -3.5 A 3.5 3.5 0 0 1 0 3.5 Z" fill="#1f1d18" />',
			},
			{
				label: 'BKN',
				svg: '<circle cx="0" cy="0" r="3.5" fill="white" stroke="#1f1d18" stroke-width="0.8" /><path d="M 0 0 L 0 -3.5 A 3.5 3.5 0 1 1 -3.5 0 Z" fill="#1f1d18" />',
			},
			{ label: 'OVC', svg: '<circle cx="0" cy="0" r="3.5" fill="#1f1d18" stroke="#1f1d18" stroke-width="0.8" />' },
		],
		labelStart,
	)}

  <text x="${x0 + 10}" y="${y0 + h - 10}" font-size="8" fill="#7a7568">UUA = urgent (red halo). FL060 label = altitude in hundreds of feet (MSL).</text>
</g>`;
}

function renderLegendIconRow(
	xStart: number,
	yCenter: number,
	icons: ReadonlyArray<{ label: string; svg: string }>,
	stride: number,
): string {
	return icons
		.map((icon, i) => {
			const x = xStart + i * stride;
			return `<g transform="translate(${x},${yCenter})">${icon.svg}</g><text x="${x}" y="${yCenter + 18}" text-anchor="middle" font-size="8" fill="#3d3a32">${icon.label}</text>`;
		})
		.join('\n');
}

// ----------------------------------------------------------------------
// Lazy node:fs basemap reader (server path only).
// ----------------------------------------------------------------------

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { promises: { readFile: (path: string, encoding: 'utf8') => Promise<string> } };

async function readBasemapFile(path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error('pirep-plot-grid: cannot read basemap file -- no process.getBuiltinModule available');
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}
