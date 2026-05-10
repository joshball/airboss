/**
 * FAA station-model renderer (substrate).
 *
 * Renders the canonical layout:
 *
 *     Tmp .  Pres
 *         O    -- center: sky cover circle, with wind shaft
 *     Dew
 *
 * Center O = sky cover (open=clear, partially filled by coverage octants).
 * Wind shaft extends from O in the direction wind is FROM, with barbs
 * on the LEFT side encoding speed (full barb = 10 kt, half = 5 kt,
 * pennant = 50 kt). Calm wind = extra ring around the station circle.
 *
 * Phase A ships the substrate; Phase C hardens with dense-grid options
 * (compact mode, parser-warning aware no-shaft for null wind, etc.).
 *
 * Browser-safe: pure SVG-string emission.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/stations.ts`,
 * generalized to accept a single station per call (the dense-grid
 * caller in Phase C maps over an array).
 */

export type SkyCover = 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC';

export interface StationOb {
	id: string;
	/** Screen-space coordinates of the station model center. */
	x: number;
	y: number;
	tempF?: number;
	dewF?: number;
	/** Sea-level pressure in mb. */
	pressureMb?: number;
	/** Wind direction in degrees from (meteorological convention). */
	windDir?: number | null;
	/** Wind speed in knots. `0` = calm; `null` = unparseable. */
	windKt?: number | null;
	skyCover?: SkyCover;
}

export interface StationModelOptions {
	/** Station-circle radius in pixels. Defaults to 4. */
	stationRadiusPx?: number;
	/** Wind shaft length in pixels. Defaults to 22. */
	windShaftLenPx?: number;
	/** Wind barb length in pixels (full barb = 9; half barb = 4.5). */
	barbLenPx?: number;
	/** Compact mode: smaller text + tighter offsets for dense grids. Default false. */
	compact?: boolean;
}

const DEFAULTS = {
	stationRadiusPx: 4,
	windShaftLenPx: 22,
	barbLenPx: 9,
	compact: false,
} as const;

const FG = '#3d3a32';
const DEW_BLUE = '#1f4ea8';

function skyFraction(sky: SkyCover): number {
	switch (sky) {
		case 'CLR':
			return 0;
		case 'FEW':
			return 0.25;
		case 'SCT':
			return 0.5;
		case 'BKN':
			return 0.75;
		case 'OVC':
			return 1;
	}
}

function renderSkyCircle(x: number, y: number, sky: SkyCover, radius: number): string {
	if (sky === 'CLR') {
		return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" fill="white" stroke="${FG}" stroke-width="1" />`;
	}
	if (sky === 'OVC') {
		return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" fill="${FG}" stroke="${FG}" stroke-width="1" />`;
	}
	const fraction = skyFraction(sky);
	const endAngle = -Math.PI / 2 + fraction * 2 * Math.PI;
	const ex = x + radius * Math.cos(endAngle);
	const ey = y + radius * Math.sin(endAngle);
	const largeArc = fraction > 0.5 ? 1 : 0;
	return `<g>
    <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius}" fill="white" stroke="${FG}" stroke-width="1" />
    <path d="M ${x.toFixed(2)} ${y.toFixed(2)} L ${x.toFixed(2)} ${(y - radius).toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z" fill="${FG}" stroke="none" />
  </g>`;
}

function renderWindBarb(x: number, y: number, dirDeg: number, kt: number, opts: Required<StationModelOptions>): string {
	if (kt === 0) {
		return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${opts.stationRadiusPx + 3}" fill="none" stroke="${FG}" stroke-width="0.6" />`;
	}
	const mathRad = ((90 - dirDeg) * Math.PI) / 180;
	const sx = x + opts.stationRadiusPx * Math.cos(mathRad);
	const sy = y - opts.stationRadiusPx * Math.sin(mathRad);
	const ex = x + (opts.stationRadiusPx + opts.windShaftLenPx) * Math.cos(mathRad);
	const ey = y - (opts.stationRadiusPx + opts.windShaftLenPx) * Math.sin(mathRad);

	const elements: string[] = [
		`<line x1="${sx.toFixed(2)}" y1="${sy.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" stroke="${FG}" stroke-width="1" stroke-linecap="round" />`,
	];

	const px = -Math.sin(mathRad);
	const py = -Math.cos(mathRad);
	let remaining = Math.round(kt / 5) * 5;
	let dist = opts.windShaftLenPx;
	const stepInner = 5;
	while (remaining > 0 && dist > 4) {
		const px0 = x + (opts.stationRadiusPx + dist) * Math.cos(mathRad);
		const py0 = y - (opts.stationRadiusPx + dist) * Math.sin(mathRad);
		if (remaining >= 50) {
			const bx = px0 + opts.barbLenPx * px;
			const by = py0 + opts.barbLenPx * py;
			const px1 = x + (opts.stationRadiusPx + dist - stepInner) * Math.cos(mathRad);
			const py1 = y - (opts.stationRadiusPx + dist - stepInner) * Math.sin(mathRad);
			elements.push(
				`<path d="M ${px0.toFixed(2)} ${py0.toFixed(2)} L ${bx.toFixed(2)} ${by.toFixed(2)} L ${px1.toFixed(2)} ${py1.toFixed(2)} Z" fill="${FG}" stroke="${FG}" stroke-width="0.5" />`,
			);
			remaining -= 50;
			dist -= stepInner;
		} else if (remaining >= 10) {
			const bx = px0 + opts.barbLenPx * px;
			const by = py0 + opts.barbLenPx * py;
			elements.push(
				`<line x1="${px0.toFixed(2)}" y1="${py0.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" stroke="${FG}" stroke-width="1" stroke-linecap="round" />`,
			);
			remaining -= 10;
			dist -= stepInner;
		} else {
			const bx = px0 + (opts.barbLenPx / 2) * px;
			const by = py0 + (opts.barbLenPx / 2) * py;
			elements.push(
				`<line x1="${px0.toFixed(2)}" y1="${py0.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" stroke="${FG}" stroke-width="1" stroke-linecap="round" />`,
			);
			remaining -= 5;
			dist -= stepInner;
		}
	}
	return elements.join('\n');
}

/**
 * Render one station model. Returns the inner SVG fragment.
 *
 * Per spec edge case: a `null` wind direction or `null` wind speed
 * suppresses the shaft (no barb is drawn). The station circle still
 * renders.
 */
export function renderStationModel(s: StationOb, options: StationModelOptions = {}): string {
	const opts: Required<StationModelOptions> = { ...DEFAULTS, ...options };
	const sky: SkyCover = s.skyCover ?? 'CLR';
	const fontSize = opts.compact ? 8 : 9;
	const offset = opts.compact ? 6 : 8;

	const skyCircle = renderSkyCircle(s.x, s.y, sky, opts.stationRadiusPx);
	const windFragment =
		s.windDir !== null && s.windDir !== undefined && s.windKt !== null && s.windKt !== undefined
			? renderWindBarb(s.x, s.y, s.windDir, s.windKt, opts)
			: '';

	const tempStr = s.tempF !== undefined ? Math.round(s.tempF).toString() : '';
	const dewStr = s.dewF !== undefined ? Math.round(s.dewF).toString() : '';
	const presStr = s.pressureMb !== undefined ? s.pressureMb.toFixed(0) : '';

	const tempFragment =
		tempStr.length > 0
			? `<text x="${(s.x - offset).toFixed(2)}" y="${(s.y - 6).toFixed(2)}" text-anchor="end" font-size="${fontSize}" font-weight="600" fill="${FG}">${tempStr}</text>`
			: '';
	const dewFragment =
		dewStr.length > 0
			? `<text x="${(s.x - offset).toFixed(2)}" y="${(s.y + 12).toFixed(2)}" text-anchor="end" font-size="${fontSize}" font-weight="600" fill="${DEW_BLUE}">${dewStr}</text>`
			: '';
	const presFragment =
		presStr.length > 0
			? `<text x="${(s.x + offset).toFixed(2)}" y="${(s.y - 6).toFixed(2)}" text-anchor="start" font-size="${fontSize}" font-weight="600" fill="${FG}">${presStr}</text>`
			: '';

	return `<g class="station-model" data-id="${s.id}">
  ${skyCircle}
  ${windFragment}
  ${tempFragment}
  ${dewFragment}
  ${presFragment}
</g>`;
}

// ----------------------------------------------------------------------
// Dense-grid renderer (Phase C)
// ----------------------------------------------------------------------
//
// Spike 03's `renderStationModel({ parsed, cx, cy })` -- ported here
// alongside Phase A's StationOb-based variant. The Phase C entry point
// consumes a fully parsed METAR and renders the dense-grid layout
// (cloud-cover wedges, present weather, visibility label, optional
// flight-category teaching ring, station ID below). Reuses the same
// FAA wind-barb conventions as the Phase A renderer but with the
// Spike 03 layout constants tuned for ~50-glyph CONUS density.

import type { FaaFlightCategory } from '@ab/constants';
import type { ParsedMetar, SkyCover as MetarSkyCover } from '../wx/metar/types';
import { ceilingFtAgl, celsiusToFahrenheit, flightCategory, summarizeCover } from '../wx/rules';

const COLOR_TEMP = '#cc1f1f';
const COLOR_DEW = '#2c8742';
const COLOR_WX = '#7d3eb5';
const COLOR_TEXT = '#1f1d18';
const COLOR_WIND = '#1f1d18';
const COLOR_CIRCLE_FILL = '#1f1d18';
const COLOR_CIRCLE_STROKE = '#1f1d18';

const CATEGORY_RING: Record<FaaFlightCategory, string | null> = {
	VFR: null,
	MVFR: '#1565c0',
	IFR: '#c62828',
	LIFR: '#6a1b9a',
};

interface DenseDefaults {
	glyphRadiusPx: number;
	shaftLenPx: number;
	barbLenPx: number;
	barbSpacingPx: number;
	barbOffsetFromTipPx: number;
	tempUnit: 'F' | 'C';
	categoryRing: 'show' | 'hide';
	multiLayer: 'summary' | 'stack';
	calmRingThresholdKt: number;
	showStationId: boolean;
}

const DENSE_DEFAULTS: DenseDefaults = {
	glyphRadiusPx: 6,
	shaftLenPx: 22,
	barbLenPx: 9,
	barbSpacingPx: 3.5,
	barbOffsetFromTipPx: 1,
	tempUnit: 'F',
	categoryRing: 'show',
	multiLayer: 'summary',
	calmRingThresholdKt: 3,
	showStationId: true,
};

export interface DenseStationModelOptions {
	/** Cloud-cover circle radius (px). Default 6. */
	glyphRadiusPx?: number;
	/** Wind shaft length (px). Default 22. */
	shaftLenPx?: number;
	/** Wind barb length (px). Default 9. */
	barbLenPx?: number;
	/** Spacing between barbs along the shaft (px). Default 3.5. */
	barbSpacingPx?: number;
	/** Inset from upwind shaft tip before first barb (px). Default 1. */
	barbOffsetFromTipPx?: number;
	/** Temperature unit for the top-left/bottom-left labels. Default 'F'. */
	tempUnit?: 'F' | 'C';
	/** Whether to draw the FAA-flight-category teaching ring. Default 'show'. */
	categoryRing?: 'show' | 'hide';
	/**
	 * `summary` (default): single cloud-cover circle filled per the
	 * highest layer reported. `stack`: a vertical stack of small
	 * cover circles, one per reported layer. Per Spike 03 the
	 * summary form is the FAA station-model norm at this density.
	 */
	multiLayer?: 'summary' | 'stack';
	/**
	 * Wind-speed threshold below which the shaft is suppressed in favor
	 * of the calm ring around the cloud-cover circle. Default 3 KT
	 * (matches the Spike 03 convention).
	 */
	calmRingThresholdKt?: number;
	/** Whether to render the small station-ID label below the glyph. Default true. */
	showStationId?: boolean;
}

export interface DenseStationGlyphInput {
	parsed: ParsedMetar;
	/** Glyph center, screen-space. */
	cx: number;
	/** Glyph center, screen-space. */
	cy: number;
	/**
	 * Optional override of the original (true-position) coordinates if
	 * the caller already ran collision avoidance and wants the glyph to
	 * carry a `data-true-x` / `data-true-y` attribute pair. The renderer
	 * itself does not move the glyph; it only annotates.
	 */
	trueX?: number;
	trueY?: number;
	/**
	 * Optional pre-computed flight category. Useful when the chart
	 * pre-computes category for sorting / coloring before render. When
	 * omitted, derived from the parsed METAR.
	 */
	flightCategory?: FaaFlightCategory;
}

/**
 * Render one FAA-style station model as an SVG `<g>` from a parsed
 * METAR. Dense-grid variant per Spike 03.
 *
 * Layout (point coords relative to glyph center, +x right, +y down):
 *
 *     TT        PPP                    T = temperature  P = altimeter
 *     wx  vis   OO                     wx, vis to the left of the cloud
 *     DD                               D = dewpoint
 *
 * Wind shaft + barbs extend from the cloud-cover circle outward in the
 * direction the wind is FROM (FAA convention); barbs are on the LEFT
 * side of the shaft (Northern-Hemisphere convention).
 */
export function renderStationModelFromMetar(
	input: DenseStationGlyphInput,
	options: DenseStationModelOptions = {},
): string {
	const opts = { ...DENSE_DEFAULTS, ...options };
	const { parsed, cx, cy } = input;
	const cover = summarizeCover(parsed.clouds);
	const ceil = ceilingFtAgl(parsed.clouds);
	const cat = input.flightCategory ?? flightCategory(ceil, parsed.visibilitySM);

	const parts: string[] = [];

	const trueXAttr = input.trueX !== undefined ? ` data-true-x="${input.trueX.toFixed(1)}"` : '';
	const trueYAttr = input.trueY !== undefined ? ` data-true-y="${input.trueY.toFixed(1)}"` : '';

	parts.push(
		`<g class="station" data-station="${parsed.station}" data-cat="${cat}"${trueXAttr}${trueYAttr} transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">`,
	);

	const wind = parsed.wind;
	const showShaft = wind !== null && !wind.calm && wind.speedKt >= opts.calmRingThresholdKt;
	if (showShaft && wind !== null) {
		parts.push(renderDenseWindShaft(wind, opts));
	} else if (wind?.calm === true) {
		parts.push(
			`<circle cx="0" cy="0" r="${opts.glyphRadiusPx + 4}" fill="none" stroke="${COLOR_WIND}" stroke-width="0.7" />`,
		);
	}

	parts.push(renderDenseCloudCircle(cover, cat, opts));

	if (parsed.tempC !== null) {
		const tempLabel =
			opts.tempUnit === 'C' ? Math.round(parsed.tempC).toString() : celsiusToFahrenheit(parsed.tempC).toString();
		parts.push(
			`<text x="-10" y="-7" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_TEMP}">${tempLabel}</text>`,
		);
	}

	if (parsed.dewpointC !== null) {
		const dewLabel =
			opts.tempUnit === 'C'
				? Math.round(parsed.dewpointC).toString()
				: celsiusToFahrenheit(parsed.dewpointC).toString();
		parts.push(
			`<text x="-10" y="11" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_DEW}">${dewLabel}</text>`,
		);
	}

	if (parsed.altimeterInHg !== null) {
		const kollsman = altimeterKollsman(parsed.altimeterInHg);
		parts.push(`<text x="10" y="-7" font-size="9" font-weight="600" fill="${COLOR_TEXT}">${kollsman}</text>`);
	}

	if (parsed.visibilitySM !== null && parsed.visibilitySM <= 6) {
		const visStr = formatVis(parsed.visibilitySM);
		parts.push(
			`<text x="-22" y="3" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_TEXT}">${visStr}</text>`,
		);
	}

	const wxSym = primaryWeatherSymbol(parsed.weather);
	if (wxSym !== null) {
		parts.push(
			`<text x="-12" y="3" text-anchor="end" font-size="10" font-weight="700" fill="${COLOR_WX}">${wxSym}</text>`,
		);
	}

	if (opts.showStationId) {
		parts.push(
			`<text x="0" y="${opts.glyphRadiusPx + 11}" text-anchor="middle" font-size="7" font-weight="500" fill="#7a7568" letter-spacing="0.2">${parsed.station.replace(/^K/, '')}</text>`,
		);
	}

	parts.push('</g>');
	return parts.join('');
}

function renderDenseCloudCircle(cover: MetarSkyCover, cat: FaaFlightCategory, opts: DenseDefaults): string {
	const r = opts.glyphRadiusPx;
	const ringColor = opts.categoryRing === 'show' ? CATEGORY_RING[cat] : null;
	const ringSvg =
		ringColor !== null
			? `<circle cx="0" cy="0" r="${r + 1.7}" fill="none" stroke="${ringColor}" stroke-width="1.4" opacity="0.85" />`
			: '';
	const baseCircle = `<circle cx="0" cy="0" r="${r}" fill="white" stroke="${COLOR_CIRCLE_STROKE}" stroke-width="1" />`;
	let fillFragment = '';
	switch (cover) {
		case 'SKC':
		case 'CLR':
		case 'NSC':
			fillFragment = '';
			break;
		case 'FEW':
			fillFragment = pieWedge(r, 270, 360);
			break;
		case 'SCT':
			fillFragment = pieWedge(r, 270, 90);
			break;
		case 'BKN':
			fillFragment = pieWedge(r, 270, 180);
			break;
		case 'OVC':
			fillFragment = `<circle cx="0" cy="0" r="${r}" fill="${COLOR_CIRCLE_FILL}" />`;
			break;
		case 'VV':
			fillFragment = `<line x1="${-r + 1}" y1="${-r + 1}" x2="${r - 1}" y2="${r - 1}" stroke="${COLOR_CIRCLE_FILL}" stroke-width="1.2" />
<line x1="${-r + 1}" y1="${r - 1}" x2="${r - 1}" y2="${-r + 1}" stroke="${COLOR_CIRCLE_FILL}" stroke-width="1.2" />`;
			break;
	}
	return `${ringSvg}${baseCircle}${fillFragment}`;
}

function pieWedge(r: number, startDeg: number, endDeg: number): string {
	const start = polar(r, startDeg);
	const end = polar(r, endDeg);
	let sweep = endDeg - startDeg;
	if (sweep < 0) sweep += 360;
	const largeArc = sweep > 180 ? 1 : 0;
	return `<path d="M 0 0 L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z" fill="${COLOR_CIRCLE_FILL}" />`;
}

function polar(r: number, deg: number): { x: number; y: number } {
	const rad = (deg * Math.PI) / 180;
	return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

/**
 * Wind shaft + barbs from the parsed wind group. Encoding:
 *
 *   1-2 KT (sub-threshold): no shaft -- caller draws calm ring
 *   3-7 KT: half barb (5 KT)
 *   8-12 KT: full barb (10 KT)
 *   ...up by 5 KT each
 *   50 KT: pennant (filled triangle)
 *   100+ KT: 2 pennants
 *
 * Speed is rounded to the nearest 5 KT before decomposing.
 */
function renderDenseWindShaft(wind: NonNullable<ParsedMetar['wind']>, opts: DenseDefaults): string {
	if (wind.directionDeg === null) return '';
	if (wind.speedKt < opts.calmRingThresholdKt) return '';

	const r = opts.glyphRadiusPx;
	const dirRad = (wind.directionDeg * Math.PI) / 180;
	const ux = Math.sin(dirRad);
	const uy = -Math.cos(dirRad);

	const x0 = ux * r;
	const y0 = uy * r;
	const x1 = ux * (r + opts.shaftLenPx);
	const y1 = uy * (r + opts.shaftLenPx);

	const parts: string[] = [];
	parts.push(
		`<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`,
	);

	const rounded = Math.round(wind.speedKt / 5) * 5;
	let remaining = rounded;
	const pennants = Math.floor(remaining / 50);
	remaining -= pennants * 50;
	const fullBarbs = Math.floor(remaining / 10);
	remaining -= fullBarbs * 10;
	const halfBarbs = Math.floor(remaining / 5);

	const px = uy;
	const py = -ux;

	let walked = opts.barbOffsetFromTipPx;

	for (let i = 0; i < pennants; i += 1) {
		const baseT = r + opts.shaftLenPx - walked;
		const a = onShaft(ux, uy, baseT);
		const b = onShaft(ux, uy, baseT - opts.barbSpacingPx * 1.5);
		const c = { x: a.x + px * opts.barbLenPx, y: a.y + py * opts.barbLenPx };
		parts.push(
			`<path d="M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z" fill="${COLOR_WIND}" />`,
		);
		walked += opts.barbSpacingPx * 2;
	}
	for (let i = 0; i < fullBarbs; i += 1) {
		const baseT = r + opts.shaftLenPx - walked;
		const a = onShaft(ux, uy, baseT);
		const b = { x: a.x + px * opts.barbLenPx, y: a.y + py * opts.barbLenPx };
		parts.push(
			`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`,
		);
		walked += opts.barbSpacingPx;
	}
	for (let i = 0; i < halfBarbs; i += 1) {
		const baseT = r + opts.shaftLenPx - walked;
		const a = onShaft(ux, uy, baseT);
		const b = { x: a.x + px * (opts.barbLenPx / 2), y: a.y + py * (opts.barbLenPx / 2) };
		parts.push(
			`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`,
		);
		walked += opts.barbSpacingPx;
	}

	return parts.join('');
}

function onShaft(ux: number, uy: number, t: number): { x: number; y: number } {
	return { x: ux * t, y: uy * t };
}

function altimeterKollsman(inHg: number): string {
	const x = Math.round(inHg * 100);
	return String(x).slice(-3).padStart(3, '0');
}

function formatVis(visSM: number): string {
	if (visSM >= 1) {
		const whole = Math.floor(visSM);
		const frac = visSM - whole;
		if (frac < 0.05) return `${whole}`;
		return `${whole}${formatFrac(frac)}`;
	}
	return formatFrac(visSM);
}

function formatFrac(v: number): string {
	const candidates: Array<{ s: string; v: number }> = [
		{ s: '1/8', v: 0.125 },
		{ s: '1/4', v: 0.25 },
		{ s: '1/2', v: 0.5 },
		{ s: '3/4', v: 0.75 },
	];
	let best = candidates[0];
	if (best === undefined) return v.toFixed(2);
	let bestErr = Math.abs(best.v - v);
	for (const c of candidates) {
		const e = Math.abs(c.v - v);
		if (e < bestErr) {
			best = c;
			bestErr = e;
		}
	}
	return best.s;
}

/**
 * Pick the most teachable single weather symbol from the present-weather
 * groups. Maps the most common to a short legible glyph; anything outside
 * the set falls through to the raw 3-letter group.
 */
function primaryWeatherSymbol(weather: readonly string[]): string | null {
	if (weather.length === 0) return null;
	const first = weather[0] ?? '';
	const intensity = first.startsWith('+') ? '+' : first.startsWith('-') ? '-' : '';
	const body = first.replace(/^[+-]/, '');

	if (body.includes('TS')) return `${intensity}TS`;
	if (body.includes('SN')) return `${intensity}SN`;
	if (body.includes('RA') && body.includes('FZ')) return `${intensity}ZR`;
	if (body.includes('RA')) return `${intensity}RA`;
	if (body.includes('DZ')) return `${intensity}DZ`;
	if (body === 'FG' || body === 'BR') return body;
	if (body === 'HZ') return 'HZ';
	if (body === 'BLSN') return 'BS';
	return first;
}
