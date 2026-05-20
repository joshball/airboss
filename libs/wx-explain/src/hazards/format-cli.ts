/**
 * Render decoded hazards as a pilot-friendly CLI string.
 *
 * Design notes baked into the layout:
 *   - Zulu first, local second on every timestamp.
 *   - Color encodes severity (red severe, yellow significant, dim info).
 *   - Outlook polygons are visually demoted vs the active hazard.
 *   - VOR identifiers gloss into navaid names when known.
 *
 * Browser-safe (no Node imports, no Buffer). Falls back to plain text
 * when colors are disabled or stdout is not a TTY.
 */

import { describeRelative, formatDuration, formatLocalShort, formatZulu } from './time';
import type {
	ConvectiveOutlook,
	ConvectiveOutlookArea,
	ConvectivePhenomenon,
	ConvectiveSigmet,
	DecodedHazard,
	HazardBoundary,
	HazardFromPoint,
	HazardMovement,
	HazardQuadrant,
	SevereThunderstormWarning,
} from './types';

const RULE = '─'.repeat(72);

export interface FormatOptions {
	/** Use ANSI escape sequences (default: true). */
	color?: boolean;
	/** IANA timezone for local-time rendering (default: 'UTC'). */
	tz?: string;
	/** Reference "now" for relative-time labels (default: new Date()). */
	now?: Date;
	/** Render full original bulletin under the decoded view (default: false). */
	includeRaw?: boolean;
}

export function formatHazards(hazards: readonly DecodedHazard[], opts: FormatOptions = {}): string {
	const color = opts.color ?? true;
	const tz = opts.tz ?? 'UTC';
	const now = opts.now ?? new Date();
	const includeRaw = opts.includeRaw ?? false;
	const ctx = { color, tz, now, includeRaw };
	if (hazards.length === 0) return paint(ctx.color, 'dim', 'No recognized hazards in input.');
	return hazards.map((h) => formatOne(h, ctx)).join('\n\n');
}

interface RenderCtx {
	color: boolean;
	tz: string;
	now: Date;
	includeRaw: boolean;
}

function formatOne(hazard: DecodedHazard, ctx: RenderCtx): string {
	switch (hazard.kind) {
		case 'convective-sigmet':
			return formatConvectiveSigmet(hazard, ctx);
		case 'severe-thunderstorm-warning':
			return formatSvr(hazard, ctx);
	}
}

function formatConvectiveSigmet(h: ConvectiveSigmet, ctx: RenderCtx): string {
	const lines: string[] = [];
	const banner = paint(ctx.color, 'redBold', `⚠ ACTIVE CONVECTIVE SIGMET ${h.seriesId}`);
	const regionGloss = REGION_GLOSS[h.region];
	lines.push(rule(ctx.color));
	lines.push(`  ${banner}   ${paint(ctx.color, 'dim', regionGloss)}`);
	// Issued line keeps the Zulu instant alone -- the local-time pairing
	// belongs in the VALID block below so the header doesn't repeat it.
	lines.push(
		`  ${paint(ctx.color, 'dim', h.wmoHeader)} · issued ${formatZulu(h.issuedAt)} · series ${h.seriesNumber} of day`,
	);
	lines.push(rule(ctx.color));
	lines.push('');

	lines.push(`  ${label(ctx.color, 'VALID')}`);
	lines.push(
		`    From   ${formatZuluPair(h.validFrom, ctx)}   ${paint(
			ctx.color,
			'dim',
			`(${describeRelative(h.validFrom, ctx.now, 'starts')})`,
		)}`,
	);
	lines.push(
		`    Until  ${formatZuluPair(h.validUntil, ctx)}   ${paint(
			ctx.color,
			'dim',
			`(${describeRelative(h.validUntil, ctx.now, 'ends')})`,
		)}`,
	);
	const windowMin = (h.validUntil.getTime() - h.validFrom.getTime()) / 60_000;
	lines.push(`    Window ${formatDuration(windowMin)}`);
	lines.push('');

	if (h.affectedRegions.length > 0) {
		lines.push(`  ${label(ctx.color, 'AFFECTED')}  ${h.affectedRegions.join(' · ')}`);
		lines.push('');
	}

	if (h.boundary.points.length > 0) {
		lines.push(
			`  ${label(ctx.color, 'BOUNDARY')}  Polygon, ${h.boundary.points.length} vertices (FROM-points relative to VORs)`,
		);
		for (const [i, point] of h.boundary.points.entries()) {
			lines.push(`      ${circled(i + 1)} ${formatFromPoint(point, ctx)}`);
		}
		lines.push('');
	}

	lines.push(`  ${label(ctx.color, 'PHENOMENON')}  ${describePhenomenon(h.phenomenon)}`);
	if (h.movement) {
		lines.push(`    Movement    ${describeMovement(h.movement)}`);
	}
	if (h.topsFL !== null) {
		lines.push(`    Tops        FL${h.topsFL}  (${(h.topsFL * 100).toLocaleString()} ft)`);
	}
	lines.push(`    Severity    ${paint(ctx.color, 'red', 'Implied VIP 4+ or worse')} (definition of convective SIGMET)`);
	lines.push('');

	if (h.outlook) {
		lines.push(formatOutlook(h.outlook, ctx));
	}

	lines.push(rule(ctx.color));
	lines.push(
		`  ${label(ctx.color, 'SOURCE')}  Aviation Weather Center, Kansas City   ${paint(ctx.color, 'dim', '(WSUS3x KKCI)')}`,
	);
	lines.push(`  ${label(ctx.color, 'PRODUCT')}  Convective SIGMET — ${regionGloss}`);
	if (ctx.includeRaw) {
		lines.push(rule(ctx.color));
		lines.push(paint(ctx.color, 'dim', indent(h.raw, 2)));
	}
	lines.push(rule(ctx.color));
	return lines.join('\n');
}

function formatOutlook(outlook: ConvectiveOutlook, ctx: RenderCtx): string {
	const lines: string[] = [];
	const banner = paint(ctx.color, 'dim', 'ℹ OUTLOOK — forecast of upcoming SIGMETs (no hazard declared)');
	lines.push(rule(ctx.color));
	lines.push(`  ${banner}`);
	const fromZ = formatZuluPair(outlook.validFrom, ctx);
	const toZ = formatZuluPair(outlook.validUntil, ctx);
	const windowMin = (outlook.validUntil.getTime() - outlook.validFrom.getTime()) / 60_000;
	lines.push(`  valid ${fromZ}  →  ${toZ}    (${formatDuration(windowMin)})`);
	lines.push(rule(ctx.color));
	lines.push('');
	for (const area of outlook.areas) {
		lines.push(formatOutlookArea(area, ctx));
		lines.push('');
	}
	return lines.join('\n');
}

function formatOutlookArea(area: ConvectiveOutlookArea, ctx: RenderCtx): string {
	const lines: string[] = [];
	const gloss = describeAreaGloss(area.boundary);
	lines.push(`  ${label(ctx.color, area.label)}  ${gloss}`);
	lines.push(
		`    Boundary  ${area.boundary.points.length} vertices  ${paint(ctx.color, 'dim', summarizeBoundary(area.boundary))}`,
	);
	if (area.references.length > 0) {
		lines.push(`    Refers    ${area.references.map(describeReference).join(',  ')}`);
	}
	if (area.narrative.length > 0) {
		const summary = summarizeNarrative(area.narrative);
		if (summary) lines.push(`    Forecast  ${summary}`);
	}
	return lines.join('\n');
}

function formatSvr(h: SevereThunderstormWarning, ctx: RenderCtx): string {
	const lines: string[] = [];
	const banner = paint(ctx.color, 'redBold', '⚠ SEVERE THUNDERSTORM WARNING');
	lines.push(rule(ctx.color));
	lines.push(`  ${banner}   ${paint(ctx.color, 'dim', `office ${h.office}`)}`);
	if (h.validFrom) {
		lines.push(`  ${paint(ctx.color, 'dim', 'issued')} ${formatZuluPair(h.validFrom, ctx)}`);
	}
	lines.push(rule(ctx.color));
	lines.push('');
	lines.push(
		`  ${label(ctx.color, 'UNTIL')}  ${formatZuluPair(h.validUntil, ctx)}   ${paint(
			ctx.color,
			'dim',
			`(${describeRelative(h.validUntil, ctx.now, 'ends')})`,
		)}`,
	);
	if (h.areaDescription) {
		lines.push(`  ${label(ctx.color, 'AREA')}  ${h.areaDescription}`);
	}
	const threats: string[] = [];
	if (h.maxWindMph !== null) threats.push(`wind to ${h.maxWindMph} mph`);
	if (h.maxHailIn !== null) threats.push(`hail to ${h.maxHailIn}"`);
	if (h.tornadoPossible) threats.push(paint(ctx.color, 'redBold', 'tornado possible'));
	if (threats.length > 0) {
		lines.push(`  ${label(ctx.color, 'THREATS')}  ${threats.join('  ·  ')}`);
	}
	if (h.polygon && h.polygon.length > 0) {
		lines.push(
			`  ${label(ctx.color, 'POLYGON')}  ${h.polygon.length} vertices  ${paint(
				ctx.color,
				'dim',
				polygonSummary(h.polygon),
			)}`,
		);
	}
	if (h.narrative) {
		lines.push(`  ${label(ctx.color, 'HAZARD')}  ${h.narrative}`);
	}
	if (ctx.includeRaw) {
		lines.push(rule(ctx.color));
		lines.push(paint(ctx.color, 'dim', indent(h.raw, 2)));
	}
	lines.push(rule(ctx.color));
	return lines.join('\n');
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

const REGION_GLOSS: Record<ConvectiveSigmet['region'], string> = {
	SIGE: 'Eastern US (SIGE)',
	SIGC: 'Central US (SIGC)',
	SIGW: 'Western US (SIGW)',
};

function rule(color: boolean): string {
	return paint(color, 'dim', RULE);
}

function label(color: boolean, text: string): string {
	return paint(color, 'bold', text.padEnd(10, ' '));
}

function formatZuluPair(d: Date, ctx: RenderCtx): string {
	const zulu = formatZulu(d);
	if (ctx.tz === 'UTC') return zulu;
	const local = formatLocalShort(d, ctx.tz);
	return `${zulu}  ${paint(ctx.color, 'dim', '· ' + local)}`;
}

function formatFromPoint(point: HazardFromPoint, ctx: RenderCtx): string {
	// A point with distance 0 and the default 'N' quadrant is the "AT VOR"
	// shorthand -- render that without the misleading "0 nm N" prefix.
	const isAtVor = point.distanceNm === 0 && point.quadrant === 'N';
	const distance = isAtVor ? '  at  ' : `${String(point.distanceNm).padStart(3, ' ')} nm`;
	const quadrant = isAtVor ? '   ' : padQuadrant(point.quadrant);
	const navaid = point.navaidId.padEnd(3, ' ');
	const gloss = point.navaidName
		? paint(ctx.color, 'dim', `(${point.navaidName} VOR)`)
		: paint(ctx.color, 'dim', '(VOR unknown)');
	return `${distance}  ${quadrant}  ${navaid}  ${gloss}`;
}

function padQuadrant(q: HazardQuadrant): string {
	return q.padEnd(3, ' ');
}

function describePhenomenon(p: ConvectivePhenomenon): string {
	switch (p) {
		case 'area-ts':
			return 'Area of thunderstorms';
		case 'embedded-ts':
			return 'Embedded thunderstorms';
		case 'line-ts':
			return 'Line of thunderstorms';
		case 'isolated-ts':
			return 'Isolated thunderstorms';
		case 'severe-ts':
			return 'Severe thunderstorms (50+ kt sfc winds, 3/4" hail)';
		case 'tornado':
			return 'Tornadoes';
		case 'hail':
			return 'Hail (3/4" or larger)';
		case 'unknown':
			return 'Convective hazard';
	}
}

function describeMovement(m: HazardMovement): string {
	const toDeg = (m.fromDeg + 180) % 360;
	const toCompass = compassFromDeg(toDeg);
	return `FROM ${pad3(m.fromDeg)}° at ${m.speedKt} kt   (toward ${pad3(toDeg)}° / ${toCompass})`;
}

function pad3(n: number): string {
	return String(n).padStart(3, '0');
}

function compassFromDeg(deg: number): string {
	const idx = Math.round((deg % 360) / 22.5) % 16;
	const COMPASS: HazardQuadrant[] = [
		'N',
		'NNE',
		'NE',
		'ENE',
		'E',
		'ESE',
		'SE',
		'SSE',
		'S',
		'SSW',
		'SW',
		'WSW',
		'W',
		'WNW',
		'NW',
		'NNW',
	];
	return COMPASS[idx];
}

function circled(n: number): string {
	const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';
	if (n >= 1 && n <= 20) return CIRCLED[n - 1];
	return `(${n})`;
}

function summarizeBoundary(b: HazardBoundary): string {
	if (b.points.length === 0) return '';
	const ids = b.points.map((p) => p.navaidId);
	const dedup: string[] = [];
	for (const id of ids) {
		if (dedup[dedup.length - 1] !== id) dedup.push(id);
	}
	return `(${dedup.join('-')})`;
}

function describeAreaGloss(b: HazardBoundary): string {
	if (b.points.length === 0) return '';
	const states = new Set<string>();
	for (const p of b.points) {
		const lookup = navaidStateOrRegion(p);
		if (lookup) states.add(lookup);
	}
	if (states.size === 0) return '';
	return Array.from(states).join(' / ');
}

function navaidStateOrRegion(p: HazardFromPoint): string | null {
	// Coarse geographic gloss for the boundary summary line. Keep these
	// regions broad so the count of unique labels stays low (<= 4) on a
	// typical multi-state polygon.
	const STATE: Record<string, string> = {
		ENE: 'Northeast',
		SAX: 'Northeast',
		ALB: 'Northeast',
		MPV: 'Northeast',
		MSS: 'Northeast',
		BGR: 'Northeast',
		ACK: 'Northeast',
		BOS: 'Northeast',
		DCA: 'Mid-Atlantic',
		EKN: 'Mid-Atlantic',
		IAD: 'Mid-Atlantic',
		PSB: 'Mid-Atlantic',
		MRB: 'Mid-Atlantic',
		BVT: 'OH Valley',
		FWA: 'OH Valley',
		IND: 'OH Valley',
		ASP: 'Great Lakes',
		DXO: 'Great Lakes',
		LAN: 'Great Lakes',
		ORD: 'Great Lakes',
		GQO: 'Southeast',
		MSL: 'Southeast',
		MGM: 'Southeast',
		SAV: 'Southeast',
		CHS: 'Southeast',
		MIA: 'Florida',
		PBI: 'Florida',
		ORL: 'Florida',
		MLB: 'Florida',
		OMN: 'Florida',
		TRV: 'Florida',
		EYW: 'Gulf',
		TLH: 'Gulf',
		CEW: 'Gulf',
	};
	return STATE[p.navaidId] ?? null;
}

function describeReference(ref: string): string {
	const upper = ref.toUpperCase();
	if (/^WW\s+\d+/.test(upper)) return `${upper} (SPC Watch)`;
	if (/^ACUS\d+/.test(upper)) return `${upper} (SPC mesoscale discussion)`;
	return upper;
}

function summarizeNarrative(narrative: string): string {
	const compact = narrative.replace(/\s+/g, ' ').trim();
	if (/WST\s+ISSUANCES?\s+EXPD/i.test(compact)) return 'WST issuances expected in this area';
	if (compact.length <= 80) return compact;
	return `${compact.slice(0, 77)}...`;
}

function polygonSummary(polygon: readonly (readonly [number, number])[]): string {
	if (polygon.length === 0) return '';
	const lats = polygon.map((p) => p[0]);
	const lons = polygon.map((p) => p[1]);
	const minLat = Math.min(...lats).toFixed(2);
	const maxLat = Math.max(...lats).toFixed(2);
	const minLon = Math.min(...lons).toFixed(2);
	const maxLon = Math.max(...lons).toFixed(2);
	return `(${minLat}°N — ${maxLat}°N, ${minLon}° — ${maxLon}°)`;
}

function indent(text: string, by: number): string {
	const pad = ' '.repeat(by);
	return text
		.split('\n')
		.map((line) => pad + line)
		.join('\n');
}

// ----------------------------------------------------------------------
// ANSI paint -- minimal, no dependencies.
// ----------------------------------------------------------------------

type ColorKey = 'red' | 'redBold' | 'yellow' | 'dim' | 'bold';

const ANSI: Record<ColorKey, string> = {
	red: '[31m',
	redBold: '[31;1m',
	yellow: '[33m',
	dim: '[2m',
	bold: '[1m',
};
const RESET = '[0m';

function paint(color: boolean, key: ColorKey, text: string): string {
	if (!color) return text;
	return `${ANSI[key]}${text}${RESET}`;
}
