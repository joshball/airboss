/**
 * PIREP plot glyph renderer.
 *
 * Per WP design.md "pirep-plot-grid (Phase C)" symbol set + AIM 7-1-22 /
 * 7-1-23 conventions:
 *
 * - Turbulence reports: triangle (light), filled triangle (mod),
 *   stacked triangle (severe).
 * - Icing reports: zigzag (rime), zigzag with dots (mixed),
 *   zigzag with circles (clear).
 * - Sky cover: small open/filled circle to the right of the icon.
 * - Altitude: numeric label below the glyph (in hundreds of feet, AGL
 *   per FAA convention).
 * - Urgent (UUA) reports: red outer halo around the glyph.
 *
 * Layout (anchored at the centroid of the PIREP report position):
 *
 *     [TB icon]   [SK]
 *     [IC icon]
 *       FL058
 *
 * The renderer composes one `<g class="pirep">` per parsed PIREP. Pure
 * SVG-string emission, no Node imports.
 */

import type {
	IcingIntensity,
	IcingReport,
	IcingType,
	ParsedPirep,
	PirepCloudLayer,
	TurbulenceReport,
} from '../wx/pirep/types';

const COLOR_FG = '#1f1d18';
const COLOR_TURB = '#b5651d';
const COLOR_ICING = '#2c5f9b';
const COLOR_URGENT = '#c62828';
const COLOR_LABEL = '#3d3a32';

export interface PirepGlyphInput {
	parsed: ParsedPirep;
	/** Glyph center in screen-space coords. */
	cx: number;
	cy: number;
	/**
	 * Optional pre-displaced original anchor coordinates -- when the chart
	 * ran collision avoidance and moved the glyph, these are stamped as
	 * data-true-x / data-true-y attributes for traceability.
	 */
	trueX?: number;
	trueY?: number;
}

export interface PirepGlyphOptions {
	/** Glyph half-width in pixels (turbulence triangles span 2x this). Default 7. */
	iconHalfWidthPx?: number;
	/** Distance from center to the sky-cover circle (px). Default 14. */
	skyCircleOffsetPx?: number;
	/** Show the FL altitude label below the glyph. Default true. */
	showAltitudeLabel?: boolean;
}

interface PirepGlyphDefaults {
	iconHalfWidthPx: number;
	skyCircleOffsetPx: number;
	showAltitudeLabel: boolean;
}

const DEFAULTS: PirepGlyphDefaults = {
	iconHalfWidthPx: 7,
	skyCircleOffsetPx: 14,
	showAltitudeLabel: true,
};

/**
 * Render one PIREP glyph as an SVG `<g>` fragment. Returns the inner
 * SVG (no wrapping at the band level).
 */
export function renderPirepGlyph(input: PirepGlyphInput, options: PirepGlyphOptions = {}): string {
	const opts = { ...DEFAULTS, ...options };
	const { parsed, cx, cy } = input;

	const trueXAttr = input.trueX !== undefined ? ` data-true-x="${input.trueX.toFixed(1)}"` : '';
	const trueYAttr = input.trueY !== undefined ? ` data-true-y="${input.trueY.toFixed(1)}"` : '';
	const urgentAttr = parsed.kind === 'UUA' ? ' data-urgent="true"' : '';

	const fragments: string[] = [];

	// Urgent halo behind everything else.
	if (parsed.kind === 'UUA') {
		fragments.push(
			`<circle cx="0" cy="0" r="${opts.iconHalfWidthPx + 6}" fill="none" stroke="${COLOR_URGENT}" stroke-width="1.4" opacity="0.6" />`,
		);
	}

	// Turbulence (top-left of icon stack).
	if (parsed.turbulence !== null) {
		fragments.push(renderTurbulenceIcon(parsed.turbulence, opts));
	}

	// Icing (below turbulence).
	if (parsed.icing !== null) {
		fragments.push(
			`<g transform="translate(0, ${opts.iconHalfWidthPx * 2 + 2})">${renderIcingIcon(parsed.icing, opts)}</g>`,
		);
	}

	// Sky cover (right of icon stack).
	if (parsed.skyCover.length > 0) {
		const cover = parsed.skyCover[0];
		if (cover !== undefined) {
			fragments.push(`<g transform="translate(${opts.skyCircleOffsetPx}, 0)">${renderPirepSkyCircle(cover)}</g>`);
		}
	}

	// Altitude label below the glyph.
	if (opts.showAltitudeLabel && parsed.altitudeFt !== null) {
		const flLabel = `FL${String(Math.round(parsed.altitudeFt / 100)).padStart(3, '0')}`;
		fragments.push(
			`<text x="0" y="${opts.iconHalfWidthPx * 2 + 18}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLOR_LABEL}">${flLabel}</text>`,
		);
	}

	return `<g class="pirep" data-station="${parsed.station}"${urgentAttr}${trueXAttr}${trueYAttr} transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">${fragments.join('')}</g>`;
}

function renderTurbulenceIcon(turb: TurbulenceReport, opts: PirepGlyphDefaults): string {
	const w = opts.iconHalfWidthPx;
	switch (turb.intensity) {
		case 'NEG':
			// Negative report -- minus sign.
			return `<line x1="${-w}" y1="0" x2="${w}" y2="0" stroke="${COLOR_TURB}" stroke-width="1.4" />`;
		case 'LGT':
			// Empty triangle (apex up).
			return triangle(w, COLOR_TURB, false);
		case 'MOD':
			// Filled triangle.
			return triangle(w, COLOR_TURB, true);
		case 'SEV':
			// Stacked: filled bottom + empty top, slightly larger.
			return `<g>${triangle(w, COLOR_TURB, true)}<g transform="translate(0, ${-w - 1})">${triangle(Math.round(w * 0.85), COLOR_TURB, false)}</g></g>`;
		case 'EXTM':
			// Two stacked filled triangles.
			return `<g>${triangle(w, COLOR_TURB, true)}<g transform="translate(0, ${-w - 1})">${triangle(Math.round(w * 0.85), COLOR_TURB, true)}</g></g>`;
	}
	return '';
}

function renderIcingIcon(icing: IcingReport, opts: PirepGlyphDefaults): string {
	const w = opts.iconHalfWidthPx;
	const intensityZigs = intensityToZigs(icing.intensity);
	const path = zigzag(w, intensityZigs);
	const decoration = icingDecoration(icing.type, w);
	return `<g>${path}${decoration}</g>`;
}

function intensityToZigs(intensity: IcingIntensity): number {
	switch (intensity) {
		case 'NEG':
			return 0;
		case 'TRC':
			return 1;
		case 'LGT':
			return 2;
		case 'MOD':
			return 3;
		case 'SEV':
			return 4;
	}
}

function zigzag(halfWidth: number, zigs: number): string {
	if (zigs === 0) {
		return `<line x1="${-halfWidth}" y1="0" x2="${halfWidth}" y2="0" stroke="${COLOR_ICING}" stroke-width="1.2" />`;
	}
	const totalWidth = halfWidth * 2;
	const segmentWidth = totalWidth / Math.max(zigs * 2, 1);
	const points: string[] = [];
	for (let i = 0; i <= zigs * 2; i += 1) {
		const x = -halfWidth + i * segmentWidth;
		const y = i % 2 === 0 ? -2.5 : 2.5;
		points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
	}
	return `<polyline points="${points.join(' ')}" fill="none" stroke="${COLOR_ICING}" stroke-width="1.2" stroke-linejoin="round" />`;
}

function icingDecoration(type: IcingType | null, halfWidth: number): string {
	if (type === null) return '';
	const y = 6;
	if (type === 'CLR') {
		// Open circles at the endpoints to indicate clear icing.
		return `<circle cx="${-halfWidth}" cy="${y}" r="1.6" fill="none" stroke="${COLOR_ICING}" stroke-width="0.8" />
<circle cx="${halfWidth}" cy="${y}" r="1.6" fill="none" stroke="${COLOR_ICING}" stroke-width="0.8" />`;
	}
	if (type === 'MX') {
		// Small filled dots for mixed icing.
		return `<circle cx="${-halfWidth}" cy="${y}" r="1.2" fill="${COLOR_ICING}" />
<circle cx="${halfWidth}" cy="${y}" r="1.2" fill="${COLOR_ICING}" />`;
	}
	// RIME -- no decoration; the bare zigzag is the rime convention.
	return '';
}

function triangle(halfWidth: number, color: string, filled: boolean): string {
	const apex = -halfWidth;
	const base = halfWidth;
	const path = `M ${(-halfWidth).toFixed(2)} ${base} L ${halfWidth.toFixed(2)} ${base} L 0 ${apex} Z`;
	return `<path d="${path}" fill="${filled ? color : 'none'}" stroke="${color}" stroke-width="1.1" stroke-linejoin="round" />`;
}

function renderPirepSkyCircle(layer: PirepCloudLayer): string {
	switch (layer.cover) {
		case 'CLR':
		case 'SKC':
			return `<circle cx="0" cy="0" r="3.5" fill="white" stroke="${COLOR_FG}" stroke-width="0.8" />`;
		case 'FEW':
			return `<circle cx="0" cy="0" r="3.5" fill="white" stroke="${COLOR_FG}" stroke-width="0.8" />
<path d="M 0 0 L 0 -3.5 A 3.5 3.5 0 0 1 3.5 0 Z" fill="${COLOR_FG}" />`;
		case 'SCT':
			return `<circle cx="0" cy="0" r="3.5" fill="white" stroke="${COLOR_FG}" stroke-width="0.8" />
<path d="M 0 0 L 0 -3.5 A 3.5 3.5 0 0 1 0 3.5 Z" fill="${COLOR_FG}" />`;
		case 'BKN':
			return `<circle cx="0" cy="0" r="3.5" fill="white" stroke="${COLOR_FG}" stroke-width="0.8" />
<path d="M 0 0 L 0 -3.5 A 3.5 3.5 0 1 1 -3.5 0 Z" fill="${COLOR_FG}" />`;
		case 'OVC':
			return `<circle cx="0" cy="0" r="3.5" fill="${COLOR_FG}" stroke="${COLOR_FG}" stroke-width="0.8" />`;
		case 'OVX':
			return `<circle cx="0" cy="0" r="3.5" fill="white" stroke="${COLOR_FG}" stroke-width="0.8" />
<line x1="-2.4" y1="-2.4" x2="2.4" y2="2.4" stroke="${COLOR_FG}" stroke-width="1" />
<line x1="-2.4" y1="2.4" x2="2.4" y2="-2.4" stroke="${COLOR_FG}" stroke-width="1" />`;
	}
}
