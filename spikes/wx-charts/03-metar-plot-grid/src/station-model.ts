/**
 * FAA-style surface observation station model renderer.
 *
 * One station = a `<g class="station">` template containing 6-8 sub-
 * elements positioned around a central cloud-cover circle. Reusable
 * across surface-analysis charts (Spike 1 had a sparse 12-station overlay)
 * and the dense plot here (Spike 3).
 *
 * Reference: FMH-1 (Federal Meteorological Handbook 1) station model.
 * NWS JetStream summary: https://www.weather.gov/jetstream/wxmaps
 *
 * Layout (point coordinates relative to station center, +x right +y down):
 *
 *     TT  PPP                          T = temperature       P = altimeter (3 digits)
 *     wx OO                            wx = present weather  OO = cloud-cover circle
 *     VV                               V  = visibility (statute miles)
 *     DD                               D  = dewpoint
 *
 *   shaft + barbs from center pointing in the FROM direction (upwind).
 *
 * Colors follow FAA convention:
 *   temperature  -- red
 *   dewpoint     -- green (slate-green here so it reads on white)
 *   weather      -- magenta-ish (precipitation = green by tradition,
 *                   but here we use a single accent color for legibility)
 *   altimeter    -- black
 *   wind         -- black
 *   cloud circle -- black outline, partial fill
 *
 * The pivot for "is this station IFR?" is encoded via the cloud-cover
 * circle stroke color: a thin red ring around the circle when the
 * station is IFR/LIFR. This is a teaching overlay (NOT in the FAA
 * standard), but is the spike-3 minimum-viable pedagogical annotation
 * to demonstrate the chart can be enriched with category cues.
 */

import {
	celsiusToFahrenheit,
	ceilingFtAgl,
	flightCategory,
	summarizeCover,
	type FlightCategory,
	type ParsedMetar,
	type SkyCover,
} from './metar';

const COLOR_TEMP = '#cc1f1f';
const COLOR_DEW = '#2c8742';
const COLOR_WX = '#7d3eb5';
const COLOR_TEXT = '#1f1d18';
const COLOR_WIND = '#1f1d18';
const COLOR_CIRCLE_FILL = '#1f1d18';
const COLOR_CIRCLE_STROKE = '#1f1d18';

const CATEGORY_RING: Record<FlightCategory, string | null> = {
	VFR: null,
	MVFR: '#1565c0', // blue ring
	IFR: '#c62828', // red ring
	LIFR: '#6a1b9a', // purple ring
};

// Station-model glyph radius (cloud-cover circle radius, px).
const R = 6;

// Wind shaft length, px. Should be long enough that barbs are clearly
// visible at this glyph density without crowding neighbors.
const SHAFT_LEN = 22;

// Barb geometry
const BARB_LEN = 9;
const BARB_SPACING = 3.5;
const BARB_OFFSET_FROM_TIP = 1; // px gap from upwind tip before first barb

export interface StationGlyphInput {
	parsed: ParsedMetar;
	cx: number;
	cy: number;
}

/**
 * Render one station model as an SVG `<g>`. Coordinates are absolute
 * (in chart space). Returns the SVG fragment as a string.
 */
export function renderStationModel(input: StationGlyphInput): string {
	const { parsed, cx, cy } = input;
	const cover = summarizeCover(parsed.clouds);
	const ceil = ceilingFtAgl(parsed.clouds);
	const cat = flightCategory(ceil, parsed.visibilitySM);

	const parts: string[] = [];

	parts.push(`<g class="station" data-station="${parsed.station}" data-cat="${cat}" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">`);

	// Wind shaft + barbs (drawn first so the cloud circle and labels
	// land on top of any visual collision near the center).
	const wind = parsed.wind;
	if (wind && !wind.calm) {
		parts.push(renderWindShaft(wind.directionDeg, wind.speedKt));
	} else if (wind && wind.calm) {
		// Calm wind: a small ring around the center circle (FAA convention).
		parts.push(`<circle cx="0" cy="0" r="${R + 4}" fill="none" stroke="${COLOR_WIND}" stroke-width="0.7" />`);
	}

	// Cloud cover circle
	parts.push(renderCloudCircle(cover, cat));

	// Temperature (top-left)
	if (parsed.tempC !== null) {
		const tempF = celsiusToFahrenheit(parsed.tempC);
		parts.push(`<text x="-10" y="-7" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_TEMP}">${tempF}</text>`);
	}

	// Dewpoint (bottom-left)
	if (parsed.dewpointC !== null) {
		const dewF = celsiusToFahrenheit(parsed.dewpointC);
		parts.push(`<text x="-10" y="11" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_DEW}">${dewF}</text>`);
	}

	// Altimeter (top-right) -- last 3 digits of pressure: 30.12 -> "012"
	if (parsed.altimeterInHg !== null) {
		const kollsman = altimeterKollsman(parsed.altimeterInHg);
		parts.push(`<text x="10" y="-7" font-size="9" font-weight="600" fill="${COLOR_TEXT}">${kollsman}</text>`);
	}

	// Visibility (left of weather symbol, only if non-VFR or low)
	if (parsed.visibilitySM !== null && parsed.visibilitySM <= 6) {
		const visStr = formatVis(parsed.visibilitySM);
		parts.push(`<text x="-22" y="3" text-anchor="end" font-size="9" font-weight="600" fill="${COLOR_TEXT}">${visStr}</text>`);
	}

	// Present weather (left of cloud circle)
	const wxSym = primaryWeatherSymbol(parsed.weather);
	if (wxSym) {
		parts.push(`<text x="-12" y="3" text-anchor="end" font-size="10" font-weight="700" fill="${COLOR_WX}">${wxSym}</text>`);
	}

	// Station ID label (small, below)
	parts.push(
		`<text x="0" y="${R + 11}" text-anchor="middle" font-size="7" font-weight="500" fill="#7a7568" letter-spacing="0.2">${parsed.station.replace(/^K/, '')}</text>`,
	);

	parts.push('</g>');
	return parts.join('');
}

/**
 * Cloud cover circle. SKC/CLR/NSC = open. FEW = 1/4 fill (one quarter).
 * SCT = 1/2 (left half). BKN = 3/4. OVC = full. VV = X (obscured).
 *
 * Quarter fills use clipping wedges (pie slices). The standard FAA
 * convention is a vertical line through the circle for SCT (left half),
 * and stacked quarter wedges for FEW/BKN. We follow that here.
 */
function renderCloudCircle(cover: SkyCover, cat: FlightCategory): string {
	const ringColor = CATEGORY_RING[cat];
	const ringSvg = ringColor
		? `<circle cx="0" cy="0" r="${R + 1.7}" fill="none" stroke="${ringColor}" stroke-width="1.4" opacity="0.85" />`
		: '';

	const baseCircle = `<circle cx="0" cy="0" r="${R}" fill="white" stroke="${COLOR_CIRCLE_STROKE}" stroke-width="1" />`;

	let fillFragment = '';
	switch (cover) {
		case 'SKC':
		case 'CLR':
		case 'NSC':
			fillFragment = '';
			break;
		case 'FEW':
			// Top wedge (one quarter), 90 deg
			fillFragment = pieWedge(R, 270, 360); // 90deg arc starting at 12 o'clock
			break;
		case 'SCT':
			// Right half filled
			fillFragment = pieWedge(R, 270, 90);
			break;
		case 'BKN':
			// 3/4 filled
			fillFragment = pieWedge(R, 270, 180);
			break;
		case 'OVC':
			fillFragment = `<circle cx="0" cy="0" r="${R}" fill="${COLOR_CIRCLE_FILL}" />`;
			break;
		case 'VV':
			// Obscured -- X through the circle
			fillFragment = `<line x1="${-R + 1}" y1="${-R + 1}" x2="${R - 1}" y2="${R - 1}" stroke="${COLOR_CIRCLE_FILL}" stroke-width="1.2" />
				<line x1="${-R + 1}" y1="${R - 1}" x2="${R - 1}" y2="${-R + 1}" stroke="${COLOR_CIRCLE_FILL}" stroke-width="1.2" />`;
			break;
	}

	return `${ringSvg}${baseCircle}${fillFragment}`;
}

/**
 * Pie-wedge path (filled) from startAngleDeg to endAngleDeg, sweeping
 * clockwise. 0 deg = +x (3 o'clock); 90 = +y (6 o'clock); 180 = -x;
 * 270 = -y (12 o'clock). We use 12 o'clock (270) as the "top" reference.
 */
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
 * Wind shaft + barbs. The shaft starts at the cloud circle edge and
 * points in the direction the wind is FROM (i.e. upwind), per FAA
 * convention. Barbs sit on the LEFT side of the shaft when looking
 * from station outward (Northern-Hemisphere convention).
 *
 * Direction convention: a 270 KT wind is from the WEST -- the shaft
 * extends from the station to the WEST.
 *
 * Speed encoding (FAA):
 *   1-2 KT: shaft only (we render no shaft for sub-3 KT to stay closer
 *           to the convention of "calm = circle ring")
 *   3-7 KT: half barb (5 KT)
 *   8-12 KT: full barb (10 KT)
 *   ...up by 5 KT each: half barbs combine with full barbs
 *   50 KT: pennant (filled triangle)
 *   55-95 KT: pennant + barbs
 *   100+ KT: 2 pennants
 *
 * Speed rounding: the shaft total is the speed rounded to the nearest 5 KT.
 */
function renderWindShaft(dirFromDeg: number | null, speedKt: number): string {
	if (dirFromDeg === null) return ''; // VRB (variable) -- omit shaft, station ring stays
	if (speedKt < 3) return '';

	// Convert "FROM" direction to a unit vector pointing OUTWARD from the
	// station. Meteorological 0deg = N (toward), so "wind from N" -> shaft
	// points NORTH (-y in screen space). dir 90 = E -> shaft points EAST (+x).
	const rad = ((dirFromDeg - 90) * Math.PI) / 180; // rotate so 0deg -> north (-y)
	// Standard math: dir 0 = north. In screen coords, north = (0, -1).
	// So unit vector for "shaft pointing toward the FROM direction":
	//   ux = sin(dirRad) ; uy = -cos(dirRad) -- where dirRad uses the meteorological convention.
	const dirRad = (dirFromDeg * Math.PI) / 180;
	const ux = Math.sin(dirRad);
	const uy = -Math.cos(dirRad);

	// Shaft extends from circle edge to (R + SHAFT_LEN) along (ux, uy).
	const x0 = ux * R;
	const y0 = uy * R;
	const x1 = ux * (R + SHAFT_LEN);
	const y1 = uy * (R + SHAFT_LEN);

	const parts: string[] = [];
	parts.push(`<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`);

	// Barbs: rounded to the nearest 5 KT; pennants for each 50, full
	// barbs for each 10, half barb for the leftover 5.
	const rounded = Math.round(speedKt / 5) * 5;
	let remaining = rounded;
	const pennants = Math.floor(remaining / 50);
	remaining -= pennants * 50;
	const fullBarbs = Math.floor(remaining / 10);
	remaining -= fullBarbs * 10;
	const halfBarbs = Math.floor(remaining / 5);

	// Perpendicular unit vector pointing to the LEFT of the shaft when
	// the viewer stands at the station and looks OUTWARD along the shaft
	// (i.e. toward the upwind FROM direction). This is the Northern
	// Hemisphere wind-barb side.
	//
	// Screen coords have +y = down, so a CCW rotation visually is a CW
	// rotation mathematically. CW math rotation of (ux,uy) is (uy, -ux).
	//
	// Sanity checks:
	//   wind from N  (dir=0):  outward=(0,-1) shaft up    -> left=(-1,0) west, screen left  -- correct
	//   wind from E  (dir=90): outward=(1,0)  shaft right -> left=(0,-1) north, screen up   -- correct
	//   wind from S  (dir=180):outward=(0,1)  shaft down  -> left=(1,0)  east, screen right -- correct
	//   wind from W  (dir=270):outward=(-1,0) shaft left  -> left=(0,1)  south, screen down -- correct
	const px = uy;
	const py = -ux;

	// Place barbs starting at the upwind tip and walking back toward the
	// station. The first barb is at the tip; subsequent barbs are spaced.
	let walked = BARB_OFFSET_FROM_TIP;

	for (let i = 0; i < pennants; i += 1) {
		const baseT = R + SHAFT_LEN - walked;
		// Pennant is a filled triangle from the shaft outward (LEFT side).
		const a = onShaft(ux, uy, baseT);
		const b = onShaft(ux, uy, baseT - BARB_SPACING * 1.5);
		const c = { x: a.x + px * BARB_LEN, y: a.y + py * BARB_LEN };
		parts.push(
			`<path d="M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z" fill="${COLOR_WIND}" />`,
		);
		walked += BARB_SPACING * 2;
	}
	for (let i = 0; i < fullBarbs; i += 1) {
		const baseT = R + SHAFT_LEN - walked;
		const a = onShaft(ux, uy, baseT);
		const b = { x: a.x + px * BARB_LEN, y: a.y + py * BARB_LEN };
		parts.push(`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`);
		walked += BARB_SPACING;
	}
	for (let i = 0; i < halfBarbs; i += 1) {
		// If a half-barb is the only feature, FAA convention places it
		// SHIFTED inward by one barb-spacing so it doesn't sit at the tip
		// (otherwise it reads like a full-barb at low magnification).
		// We keep the standard placement here for clarity.
		const baseT = R + SHAFT_LEN - walked;
		const a = onShaft(ux, uy, baseT);
		const b = { x: a.x + px * (BARB_LEN / 2), y: a.y + py * (BARB_LEN / 2) };
		parts.push(`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${COLOR_WIND}" stroke-width="1.0" />`);
		walked += BARB_SPACING;
	}

	return parts.join('');
}

function onShaft(ux: number, uy: number, t: number): { x: number; y: number } {
	return { x: ux * t, y: uy * t };
}

function altimeterKollsman(inHg: number): string {
	// e.g. 30.12 -> "012", 29.92 -> "992"
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
	// Snap to common METAR fractions: 1/8, 1/4, 1/2, 3/4
	const candidates: Array<{ s: string; v: number }> = [
		{ s: '1/8', v: 0.125 },
		{ s: '1/4', v: 0.25 },
		{ s: '1/2', v: 0.5 },
		{ s: '3/4', v: 0.75 },
	];
	let best = candidates[0];
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
 * groups. We map the 5-10 most common to a short legible glyph (single
 * char or two-char). Anything outside the set falls through to the raw
 * 3-letter group (e.g. "+SN") which is still readable.
 *
 * Implemented set: rain (R), snow (S), drizzle (D), fog (F), thunderstorm
 * (T), haze (H), blowing snow (BS), shower (SH-prefix), freezing (FZ-prefix).
 *
 * We render plain text rather than the FAA glyph fonts; the spike scope
 * cut to keep this readable without shipping a private font.
 */
function primaryWeatherSymbol(weather: readonly string[]): string | null {
	if (weather.length === 0) return null;
	// Pick first significant group; many METARs have one obvious wx code.
	const first = weather[0];
	// Strip intensity prefix for symbol lookup, keep for return.
	const intensity = first.startsWith('+') ? '+' : first.startsWith('-') ? '-' : '';
	const body = first.replace(/^[+-]/, '');

	// Common intensities passed through textually.
	if (body.includes('TS')) return `${intensity}TS`;
	if (body.includes('SN')) return `${intensity}SN`;
	if (body.includes('RA') && body.includes('FZ')) return `${intensity}ZR`;
	if (body.includes('RA')) return `${intensity}RA`;
	if (body.includes('DZ')) return `${intensity}DZ`;
	if (body === 'FG' || body === 'BR') return body;
	if (body === 'HZ') return 'HZ';
	if (body === 'BLSN') return 'BS';
	// Fallback: return the raw group (FAA convention is to read the text).
	return first;
}
