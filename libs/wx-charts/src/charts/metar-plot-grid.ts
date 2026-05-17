/**
 * METAR plot-grid chart renderer.
 *
 * Composes the substrate (basemap + projection + graticule + chrome +
 * layer-band composer) with the dense FAA station-model glyph
 * (`renderStationModelFromMetar`) at every reported observation.
 * Pairwise repulsion via `point/collision` keeps overlapping stations
 * legible; displaced stations leave a leader line back to their true
 * position.
 *
 * Source data shape (the spec.yaml's `observations` source):
 *
 *   {
 *     "targetTimestamp": "2024-01-13T12:00:00Z",
 *     "source": "...",
 *     "fetchedAt": "...",
 *     "count": 49,
 *     "observations": [
 *       {
 *         "station": { "icao": "KSEA", "lat": 47.45, "lon": -122.31, ... },
 *         "raw": "KSEA 131153Z 09015G22KT ...",
 *         "parsed": { ParsedMetar... }   // optional pre-parsed payload
 *       },
 *       ...
 *     ]
 *   }
 *
 * The renderer always re-parses `raw` via `parseMetar` for traceability;
 * any pre-parsed payload in the source is treated as advisory only. This
 * keeps the chart deterministic against a fixed library version (the
 * parser, not the source author, is the source of truth for shape).
 *
 * Pure function: bytes in, SVG string out. The CLI handles file I/O.
 *
 * Browser-safe: pure d3-geo + library substrate, no Node imports.
 */

import { CHART_TYPES, FAA_FLIGHT_CATEGORIES, type FaaFlightCategory, LAYER_BANDS } from '@ab/constants';
import { geoPath } from 'd3-geo';
import { z } from 'zod';
import { loadConusBasemapFromString, readBasemapTopoJson, renderNorthAmericaContextLayer } from '../basemap';
import { buildChrome } from '../chrome';
import { renderGraticule } from '../graticule';
import { composeChart, type LayerBandMap } from '../layers';
import { type CollisionPoint, resolveCollisions } from '../point/collision';
import { renderLeaderLines } from '../point/leader-lines';
import { type FitTarget, lambertProjection, SVG_HEIGHT, SVG_WIDTH } from '../projection';
import { renderLegend } from '../symbology/legend';
import { renderStationModelFromMetar } from '../symbology/station-model';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { parseMetar } from '../wx/metar/parser';
import { ceilingFtAgl, flightCategory } from '../wx/rules';

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

const metarPlotGridOptionsSchema = z.object({
	/** Pairwise repulsion min distance (px) before glyphs are pushed apart. Default 36. */
	collision_min_distance_px: z.number().int().positive().default(36),
	/** Max repulsion iterations. Default 40. */
	collision_max_iterations: z.number().int().positive().default(40),
	/** Show the FAA flight-category teaching ring around the cloud-cover circle. Default true. */
	show_category_ring: z.boolean().default(true),
	/** Render the station-model legend in the footer band. Default true. */
	show_station_model_legend: z.boolean().default(true),
	/** Render the flight-category legend in the footer band. Default true. */
	show_category_legend: z.boolean().default(true),
	/** Temperature unit for the temp / dewpoint labels. Default 'F'. */
	temp_unit: z.enum(['F', 'C']).default('F'),
	/** Footer attribution; defaults to the source envelope's `source` field if available. */
	source_attribution: z.string().optional(),
});

export const metarPlotGridSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.METAR_PLOT_GRID),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		observations: z.string(),
	}),
	options: metarPlotGridOptionsSchema.optional(),
});

export type MetarPlotGridSpec = z.infer<typeof metarPlotGridSpecSchema> & ChartSpec;

// ----------------------------------------------------------------------
// Source-data shape
// ----------------------------------------------------------------------

const stationSchema = z.object({
	icao: z.string(),
	lat: z.number(),
	lon: z.number(),
	asos: z.string().optional(),
	region: z.string().optional(),
});

const observationSchema = z.object({
	station: stationSchema,
	raw: z.string().min(1),
	observedAt: z.string().optional(),
	deltaMinutes: z.number().optional(),
});

const metarEnvelopeSchema = z.object({
	targetTimestamp: z.string().optional(),
	source: z.string().optional(),
	fetchedAt: z.string().optional(),
	count: z.number().int().nonnegative().optional(),
	observations: z.array(observationSchema),
});

type MetarEnvelope = z.infer<typeof metarEnvelopeSchema>;

// ----------------------------------------------------------------------
// Footer chrome layout
// ----------------------------------------------------------------------

/**
 * Spike 03 demonstrated that legends overlap Florida / Pacific NW when
 * laid over the chart. We reserve a footer strip below the projection
 * area for legends. The total canvas grows by `FOOTER_HEIGHT` so the
 * projection itself fits into the original SVG_HEIGHT box.
 */
const FOOTER_HEIGHT = 110;
const TOTAL_HEIGHT = SVG_HEIGHT + FOOTER_HEIGHT;

const FLIGHT_CATEGORY_LEGEND_COLORS: Record<FaaFlightCategory, string> = {
	VFR: '#9ca3af',
	MVFR: '#1565c0',
	IFR: '#c62828',
	LIFR: '#6a1b9a',
};

const FLIGHT_CATEGORY_LEGEND_LABELS: Record<FaaFlightCategory, string> = {
	VFR: 'VFR -- ceil >3000 + vis >5SM',
	MVFR: 'MVFR -- ceil 1000-3000 or vis 3-5',
	IFR: 'IFR -- ceil 500-1000 or vis 1-3',
	LIFR: 'LIFR -- ceil <500 or vis <1',
};

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

// ----------------------------------------------------------------------
// Renderer entry point
// ----------------------------------------------------------------------

export async function renderMetarPlotGrid(input: ChartRenderInput<MetarPlotGridSpec>): Promise<ChartRenderResult> {
	const opts = metarPlotGridOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source envelope.
	const envelopeBytes = input.sources.observations;
	if (envelopeBytes === undefined) {
		throw new Error("metar-plot-grid: required source 'observations' missing from input.sources");
	}
	const envelopeText = decodeSourceText(envelopeBytes);
	const envelope: MetarEnvelope = metarEnvelopeSchema.parse(JSON.parse(envelopeText));

	// 2. Re-parse every METAR string via the shared parser. We always
	//    re-parse rather than trusting any pre-parsed payload in the
	//    source: the parser is the source of truth for shape, and the
	//    chart's content_hash binds output to a specific library version.
	const parserWarnings: string[] = [];
	const parsed = envelope.observations
		.map((obs) => {
			try {
				const p = parseMetar(obs.raw);
				if (p.warnings.length > 0) {
					for (const w of p.warnings) {
						parserWarnings.push(`${obs.station.icao}: ${w}`);
					}
				}
				return { obs, parsed: p };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				parserWarnings.push(`${obs.station.icao}: parse failed -- ${message}`);
				return null;
			}
		})
		.filter(
			(entry): entry is { obs: z.infer<typeof observationSchema>; parsed: ReturnType<typeof parseMetar> } =>
				entry !== null,
		);

	// 3. Basemap.
	const basemapBytes = input.sources.basemap;
	let basemapJson: string;
	if (basemapBytes !== undefined) {
		basemapJson = decodeSourceText(basemapBytes);
	} else {
		basemapJson = await readBasemapTopoJson('metar-plot-grid', input.basemapPath);
	}
	// Canada + Mexico context outlines (ADR 027 Option A). Optional --
	// tests may omit; CLI passes contextBasemapPath. When neither is
	// supplied, the layer renders empty and the chart still composes.
	const contextBytes = input.sources['basemap-context'];
	let contextJson: string | null = null;
	if (contextBytes !== undefined) {
		contextJson = decodeSourceText(contextBytes);
	} else if (input.contextBasemapPath !== undefined) {
		contextJson = await readBasemapTopoJson('metar-plot-grid', input.contextBasemapPath);
	}
	const basemap = loadConusBasemapFromString(basemapJson, null, contextJson);

	// 4. Projection (fitted to CONUS-only states; the projection sits
	//    inside the SVG_HEIGHT box so the footer strip below stays clean).
	const projection = lambertProjection({
		parallels: input.spec.projection.parallels,
		rotate: input.spec.projection.rotate,
		fitTarget: basemap.states as unknown as FitTarget,
	});
	const path = geoPath(projection);

	// 5. Project every parsed observation to screen-space.
	const projected = parsed
		.map((entry) => {
			const xy = projection([entry.obs.station.lon, entry.obs.station.lat]);
			if (xy === null || Number.isNaN(xy[0]) || Number.isNaN(xy[1])) return null;
			return { ...entry, x: xy[0], y: xy[1] };
		})
		.filter(
			(
				p,
			): p is { obs: z.infer<typeof observationSchema>; parsed: ReturnType<typeof parseMetar>; x: number; y: number } =>
				p !== null,
		);

	// 6. Pairwise collision avoidance.
	const collisionPoints: CollisionPoint[] = projected.map((p) => ({
		id: p.obs.station.icao,
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
	bands[LAYER_BANDS.NORTH_AMERICA_CONTEXT] = renderNorthAmericaContextLayer(basemap, (f) => path(f));
	bands[LAYER_BANDS.BASEMAP_FILL] = basemap.states.features
		.map((f) => `<path d="${path(f) ?? ''}" fill="#f3f1ea" stroke="none" />`)
		.join('\n');
	const interiorPath = path(basemap.stateBordersInterior);
	const outerPath = path(basemap.conusOuter);
	bands[LAYER_BANDS.BASEMAP_BORDERS] =
		`<path d="${interiorPath ?? ''}" fill="none" stroke="#bdb9ac" stroke-width="0.6" />
<path d="${outerPath ?? ''}" fill="none" stroke="#3d3a32" stroke-width="1.2" />`;

	// Vector symbology -- leader lines (drawn under the glyphs).
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = renderLeaderLines(collisionResult.leaders);

	// Point symbology -- station-model glyphs at placed coords. We also
	// stamp `flightCategory` per glyph for downstream coloring + sorting.
	const glyphFragments = projected.map((p) => {
		const placed = placedById.get(p.obs.station.icao);
		if (placed === undefined) return '';
		const cat = flightCategory(ceilingFtAgl(p.parsed.clouds), p.parsed.visibilitySM);
		return renderStationModelFromMetar(
			{
				parsed: p.parsed,
				cx: placed.x,
				cy: placed.y,
				trueX: placed.displaced ? placed.originalX : undefined,
				trueY: placed.displaced ? placed.originalY : undefined,
				flightCategory: cat,
			},
			{
				categoryRing: opts.show_category_ring ? 'show' : 'hide',
				tempUnit: opts.temp_unit,
			},
		);
	});
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = glyphFragments.join('\n');

	// Chrome -- title band on top, station-model + category legend in the
	// footer strip, source attribution + library version in the very-bottom
	// footer band emitted by `buildChrome`.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle: input.spec.subtitle,
		rightTitle: 'CONUS - Lambert Conformal 33/45',
		sourceAttribution: opts.source_attribution ?? envelope.source ?? 'METAR observations',
		libraryVersion: input.libraryVersion,
		height: TOTAL_HEIGHT,
	});

	const footerLegends = [
		opts.show_station_model_legend ? renderStationModelLegend() : '',
		opts.show_category_legend ? renderCategoryLegend() : '',
	]
		.filter((s) => s.length > 0)
		.join('\n');

	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${footerLegends}\n${chrome.footerBand}`;

	const svg = composeChart(bands, { height: TOTAL_HEIGHT, viewBox: `0 0 ${SVG_WIDTH} ${TOTAL_HEIGHT}` });

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: collisionResult.leaders.length,
				[LAYER_BANDS.POINT_SYMBOLOGY]: glyphFragments.length,
				[LAYER_BANDS.BASEMAP_FILL]: basemap.states.features.length,
				[LAYER_BANDS.NORTH_AMERICA_CONTEXT]: basemap.northAmericaContext.features.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}

// ----------------------------------------------------------------------
// Footer legends (station-model + flight-category)
// ----------------------------------------------------------------------

function renderStationModelLegend(): string {
	const x0 = 24;
	const y0 = SVG_HEIGHT + 5;
	const w = 460;
	const h = FOOTER_HEIGHT - 10;
	const legendCx = x0 + w - 80;
	const legendCy = y0 + h / 2;

	const demo: Parameters<typeof renderStationModelFromMetar>[0] = {
		parsed: {
			station: 'KDEM',
			day: 13,
			hour: 12,
			minute: 0,
			wind: { directionDeg: 270, speedKt: 25, gustKt: null, variable: false, calm: false },
			visibilitySM: 4,
			weather: ['-RA'],
			clouds: [{ cover: 'OVC', heightFtAgl: 1500, cloudType: null }],
			tempC: 5,
			dewpointC: 3,
			altimeterInHg: 30.05,
			cavok: false,
			raw: '',
			warnings: [],
		},
		cx: legendCx,
		cy: legendCy,
	};
	const demoSvg = renderStationModelFromMetar(demo);

	return `<g class="footer-station-legend">
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">STATION MODEL</text>
  <text x="${x0 + 10}" y="${y0 + 36}" font-size="9" fill="#3d3a32">temp degF (top-L)</text>
  <text x="${x0 + 10}" y="${y0 + 50}" font-size="9" fill="#3d3a32">dewpt degF (bot-L)</text>
  <text x="${x0 + 10}" y="${y0 + 64}" font-size="9" fill="#3d3a32">vis SM (left)</text>
  <text x="${x0 + 10}" y="${y0 + 78}" font-size="9" fill="#3d3a32">wx (left of circle)</text>
  <text x="${x0 + 150}" y="${y0 + 36}" font-size="9" fill="#3d3a32">altimeter (top-R)</text>
  <text x="${x0 + 150}" y="${y0 + 50}" font-size="9" fill="#3d3a32">cover -> circle fill</text>
  <text x="${x0 + 150}" y="${y0 + 64}" font-size="9" fill="#3d3a32">wind from -> shaft</text>
  <text x="${x0 + 150}" y="${y0 + 78}" font-size="9" fill="#3d3a32">barb: half=5 full=10 KT</text>
  ${demoSvg}
  <text x="${legendCx - 60}" y="${y0 + h - 6}" font-size="8" fill="#7a7568">demo: 25KT/W, OVC1500, -RA, 5C/3C, A3005</text>
</g>`;
}

function renderCategoryLegend(): string {
	const w = 380;
	const h = FOOTER_HEIGHT - 10;
	const x0 = SVG_WIDTH - 24 - w;
	const y0 = SVG_HEIGHT + 5;

	const entries: FaaFlightCategory[] = [
		FAA_FLIGHT_CATEGORIES.VFR,
		FAA_FLIGHT_CATEGORIES.MVFR,
		FAA_FLIGHT_CATEGORIES.IFR,
		FAA_FLIGHT_CATEGORIES.LIFR,
	];

	// Render via the substrate `renderLegend` helper for the rows, but
	// override per-row stroke vs fill: the FAA category teaching ring is
	// a hollow stroke, not a filled swatch. We emit a custom inline list
	// here so the legend reads as "ring color = category" rather than
	// "filled box = category."
	const rows = entries.map((cat, i) => {
		const ringY = y0 + 30 + i * 18;
		const color = FLIGHT_CATEGORY_LEGEND_COLORS[cat];
		const label = FLIGHT_CATEGORY_LEGEND_LABELS[cat];
		const ring =
			cat === FAA_FLIGHT_CATEGORIES.VFR
				? ''
				: `<circle cx="${x0 + 22}" cy="${ringY - 4}" r="6.5" fill="none" stroke="${color}" stroke-width="1.4" />`;
		return `${ring}<text x="${x0 + 38}" y="${ringY}" font-size="9" font-weight="600" fill="#3d3a32">${cat}</text>
<text x="${x0 + 78}" y="${ringY}" font-size="9" fill="#7a7568">${label.replace(/^[A-Z]+\s--\s/, '')}</text>`;
	});

	return `<g class="footer-category-legend">
  <rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="white" fill-opacity="0.94" stroke="#bdb9ac" stroke-width="0.6" rx="3" />
  <text x="${x0 + 10}" y="${y0 + 18}" font-size="10" font-weight="700" fill="#3d3a32" letter-spacing="0.6">FLIGHT CATEGORY  (RING COLOR)</text>
  ${rows.join('\n')}
</g>`;
}

// Tag the substrate-only legend helper so the linter doesn't complain
// about an unused symbol while we keep it available for future legends.
void renderLegend;

// ----------------------------------------------------------------------
// Lazy node:fs basemap reader (server path only).
// ----------------------------------------------------------------------
