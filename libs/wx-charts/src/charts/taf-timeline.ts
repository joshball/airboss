/**
 * TAF timeline chart renderer.
 *
 * Phase G: a 1D-plus-categorical-band visualization of a single TAF
 * across its valid period. Time runs along the X axis (UTC, with
 * vertical grid ticks every 3 hours). The chart stacks parameter bands
 * on the Y axis -- one band per output element:
 *
 *   - Wind:     direction arrow + speed label, color-encoded by intensity
 *   - Visibility: SM number + colored bar from RED (LIFR) to GREEN (VFR)
 *   - Ceiling:  AGL feet + colored bar matching flight category
 *   - Weather:  text labels for present-weather codes (RA, TS, FG, ...)
 *   - Probability: optional band labelling PROB30 / PROB40 windows
 *
 * FM / BECMG / TEMPO / PROB period boundaries surface as vertical
 * separators with badges. A footer legend strip explains the bands.
 *
 * No map projection, no basemap: the chart fully owns its substrate.
 * Reuses the layer-band composer + chrome substrate (only the title +
 * footer chrome bands; no graticule / basemap / point-symbology bands).
 *
 * Pure function: bytes in, SVG string out. The CLI handles file I/O.
 *
 * Browser-safe: pure string composition, no Node imports.
 */

import { CHART_TYPES, FAA_FLIGHT_CATEGORIES, LAYER_BANDS } from '@ab/constants';
import { z } from 'zod';
import { buildChrome } from '../chrome';
import { composeChart, type LayerBandMap } from '../layers';
import { SVG_WIDTH } from '../projection';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { computeFlightCategory, ceilingFtAgl } from '../wx/rules';
import { parseTaf } from '../wx/taf/parser';
import type { ParsedTaf, TafPeriod } from '../wx/taf/types';

// ----------------------------------------------------------------------
// Spec schema
// ----------------------------------------------------------------------

/**
 * The TAF timeline spec deliberately omits `projection` (no map) and
 * supports two `extent` shapes:
 *
 *   - `'time'` (string literal) -- valid period taken from the parsed TAF
 *   - `{ from: ISO-string, to: ISO-string }` -- explicit override (rare;
 *     useful for trimmed views or when the TAF carries no header)
 *
 * The spec is otherwise minimal: a station ICAO and a TAF source key.
 */
const extentSchema = z.union([
	z.literal('time'),
	z.object({
		from: z.string(),
		to: z.string(),
	}),
]);

const tafTimelineOptionsSchema = z.object({
	/** Show the legend strip in the footer band. Default true. */
	show_legend: z.boolean().default(true),
	/** Footer attribution; defaults to "FAA TAF". */
	source_attribution: z.string().optional(),
	/** Tick interval in hours along the time axis. Default 3. */
	axis_tick_hours: z.number().int().positive().default(3),
});

export const tafTimelineSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.TAF_TIMELINE),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	extent: extentSchema,
	sources: z.object({
		taf: z.string(),
	}),
	options: tafTimelineOptionsSchema.optional(),
	stationIcao: z.string().min(3).max(4),
});

export type TafTimelineSpec = z.infer<typeof tafTimelineSpecSchema> & ChartSpec;

// ----------------------------------------------------------------------
// Layout constants
// ----------------------------------------------------------------------

const TIMELINE_WIDTH = SVG_WIDTH;
const TIMELINE_TOTAL_HEIGHT = 720;
const TITLE_BAND_HEIGHT = 60;
const FOOTER_BAND_HEIGHT = 110;

const PLOT_MARGIN_LEFT = 110;
const PLOT_MARGIN_RIGHT = 24;
const PLOT_MARGIN_TOP = TITLE_BAND_HEIGHT + 16;
const PLOT_MARGIN_BOTTOM = FOOTER_BAND_HEIGHT + 16;
const PLOT_WIDTH = TIMELINE_WIDTH - PLOT_MARGIN_LEFT - PLOT_MARGIN_RIGHT;
const PLOT_HEIGHT = TIMELINE_TOTAL_HEIGHT - PLOT_MARGIN_TOP - PLOT_MARGIN_BOTTOM;

// Per-row band heights (px). Order: wind, visibility, ceiling, weather, probability.
const ROW_LABELS = ['Wind', 'Visibility', 'Ceiling', 'Weather', 'Probability'] as const;
const ROW_HEIGHTS = [110, 90, 90, 80, 60] as const;
const TIME_AXIS_HEIGHT = 36;

// Colors -- keep in sync with FAA flight-category convention.
const COLOR_VFR = '#2e7d32';
const COLOR_MVFR = '#1565c0';
const COLOR_IFR = '#c62828';
const COLOR_LIFR = '#6a1b9a';
const COLOR_NEUTRAL = '#3d3a32';
const COLOR_LABEL = '#7a7568';
const COLOR_RULE = '#d8d4c8';
const COLOR_BACKGROUND = '#fafaf7';
const COLOR_PERIOD_BOUNDARY = '#7a7568';
const COLOR_PERIOD_BADGE_FM = '#3d3a32';
const COLOR_PERIOD_BADGE_BECMG = '#1565c0';
const COLOR_PERIOD_BADGE_TEMPO = '#ef6c00';
const COLOR_PERIOD_BADGE_PROB = '#6a1b9a';

// Wind intensity color thresholds (knots).
const WIND_INTENSITY = {
	calm: 4,
	moderate: 12,
	strong: 22,
	gale: 34,
} as const;

// ----------------------------------------------------------------------
// Source-data shape
// ----------------------------------------------------------------------

const tafSourceSchema = z.object({
	stationIcao: z.string().optional(),
	source: z.string().optional(),
	raw: z.string().min(1),
});

type TafSource = z.infer<typeof tafSourceSchema>;

function decodeSourceText(value: Uint8Array | string): string {
	if (typeof value === 'string') return value;
	return new TextDecoder('utf-8').decode(value);
}

// ----------------------------------------------------------------------
// Renderer entry point
// ----------------------------------------------------------------------

export async function renderTafTimeline(input: ChartRenderInput<TafTimelineSpec>): Promise<ChartRenderResult> {
	const opts = tafTimelineOptionsSchema.parse(input.spec.options ?? {});

	// 1. Parse source envelope.
	const tafBytes = input.sources.taf;
	if (tafBytes === undefined) {
		throw new Error("taf-timeline: required source 'taf' missing from input.sources");
	}
	const tafText = decodeSourceText(tafBytes);

	let envelope: TafSource;
	let rawTaf: string;
	try {
		const trimmed = tafText.trim();
		// Allow either a JSON envelope or a raw TAF string.
		if (trimmed.startsWith('{')) {
			envelope = tafSourceSchema.parse(JSON.parse(trimmed));
			rawTaf = envelope.raw;
		} else {
			envelope = { raw: trimmed };
			rawTaf = trimmed;
		}
	} catch (err) {
		throw new Error(
			`taf-timeline: source 'taf' is neither a JSON envelope nor a raw TAF string -- ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	const parsed = parseTaf(rawTaf);
	const parserWarnings = [...parsed.warnings];

	// 2. Resolve the time extent.
	const extent = resolveExtent(input.spec.extent, parsed);
	if (extent.fromMs >= extent.toMs) {
		throw new Error(`taf-timeline: extent.from (${extent.from}) must precede extent.to (${extent.to})`);
	}

	// 3. Validate stationIcao matches the parsed TAF (with leniency for K-prefix).
	const expectedIcao = input.spec.stationIcao.toUpperCase();
	if (parsed.station.toUpperCase() !== expectedIcao) {
		parserWarnings.push(`stationIcao mismatch: spec='${expectedIcao}' but TAF body parsed as '${parsed.station}'`);
	}

	// 4. Build per-band fragments.
	const bands: LayerBandMap = {};

	bands[LAYER_BANDS.BACKGROUND] =
		`<rect x="0" y="0" width="${TIMELINE_WIDTH}" height="${TIMELINE_TOTAL_HEIGHT}" fill="${COLOR_BACKGROUND}" />`;

	const plot = renderTimelinePlot(parsed, extent, opts);
	bands[LAYER_BANDS.VECTOR_SYMBOLOGY] = plot.svg;

	// Period boundaries + badges sit on top of the bands.
	bands[LAYER_BANDS.POINT_SYMBOLOGY] = renderPeriodBoundaries(parsed, extent);

	// Chrome.
	const chrome = buildChrome({
		title: input.spec.title,
		subtitle:
			input.spec.subtitle ??
			`${parsed.station} - issued ${formatIsoShort(parsed.issuedAt)} - valid ${formatIsoShort(parsed.validFrom)} to ${formatIsoShort(parsed.validTo)}`,
		rightTitle: 'TAF Timeline',
		rightSubtitle: parsed.amended ? 'AMD (amended)' : parsed.corrected ? 'COR (corrected)' : undefined,
		sourceAttribution: opts.source_attribution ?? envelope.source ?? 'FAA TAF',
		libraryVersion: input.libraryVersion,
		width: TIMELINE_WIDTH,
		height: TIMELINE_TOTAL_HEIGHT,
		titleBandHeight: TITLE_BAND_HEIGHT,
		footerBandHeight: 24,
	});
	const legendFragment = opts.show_legend ? renderLegend() : '';
	bands[LAYER_BANDS.CHROME] = `${chrome.titleBand}\n${legendFragment}\n${chrome.footerBand}`;

	const svg = composeChart(bands, {
		width: TIMELINE_WIDTH,
		height: TIMELINE_TOTAL_HEIGHT,
		viewBox: `0 0 ${TIMELINE_WIDTH} ${TIMELINE_TOTAL_HEIGHT}`,
	});

	return {
		svg,
		meta: {
			layer_counts: {
				[LAYER_BANDS.VECTOR_SYMBOLOGY]: plot.fragmentCount,
				[LAYER_BANDS.POINT_SYMBOLOGY]: parsed.periods.length,
			},
			drawn_pixels: 0,
			parser_warnings: parserWarnings,
		},
	};
}

// ----------------------------------------------------------------------
// Extent resolution
// ----------------------------------------------------------------------

interface ResolvedExtent {
	from: string;
	to: string;
	fromMs: number;
	toMs: number;
}

function resolveExtent(extent: TafTimelineSpec['extent'], parsed: ParsedTaf): ResolvedExtent {
	if (extent === 'time') {
		return {
			from: parsed.validFrom,
			to: parsed.validTo,
			fromMs: new Date(parsed.validFrom).getTime(),
			toMs: new Date(parsed.validTo).getTime(),
		};
	}
	return {
		from: extent.from,
		to: extent.to,
		fromMs: new Date(extent.from).getTime(),
		toMs: new Date(extent.to).getTime(),
	};
}

// ----------------------------------------------------------------------
// Timeline plot
// ----------------------------------------------------------------------

function renderTimelinePlot(
	parsed: ParsedTaf,
	extent: ResolvedExtent,
	opts: z.infer<typeof tafTimelineOptionsSchema>,
): { svg: string; fragmentCount: number } {
	const totalRowHeight = ROW_HEIGHTS.reduce((acc, h) => acc + h, 0);
	const usableHeight = totalRowHeight + TIME_AXIS_HEIGHT;
	const plotTop = PLOT_MARGIN_TOP + Math.max(0, (PLOT_HEIGHT - usableHeight) / 2);

	const fragments: string[] = [];
	let fragmentCount = 0;

	// Plot frame.
	fragments.push(
		`<rect x="${PLOT_MARGIN_LEFT}" y="${plotTop}" width="${PLOT_WIDTH}" height="${usableHeight}" fill="white" stroke="${COLOR_RULE}" stroke-width="0.6" />`,
	);

	// Per-row bands -- background, label, content.
	let y = plotTop;
	for (let rowIdx = 0; rowIdx < ROW_LABELS.length; rowIdx += 1) {
		const label = ROW_LABELS[rowIdx];
		const rowH = ROW_HEIGHTS[rowIdx];
		if (label === undefined || rowH === undefined) continue;

		// Row separator + label gutter.
		if (rowIdx > 0) {
			fragments.push(
				`<line x1="${PLOT_MARGIN_LEFT}" y1="${y.toFixed(1)}" x2="${(PLOT_MARGIN_LEFT + PLOT_WIDTH).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COLOR_RULE}" stroke-width="0.4" />`,
			);
		}
		fragments.push(
			`<text x="${PLOT_MARGIN_LEFT - 12}" y="${(y + rowH / 2 + 4).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="${COLOR_NEUTRAL}">${label}</text>`,
		);

		const rowContent = renderRowContent(label, parsed, extent, y, rowH);
		fragments.push(rowContent.svg);
		fragmentCount += rowContent.elementCount;

		y += rowH;
	}

	// Time axis.
	fragments.push(
		`<line x1="${PLOT_MARGIN_LEFT}" y1="${y.toFixed(1)}" x2="${(PLOT_MARGIN_LEFT + PLOT_WIDTH).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${COLOR_NEUTRAL}" stroke-width="0.8" />`,
	);
	const axis = renderTimeAxis(extent, y, opts.axis_tick_hours);
	fragments.push(axis.svg);
	fragmentCount += axis.tickCount;

	return {
		svg: `<g class="timeline-plot">${fragments.join('\n')}</g>`,
		fragmentCount,
	};
}

interface RowContentResult {
	svg: string;
	elementCount: number;
}

function renderRowContent(
	label: (typeof ROW_LABELS)[number],
	parsed: ParsedTaf,
	extent: ResolvedExtent,
	y: number,
	rowH: number,
): RowContentResult {
	const innerTop = y + 6;
	const innerHeight = rowH - 12;
	switch (label) {
		case 'Wind':
			return renderWindRow(parsed.periods, extent, innerTop, innerHeight);
		case 'Visibility':
			return renderVisibilityRow(parsed.periods, extent, innerTop, innerHeight);
		case 'Ceiling':
			return renderCeilingRow(parsed.periods, extent, innerTop, innerHeight);
		case 'Weather':
			return renderWeatherRow(parsed.periods, extent, innerTop, innerHeight);
		case 'Probability':
			return renderProbabilityRow(parsed.periods, extent, innerTop, innerHeight);
		default:
			return { svg: '', elementCount: 0 };
	}
}

// ----------------------------------------------------------------------
// Per-row renderers
// ----------------------------------------------------------------------

function renderWindRow(
	periods: readonly TafPeriod[],
	extent: ResolvedExtent,
	innerTop: number,
	innerHeight: number,
): RowContentResult {
	const fragments: string[] = [];
	const cy = innerTop + innerHeight / 2;
	let count = 0;
	for (const period of periods) {
		const x0 = timeToX(period.start, extent);
		const x1 = timeToX(period.end, extent);
		const width = x1 - x0;
		if (width <= 0) continue;
		if (period.wind === null) continue;
		const arrowX = x0 + width / 2;
		const speed = period.wind.calm ? 0 : period.wind.speedKt;
		const intensityColor = colorForWindIntensity(speed);
		const isTransient = period.kind === 'TEMPO' || period.kind === 'PROB30' || period.kind === 'PROB40';
		const dashes = isTransient ? 'stroke-dasharray="3,2"' : '';
		const opacity = isTransient ? 0.85 : 1;
		// Period strip.
		fragments.push(
			`<rect x="${x0.toFixed(1)}" y="${innerTop.toFixed(1)}" width="${width.toFixed(1)}" height="${innerHeight.toFixed(1)}" fill="${intensityColor}" fill-opacity="0.08" />`,
		);
		// Wind arrow (centered).
		if (period.wind.calm) {
			fragments.push(
				`<text x="${arrowX.toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="${COLOR_NEUTRAL}" opacity="${opacity}">CALM</text>`,
			);
		} else {
			const dirDeg = period.wind.directionDeg;
			if (dirDeg !== null) {
				fragments.push(renderWindArrow(arrowX, cy, dirDeg, intensityColor, dashes, opacity));
			} else if (period.wind.variable) {
				fragments.push(
					`<text x="${arrowX.toFixed(1)}" y="${(cy - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="${COLOR_NEUTRAL}" opacity="${opacity}">VRB</text>`,
				);
			}
			const gustLabel = period.wind.gustKt !== null ? `G${period.wind.gustKt}` : '';
			fragments.push(
				`<text x="${arrowX.toFixed(1)}" y="${(cy + 28).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${intensityColor}" opacity="${opacity}">${period.wind.speedKt}${gustLabel} KT</text>`,
			);
		}
		count += 1;
	}
	return { svg: fragments.join('\n'), elementCount: count };
}

function renderWindArrow(
	cx: number,
	cy: number,
	dirDeg: number,
	color: string,
	dashes: string,
	opacity: number,
): string {
	// Arrow points downwind: rotate 0deg = blowing south (from north).
	// For TAF wind direction "FROM": arrow shaft drawn pointing in the
	// direction the wind blows TO -- i.e., 180 deg rotated from "from".
	const arrowLen = 28;
	const headLen = 8;
	// SVG y increases downward; rotate so dir 0 (from north) -> arrow points down.
	const rad = ((dirDeg + 180) * Math.PI) / 180;
	const dx = Math.sin(rad);
	const dy = -Math.cos(rad);
	const tailX = cx - (dx * arrowLen) / 2;
	const tailY = cy - 8 - (dy * arrowLen) / 2;
	const headX = cx + (dx * arrowLen) / 2;
	const headY = cy - 8 + (dy * arrowLen) / 2;
	const px = -dy;
	const py = dx;
	const head1X = headX - dx * headLen + px * (headLen / 2);
	const head1Y = headY - dy * headLen + py * (headLen / 2);
	const head2X = headX - dx * headLen - px * (headLen / 2);
	const head2Y = headY - dy * headLen - py * (headLen / 2);
	return `<g opacity="${opacity}">
  <line x1="${tailX.toFixed(1)}" y1="${tailY.toFixed(1)}" x2="${headX.toFixed(1)}" y2="${headY.toFixed(1)}" stroke="${color}" stroke-width="2" ${dashes} />
  <polygon points="${headX.toFixed(1)},${headY.toFixed(1)} ${head1X.toFixed(1)},${head1Y.toFixed(1)} ${head2X.toFixed(1)},${head2Y.toFixed(1)}" fill="${color}" />
</g>`;
}

function colorForWindIntensity(speedKt: number): string {
	if (speedKt < WIND_INTENSITY.calm) return COLOR_LABEL;
	if (speedKt < WIND_INTENSITY.moderate) return COLOR_VFR;
	if (speedKt < WIND_INTENSITY.strong) return COLOR_MVFR;
	if (speedKt < WIND_INTENSITY.gale) return COLOR_IFR;
	return COLOR_LIFR;
}

function renderVisibilityRow(
	periods: readonly TafPeriod[],
	extent: ResolvedExtent,
	innerTop: number,
	innerHeight: number,
): RowContentResult {
	const fragments: string[] = [];
	let count = 0;
	for (const period of periods) {
		const x0 = timeToX(period.start, extent);
		const x1 = timeToX(period.end, extent);
		const width = x1 - x0;
		if (width <= 0) continue;
		const visSm = period.visibilitySM;
		const isTransient = period.kind === 'TEMPO' || period.kind === 'PROB30' || period.kind === 'PROB40';
		const opacity = isTransient ? 0.78 : 1;
		const color = colorForVisibility(visSm, period.cavok);
		fragments.push(
			`<rect x="${x0.toFixed(1)}" y="${innerTop.toFixed(1)}" width="${width.toFixed(1)}" height="${innerHeight.toFixed(1)}" fill="${color}" fill-opacity="${opacity}" />`,
		);
		// Visibility label centered.
		const cx = x0 + width / 2;
		const cy = innerTop + innerHeight / 2 + 4;
		const visLabel = visLabelText(visSm, period.cavok);
		fragments.push(
			`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="white" stroke="${COLOR_NEUTRAL}" stroke-width="0.3">${visLabel}</text>`,
		);
		count += 1;
	}
	return { svg: fragments.join('\n'), elementCount: count };
}

function colorForVisibility(visSm: number | null, cavok: boolean): string {
	if (cavok || visSm === null) return COLOR_VFR;
	if (visSm < 1) return COLOR_LIFR;
	if (visSm < 3) return COLOR_IFR;
	if (visSm <= 5) return COLOR_MVFR;
	return COLOR_VFR;
}

function visLabelText(visSm: number | null, cavok: boolean): string {
	if (cavok) return 'CAVOK';
	if (visSm === null) return '-';
	if (visSm >= 6) return 'P6SM';
	if (Number.isInteger(visSm)) return `${visSm}SM`;
	// Render fractional vis as decimal to keep the label compact.
	return `${visSm.toFixed(2)}SM`;
}

function renderCeilingRow(
	periods: readonly TafPeriod[],
	extent: ResolvedExtent,
	innerTop: number,
	innerHeight: number,
): RowContentResult {
	const fragments: string[] = [];
	let count = 0;
	for (const period of periods) {
		const x0 = timeToX(period.start, extent);
		const x1 = timeToX(period.end, extent);
		const width = x1 - x0;
		if (width <= 0) continue;
		const ceiling = ceilingFtAgl(period.clouds);
		const category = computeFlightCategory({ clouds: period.clouds, visibilitySM: period.visibilitySM });
		const isTransient = period.kind === 'TEMPO' || period.kind === 'PROB30' || period.kind === 'PROB40';
		const opacity = isTransient ? 0.78 : 1;
		const color = colorForCategory(category);
		fragments.push(
			`<rect x="${x0.toFixed(1)}" y="${innerTop.toFixed(1)}" width="${width.toFixed(1)}" height="${innerHeight.toFixed(1)}" fill="${color}" fill-opacity="${opacity}" />`,
		);
		const cx = x0 + width / 2;
		const cy = innerTop + innerHeight / 2 + 4;
		const ceilingLabel = ceiling === null ? 'NSC' : `${ceiling}ft`;
		fragments.push(
			`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="white" stroke="${COLOR_NEUTRAL}" stroke-width="0.3">${ceilingLabel}</text>`,
		);
		// Category badge.
		fragments.push(
			`<text x="${cx.toFixed(1)}" y="${(innerTop + innerHeight - 6).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="white" letter-spacing="0.6">${category}</text>`,
		);
		count += 1;
	}
	return { svg: fragments.join('\n'), elementCount: count };
}

function colorForCategory(category: string): string {
	switch (category) {
		case FAA_FLIGHT_CATEGORIES.VFR:
			return COLOR_VFR;
		case FAA_FLIGHT_CATEGORIES.MVFR:
			return COLOR_MVFR;
		case FAA_FLIGHT_CATEGORIES.IFR:
			return COLOR_IFR;
		case FAA_FLIGHT_CATEGORIES.LIFR:
			return COLOR_LIFR;
		default:
			return COLOR_NEUTRAL;
	}
}

function renderWeatherRow(
	periods: readonly TafPeriod[],
	extent: ResolvedExtent,
	innerTop: number,
	innerHeight: number,
): RowContentResult {
	const fragments: string[] = [];
	let count = 0;
	const cy = innerTop + innerHeight / 2 + 4;
	for (const period of periods) {
		const x0 = timeToX(period.start, extent);
		const x1 = timeToX(period.end, extent);
		const width = x1 - x0;
		if (width <= 0) continue;
		if (period.weather.length === 0) continue;
		const isTransient = period.kind === 'TEMPO' || period.kind === 'PROB30' || period.kind === 'PROB40';
		const opacity = isTransient ? 0.85 : 1;
		const cx = x0 + width / 2;
		// Optional faint background to anchor the text.
		fragments.push(
			`<rect x="${x0.toFixed(1)}" y="${innerTop.toFixed(1)}" width="${width.toFixed(1)}" height="${innerHeight.toFixed(1)}" fill="${COLOR_NEUTRAL}" fill-opacity="0.06" />`,
		);
		fragments.push(
			`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="${COLOR_NEUTRAL}" opacity="${opacity}">${escapeXml(period.weather.join(' '))}</text>`,
		);
		count += 1;
	}
	return { svg: fragments.join('\n'), elementCount: count };
}

function renderProbabilityRow(
	periods: readonly TafPeriod[],
	extent: ResolvedExtent,
	innerTop: number,
	innerHeight: number,
): RowContentResult {
	const fragments: string[] = [];
	let count = 0;
	const cy = innerTop + innerHeight / 2 + 4;
	for (const period of periods) {
		if (period.probability === null) continue;
		const x0 = timeToX(period.start, extent);
		const x1 = timeToX(period.end, extent);
		const width = x1 - x0;
		if (width <= 0) continue;
		fragments.push(
			`<rect x="${x0.toFixed(1)}" y="${innerTop.toFixed(1)}" width="${width.toFixed(1)}" height="${innerHeight.toFixed(1)}" fill="${COLOR_PERIOD_BADGE_PROB}" fill-opacity="0.18" stroke="${COLOR_PERIOD_BADGE_PROB}" stroke-width="0.6" stroke-dasharray="3,2" />`,
		);
		const cx = x0 + width / 2;
		fragments.push(
			`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="${COLOR_PERIOD_BADGE_PROB}">PROB${period.probability}</text>`,
		);
		count += 1;
	}
	return { svg: fragments.join('\n'), elementCount: count };
}

// ----------------------------------------------------------------------
// Time axis + period boundaries
// ----------------------------------------------------------------------

function timeToX(iso: string, extent: ResolvedExtent): number {
	const t = new Date(iso).getTime();
	const clamped = Math.max(extent.fromMs, Math.min(extent.toMs, t));
	const fraction = (clamped - extent.fromMs) / (extent.toMs - extent.fromMs);
	return PLOT_MARGIN_LEFT + fraction * PLOT_WIDTH;
}

function renderTimeAxis(extent: ResolvedExtent, y: number, tickHours: number): { svg: string; tickCount: number } {
	const fragments: string[] = [];
	const startMs = extent.fromMs;
	const endMs = extent.toMs;
	const startDate = new Date(startMs);
	// Anchor first tick to top-of-hour at-or-before the start.
	const firstTickHour = Math.ceil(startDate.getUTCHours() / tickHours) * tickHours;
	const firstTick = new Date(
		Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), firstTickHour, 0),
	);
	let cursor = firstTick.getTime();
	let tickCount = 0;
	while (cursor <= endMs) {
		const x = timeToX(new Date(cursor).toISOString(), extent);
		const dt = new Date(cursor);
		const hourLabel = String(dt.getUTCHours()).padStart(2, '0') + 'Z';
		const dayLabel = dt.getUTCHours() === 0 ? `${String(dt.getUTCDate()).padStart(2, '0')}/${hourLabel}` : hourLabel;
		fragments.push(
			`<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 5).toFixed(1)}" stroke="${COLOR_NEUTRAL}" stroke-width="0.6" />`,
		);
		fragments.push(
			`<text x="${x.toFixed(1)}" y="${(y + 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="${COLOR_NEUTRAL}">${dayLabel}</text>`,
		);
		tickCount += 1;
		cursor += tickHours * 3600_000;
	}
	// "UTC" suffix.
	fragments.push(
		`<text x="${(PLOT_MARGIN_LEFT + PLOT_WIDTH + 4).toFixed(1)}" y="${(y + 18).toFixed(1)}" font-size="10" fill="${COLOR_LABEL}">UTC</text>`,
	);
	return { svg: `<g class="time-axis">${fragments.join('\n')}</g>`, tickCount };
}

function renderPeriodBoundaries(parsed: ParsedTaf, extent: ResolvedExtent): string {
	const fragments: string[] = [];
	const totalRowHeight = ROW_HEIGHTS.reduce((acc, h) => acc + h, 0);
	const usableHeight = totalRowHeight + TIME_AXIS_HEIGHT;
	const plotTop = PLOT_MARGIN_TOP + Math.max(0, (PLOT_HEIGHT - usableHeight) / 2);
	const plotBottom = plotTop + totalRowHeight;
	for (const period of parsed.periods) {
		const x = timeToX(period.start, extent);
		// Skip the leading boundary at validFrom -- it's the plot frame.
		if (Math.abs(x - PLOT_MARGIN_LEFT) < 0.5) continue;
		const isFm = period.kind === 'FM';
		const isBecmg = period.kind === 'BECMG';
		const isTempo = period.kind === 'TEMPO';
		const isProb = period.kind === 'PROB30' || period.kind === 'PROB40';
		const dashes = isFm ? '' : 'stroke-dasharray="4,3"';
		fragments.push(
			`<line x1="${x.toFixed(1)}" y1="${plotTop.toFixed(1)}" x2="${x.toFixed(1)}" y2="${plotBottom.toFixed(1)}" stroke="${COLOR_PERIOD_BOUNDARY}" stroke-width="0.8" ${dashes} />`,
		);
		const badgeColor = isFm
			? COLOR_PERIOD_BADGE_FM
			: isBecmg
				? COLOR_PERIOD_BADGE_BECMG
				: isTempo
					? COLOR_PERIOD_BADGE_TEMPO
					: isProb
						? COLOR_PERIOD_BADGE_PROB
						: COLOR_PERIOD_BOUNDARY;
		const badgeLabel = badgeLabelFor(period);
		const badgeWidth = badgeLabel.length * 6 + 12;
		fragments.push(
			`<g class="period-badge">
  <rect x="${(x - badgeWidth / 2).toFixed(1)}" y="${(plotTop - 18).toFixed(1)}" width="${badgeWidth.toFixed(1)}" height="16" fill="${badgeColor}" rx="2" />
  <text x="${x.toFixed(1)}" y="${(plotTop - 6).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="white" letter-spacing="0.4">${badgeLabel}</text>
</g>`,
		);
	}
	return fragments.join('\n');
}

function badgeLabelFor(period: TafPeriod): string {
	switch (period.kind) {
		case 'INITIAL':
			return 'BASE';
		case 'FM':
			return `FM ${formatBadgeTime(period.start)}`;
		case 'BECMG':
			return `BECMG ${formatBadgeTime(period.start)}-${formatBadgeTime(period.end)}`;
		case 'TEMPO':
			return `TEMPO ${formatBadgeTime(period.start)}-${formatBadgeTime(period.end)}`;
		case 'PROB30':
			return `PROB30 ${formatBadgeTime(period.start)}-${formatBadgeTime(period.end)}`;
		case 'PROB40':
			return `PROB40 ${formatBadgeTime(period.start)}-${formatBadgeTime(period.end)}`;
		default:
			return period.kind;
	}
}

function formatBadgeTime(iso: string): string {
	const d = new Date(iso);
	return `${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}`;
}

// ----------------------------------------------------------------------
// Footer legend
// ----------------------------------------------------------------------

function renderLegend(): string {
	const x0 = 24;
	const y0 = TIMELINE_TOTAL_HEIGHT - FOOTER_BAND_HEIGHT - 4;
	const width = TIMELINE_WIDTH - 48;
	const items: { label: string; color: string }[] = [
		{ label: 'VFR', color: COLOR_VFR },
		{ label: 'MVFR', color: COLOR_MVFR },
		{ label: 'IFR', color: COLOR_IFR },
		{ label: 'LIFR', color: COLOR_LIFR },
	];
	const swatchW = 14;
	const itemWidth = 80;
	const swatchFragments = items
		.map((item, i) => {
			const cx = x0 + 16 + i * itemWidth;
			return `<rect x="${cx}" y="${(y0 + 14).toFixed(1)}" width="${swatchW}" height="${swatchW}" fill="${item.color}" />
<text x="${cx + swatchW + 6}" y="${(y0 + 26).toFixed(1)}" font-size="10" fill="${COLOR_NEUTRAL}">${item.label}</text>`;
		})
		.join('\n');
	const periodSwatches: { label: string; color: string }[] = [
		{ label: 'FM (firm change)', color: COLOR_PERIOD_BADGE_FM },
		{ label: 'BECMG (transition)', color: COLOR_PERIOD_BADGE_BECMG },
		{ label: 'TEMPO (transient)', color: COLOR_PERIOD_BADGE_TEMPO },
		{ label: 'PROB30/40', color: COLOR_PERIOD_BADGE_PROB },
	];
	const periodSwatchFragments = periodSwatches
		.map((item, i) => {
			const cx = x0 + 16 + i * 180;
			return `<rect x="${cx}" y="${(y0 + 50).toFixed(1)}" width="${swatchW}" height="${swatchW}" fill="${item.color}" />
<text x="${cx + swatchW + 6}" y="${(y0 + 62).toFixed(1)}" font-size="10" fill="${COLOR_NEUTRAL}">${item.label}</text>`;
		})
		.join('\n');
	return `<g class="footer-taf-legend">
  <rect x="${x0}" y="${y0}" width="${width}" height="${FOOTER_BAND_HEIGHT - 28}" fill="white" fill-opacity="0.94" stroke="${COLOR_RULE}" stroke-width="0.6" rx="3" />
  <text x="${x0 + 8}" y="${(y0 + 12).toFixed(1)}" font-size="10" font-weight="700" fill="${COLOR_NEUTRAL}" letter-spacing="0.6">FLIGHT CATEGORY (visibility + ceiling color)</text>
  ${swatchFragments}
  <text x="${x0 + 8}" y="${(y0 + 46).toFixed(1)}" font-size="10" font-weight="700" fill="${COLOR_NEUTRAL}" letter-spacing="0.6">CHANGE-GROUP TYPE</text>
  ${periodSwatchFragments}
  <text x="${x0 + 8}" y="${(y0 + 82).toFixed(1)}" font-size="9" fill="${COLOR_LABEL}">Time runs left to right (UTC). Wind arrows point downwind. Vertical separators mark FM / BECMG / TEMPO / PROB period boundaries.</text>
</g>`;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function formatIsoShort(iso: string): string {
	const d = new Date(iso);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${y}-${m}-${day} ${hh}${mm}Z`;
}

function escapeXml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => {
		switch (c) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			case "'":
				return '&apos;';
			default:
				return c;
		}
	});
}
