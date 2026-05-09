/**
 * Minimal METAR parser -- spike scope, station-model fields only.
 *
 * Why roll our own and not pull in `metar-taf-parser` from npm:
 *
 * - The spike is contained -- ~50 METARs, all from one timestamp, all
 *   well-formed (IEM ASOS archive). We don't need the rich
 *   {speci,trend,recent-weather,runway-state} coverage that
 *   `metar-taf-parser` adds.
 * - The station model needs ~8 fields: wind dir/speed/gusts, visibility,
 *   ceiling, sky cover (highest layer), temperature, dewpoint, altimeter,
 *   present weather (one symbol). All of those parse cleanly with a
 *   handful of regexes, ~120 lines of TS.
 * - Adding a runtime dependency to the spike for ~50 lines of saved
 *   parsing code is the wrong trade for a throwaway prototype.
 * - Documenting the field set we actually need feeds directly into the
 *   library WP -- so when production ingests the npm parser (or rolls
 *   the proper parser into a lib), we know exactly which fields the
 *   station model consumes.
 *
 * Coverage gaps explicitly NOT handled (acceptable spike scope cuts):
 *
 * - RMK section -- ignored (sea-level pressure, 6-hour temp/dewpoint,
 *   precip totals all live here; station model doesn't need them).
 * - Runway visual range (RVR) groups -- ignored.
 * - Trend forecast (BECMG/TEMPO) -- ignored.
 * - SPECI vs METAR distinction -- treated identically.
 * - Recent weather (RE prefix) -- ignored.
 * - Wind shear / variable wind directions (`310V040`) -- variable
 *   secondary direction discarded; primary direction kept.
 * - Vertical visibility (`VV004`) -- treated as obscured/X cloud cover.
 * - Cloud type tags after layer (`CB`, `TCU`) -- discarded.
 *
 * What we keep, mapped to station model layout:
 *
 *   top-left:   temperature in degF (converted from C)
 *   bottom-left: dewpoint in degF (converted from C)
 *   top-right:  altimeter "kollsman" digits (last 3 of inHg, e.g. 30.12 -> 012)
 *   bottom-right: pressure tendency / 3hr trend -- not in METAR body, OMITTED
 *   left of center: present weather code (e.g. RA, SN, FG, TS)
 *   center: cloud cover circle filled per highest reported layer
 *   shaft: wind direction (FROM) projected through center, length scaled
 *   barbs on shaft (left side, NH convention): half=5kt, full=10kt, pennant=50kt
 *   visibility: rendered as a number to the LEFT of the model, in SM
 */

export interface ParsedMetar {
	station: string; // ICAO 4-letter
	day: number; // day of month (Z)
	hour: number;
	minute: number;
	wind: WindGroup | null;
	visibilitySM: number | null; // statute miles, null if missing or CAVOK
	weather: string[]; // present weather codes, raw (e.g. "+RA", "BR", "VCTS")
	clouds: CloudLayer[];
	tempC: number | null;
	dewpointC: number | null;
	altimeterInHg: number | null;
	cavok: boolean;
	raw: string;
}

export interface WindGroup {
	directionDeg: number | null; // null if VRB (variable)
	speedKt: number;
	gustKt: number | null;
	variable: boolean; // VRB
	calm: boolean; // 00000KT
}

export interface CloudLayer {
	cover: SkyCover;
	heightFtAgl: number | null; // hundreds of feet * 100; null for VV/SKC/CLR
}

export type SkyCover = 'SKC' | 'CLR' | 'NSC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'VV';

/**
 * Parse a single METAR string. Throws if the body is unparseable.
 * Tolerant of unknown groups -- skips them.
 */
export function parseMetar(raw: string): ParsedMetar {
	const trimmed = raw.replace(/\s+=\s*$/, '').trim();
	// Split off RMK section if present; we ignore it.
	const beforeRmk = trimmed.split(/\bRMK\b/)[0]?.trim() ?? trimmed;
	const tokens = beforeRmk.split(/\s+/);

	let i = 0;

	// Optional METAR/SPECI/AMD/COR prefix
	if (tokens[i] === 'METAR' || tokens[i] === 'SPECI') i += 1;
	if (tokens[i] === 'COR' || tokens[i] === 'AMD') i += 1;

	const station = tokens[i];
	if (!station || !/^[A-Z]{4}$/.test(station)) {
		throw new Error(`metar: expected 4-letter station, got "${station}" in "${raw}"`);
	}
	i += 1;

	// DDhhmmZ
	const dt = tokens[i]?.match(/^(\d{2})(\d{2})(\d{2})Z$/);
	if (!dt) throw new Error(`metar: expected DDhhmmZ at token "${tokens[i]}" in "${raw}"`);
	const day = Number(dt[1]);
	const hour = Number(dt[2]);
	const minute = Number(dt[3]);
	i += 1;

	// AUTO/COR modifier
	if (tokens[i] === 'AUTO' || tokens[i] === 'COR') i += 1;

	// Wind: dddssKT or dddssGggKT, dir can be VRB
	let wind: WindGroup | null = null;
	const wm = tokens[i]?.match(/^(VRB|\d{3})(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)$/);
	if (wm) {
		const dir = wm[1];
		const speedRaw = Number(wm[2]);
		const gustRaw = wm[3] ? Number(wm[3]) : null;
		const unit = wm[4];
		const factor = unit === 'MPS' ? 1.94384 : 1; // m/s -> kt
		const speedKt = Math.round(speedRaw * factor);
		const gustKt = gustRaw !== null ? Math.round(gustRaw * factor) : null;
		const calm = dir === '000' && speedKt === 0;
		wind = {
			directionDeg: dir === 'VRB' ? null : Number(dir),
			speedKt,
			gustKt,
			variable: dir === 'VRB',
			calm,
		};
		i += 1;
		// Optional variable wind directions e.g. 310V040 -- discard
		if (tokens[i]?.match(/^\d{3}V\d{3}$/)) i += 1;
	}

	// Visibility: NSM, M1/4SM, 1 1/2SM, 10SM, or CAVOK
	let visibilitySM: number | null = null;
	let cavok = false;
	if (tokens[i] === 'CAVOK') {
		cavok = true;
		visibilitySM = 10;
		i += 1;
	} else if (tokens[i]?.match(/^M?\d+(?:\/\d+)?SM$/)) {
		visibilitySM = parseVisibility(tokens[i]);
		i += 1;
	} else if (tokens[i]?.match(/^\d+$/) && tokens[i + 1]?.match(/^\d+\/\d+SM$/)) {
		// "1 1/2SM" form
		visibilitySM = parseVisibility(`${tokens[i]} ${tokens[i + 1]}`);
		i += 2;
	}

	// Weather + clouds + temp/dew + altimeter -- iterate through remaining tokens
	const weather: string[] = [];
	const clouds: CloudLayer[] = [];
	let tempC: number | null = null;
	let dewpointC: number | null = null;
	let altimeterInHg: number | null = null;

	const wxRegex = /^([+-]|VC|RE)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/;

	for (; i < tokens.length; i += 1) {
		const t = tokens[i];
		if (!t) continue;

		// Cloud layers (must come before weather since SCT etc. are unique tokens)
		const cm = t.match(/^(SKC|CLR|NSC|FEW|SCT|BKN|OVC)(\d{3})?(?:CB|TCU)?$/);
		if (cm) {
			const cover = cm[1] as SkyCover;
			const heightFtAgl = cm[2] ? Number(cm[2]) * 100 : null;
			clouds.push({ cover, heightFtAgl });
			continue;
		}
		// Vertical visibility -> obscured
		const vvm = t.match(/^VV(\d{3})$/);
		if (vvm) {
			clouds.push({ cover: 'VV', heightFtAgl: Number(vvm[1]) * 100 });
			continue;
		}

		// Temp / dewpoint  TT/DD with optional M (minus) prefix on each
		const td = t.match(/^(M?\d{2})\/(M?\d{2})?$/);
		if (td) {
			tempC = parseTempPart(td[1]);
			dewpointC = td[2] ? parseTempPart(td[2]) : null;
			continue;
		}

		// Altimeter setting -- A2992 (US) or Q1013 (hPa)
		if (t.match(/^A\d{4}$/)) {
			const digits = Number(t.slice(1));
			altimeterInHg = digits / 100;
			continue;
		}
		if (t.match(/^Q\d{4}$/)) {
			const hpa = Number(t.slice(1));
			altimeterInHg = hpa * 0.02953; // hPa -> inHg
			continue;
		}

		// Present weather (after we've checked clouds first)
		if (wxRegex.test(t)) {
			weather.push(t);
			continue;
		}
		// Unknown token: skip silently. Could log, but spike doesn't need.
	}

	return {
		station,
		day,
		hour,
		minute,
		wind,
		visibilitySM,
		weather,
		clouds,
		tempC,
		dewpointC,
		altimeterInHg,
		cavok,
		raw: trimmed,
	};
}

function parseVisibility(s: string): number {
	// Forms:  "10SM", "M1/4SM", "1/2SM", "1 1/2SM"
	const stripped = s.replace(/SM$/, '');
	if (stripped.startsWith('M')) {
		// "M1/4" -> "less than 1/4" -- treat as the upper bound's value to be safe; we use 0.125
		const inner = stripped.slice(1);
		const v = fractionToNumber(inner);
		// "less than X" -- pick something smaller than X for IFR/LIFR judging
		return v / 2;
	}
	return fractionToNumber(stripped);
}

function fractionToNumber(s: string): number {
	// "10", "1/2", "1 1/2"
	if (s.includes(' ')) {
		const [whole, frac] = s.split(' ');
		return Number(whole) + fractionToNumber(frac);
	}
	if (s.includes('/')) {
		const [n, d] = s.split('/');
		return Number(n) / Number(d);
	}
	return Number(s);
}

function parseTempPart(s: string): number {
	if (s.startsWith('M')) return -Number(s.slice(1));
	return Number(s);
}

/**
 * Highest-reported layer wins for the cloud-cover circle. SKC/CLR/NSC =
 * empty, FEW = 1/4, SCT = 1/2, BKN = 3/4, OVC = full, VV = X (obscured).
 *
 * If multiple layers reported, FAA station model uses the most-extensive
 * (highest cover fraction) layer at the highest level reported as a
 * single-circle summary. The classic NWS plot draws each layer separately
 * using a stack, but for the spike we use the maximum.
 */
export function summarizeCover(clouds: CloudLayer[]): SkyCover {
	if (clouds.length === 0) return 'SKC';
	const order: Record<SkyCover, number> = { SKC: 0, CLR: 0, NSC: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, VV: 5 };
	let max: SkyCover = 'SKC';
	for (const c of clouds) {
		if (order[c.cover] > order[max]) max = c.cover;
	}
	return max;
}

/**
 * Return ceiling (lowest BKN/OVC/VV layer height in ft AGL) or null
 * if no broken/overcast/obscured layer reported.
 */
export function ceilingFtAgl(clouds: CloudLayer[]): number | null {
	let lowest: number | null = null;
	for (const c of clouds) {
		if (c.cover !== 'BKN' && c.cover !== 'OVC' && c.cover !== 'VV') continue;
		if (c.heightFtAgl === null) continue;
		if (lowest === null || c.heightFtAgl < lowest) lowest = c.heightFtAgl;
	}
	return lowest;
}

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

/**
 * Classic FAA flight category from ceiling + visibility:
 *  LIFR: ceil <500 OR vis <1
 *  IFR:  ceil 500-1000 OR vis 1-3
 *  MVFR: ceil 1000-3000 OR vis 3-5
 *  VFR:  ceil >3000 AND vis >5
 */
export function flightCategory(ceil: number | null, visSM: number | null): FlightCategory {
	const c = ceil ?? Infinity;
	const v = visSM ?? Infinity;
	if (c < 500 || v < 1) return 'LIFR';
	if (c < 1000 || v < 3) return 'IFR';
	if (c <= 3000 || v <= 5) return 'MVFR';
	return 'VFR';
}

export function celsiusToFahrenheit(c: number): number {
	return Math.round(c * 9 / 5 + 32);
}
