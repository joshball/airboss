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
