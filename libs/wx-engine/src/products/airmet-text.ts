/**
 * Layer-2 AIRMET text-bulletin emitter.
 *
 * Pure function: `AirmetAdvisory[] -> DerivedAirmetBulletin[]`. Where
 * `deriveAirmets` (`./airmet.ts`) produces the graphical advisory shape the
 * wx-charts overlay renderer consumes, this module produces the *encoded
 * text* form of the same advisories -- the fixed-format FAA AIRMET bulletin
 * a pilot reads in a briefing or hears on FSS.
 *
 * Without this emitter the AIRMET / SIGMET products are structurally
 * unmatchable by the catalog coverage matcher (`tools/catalog-build/
 * match-scenarios.ts`): the matcher links a scenario to a catalog example
 * by `raw`-string equality, and the scenario bundle previously stored only
 * the parsed `AirmetAdvisory` JSON, never a `raw` string. This module
 * supplies that `raw`, so the writer can land `products/airmets.txt` and
 * the matcher can walk it.
 *
 * # Bulletin grammar (per FAA AC 00-45H, "In-flight Aviation Weather
 *   Advisories"; example bulletins in
 *   `course/weather/references/products/airmet/page.md`)
 *
 * One bulletin per AIRMET family present in the advisory set. Each bulletin:
 *
 *   <REGION><FAMILY-LETTER> WA <DDHHMM>
 *   AIRMET <FAMILY> UPDT <N> FOR <HAZARD-LIST> VALID UNTIL <DDHHMM>
 *   <blank>
 *   AIRMET <HAZARD>...
 *   FROM <vertex> TO <vertex> TO ... TO <vertex>
 *   <CONDITIONS LINE>
 *   <CONDS CONTG LINE>
 *   ...one block per hazard in the family...
 *
 * The polygon is emitted in FAA `Nxxxx Wxxxxx` lat/long vertex notation
 * (used verbatim by the volcanic-ash SIGMET example in the reference
 * corpus). Real CONUS AIRMETs describe the polygon via VOR radials; that
 * notation needs a navaid registry the truth model does not carry, so the
 * deterministic lat/long form is used instead -- it is a valid FAA polygon
 * encoding and is recoverable directly from the truth's hazard-zone
 * polygons.
 *
 * # Scope
 *
 * AIRMET only (SIERRA / TANGO / ZULU). SIGMET emission is a separate effort
 * -- the truth model has no severe-category hazard kind, no SIGMET
 * designator-letter state, and no volcanic-ash / dust-storm hazard, so a
 * SIGMET emitter is not a thin extension of this one. Tracked as a
 * follow-up on the hangar-content-census WP.
 */

import { AIRMET_FAMILIES, type AirmetFamily } from '@ab/constants';
import type { AirmetAdvisory, DerivedAirmetBulletin } from './types';

/** Outlook window beyond the valid time, in hours, for the `CONDS CONTG` line. */
const OUTLOOK_BEYOND_HOURS = 6;

/** Canonical AIRMET-family emission order. */
const FAMILY_ORDER: readonly AirmetFamily[] = [AIRMET_FAMILIES.SIERRA, AIRMET_FAMILIES.TANGO, AIRMET_FAMILIES.ZULU];

/**
 * Emit one AIRMET text bulletin per family represented in `advisories`.
 *
 * Pure: depends only on the advisory set and (for the issuance / valid
 * timestamps) the advisories' own `validFrom` / `validTo`. The output array
 * is ordered SIERRA, TANGO, ZULU -- the canonical AIRMET-family order -- so
 * the bundle writer's `airmets.txt` is deterministic regardless of hazard
 * iteration order.
 */
export function deriveAirmetBulletins(advisories: readonly AirmetAdvisory[]): DerivedAirmetBulletin[] {
	const byFamily = new Map<AirmetFamily, AirmetAdvisory[]>();
	for (const adv of advisories) {
		const list = byFamily.get(adv.kind);
		if (list === undefined) byFamily.set(adv.kind, [adv]);
		else list.push(adv);
	}

	const bulletins: DerivedAirmetBulletin[] = [];
	for (const family of FAMILY_ORDER) {
		const familyAdvisories = byFamily.get(family);
		if (familyAdvisories === undefined || familyAdvisories.length === 0) continue;
		bulletins.push(buildBulletin(family, familyAdvisories));
	}
	return bulletins;
}

function buildBulletin(family: AirmetFamily, advisories: readonly AirmetAdvisory[]): DerivedAirmetBulletin {
	// Issuance + valid times are taken from the advisory set. Every advisory
	// in a family shares the same window (deriveAirmets uses one `validAt`).
	const first = advisories[0];
	if (first === undefined) throw new Error('buildBulletin: empty advisory list');
	const issuedAt = first.validFrom;
	const validUntil = first.validTo;

	const issueDdHhMm = formatDdHhMm(new Date(issuedAt));
	const validUntilDdHhMm = formatDdHhMm(new Date(validUntil));

	// Hazard subjects -- the reference line lists each unique hazard tag once,
	// in advisory order.
	const referenceHazards = uniqueInOrder(advisories.map((a) => hazardOf(a).referenceTag));

	const regionCode = `${familyRegionPrefix()}${familyLetter(family)}`;
	const lines: string[] = [];

	// Type + region line, then the reference line.
	lines.push(`${regionCode} WA ${issueDdHhMm}`);
	lines.push(
		`AIRMET ${familyName(family)} UPDT 1 FOR ${referenceHazards.join(' AND ')} VALID UNTIL ${validUntilDdHhMm}`,
	);

	// One block per hazard.
	for (const adv of advisories) {
		const hazard = hazardOf(adv);
		lines.push('');
		lines.push(`AIRMET ${hazard.blockTag}...`);
		lines.push(`FROM ${formatRing(adv.rings)}`);
		lines.push(hazard.conditionsLine);
		lines.push(
			`CONDS CONTG BYD ${shiftHoursDdHhZ(validUntil, 0)} THRU ${shiftHoursDdHhZ(validUntil, OUTLOOK_BEYOND_HOURS)}.`,
		);
	}

	const raw = lines.join('\n');
	return {
		raw,
		family,
		issuedAt,
		validFrom: issuedAt,
		validTo: validUntil,
		fromHazardZoneIds: advisories.map((a) => a.fromHazardZoneId),
	};
}

// ----------------------------------------------------------------------
// Hazard subject mapping
// ----------------------------------------------------------------------

interface HazardSubject {
	/** Tag in the reference line `FOR <...>` -- e.g. `IFR`, `TURB`, `ICE`. */
	referenceTag: string;
	/** Tag in the per-block header `AIRMET <...>...` -- e.g. `IFR`, `TURB`. */
	blockTag: string;
	/** The conditions line for the hazard block. */
	conditionsLine: string;
}

/**
 * Map an advisory to its hazard subject. The advisory's `label` carries the
 * originating hazard kind + severity + altitude band (authored by
 * `deriveAirmets`'s `formatLabel`); this re-reads that label so the text
 * emitter stays a pure function of the `AirmetAdvisory` shape.
 */
function hazardOf(adv: AirmetAdvisory): HazardSubject {
	const subject = labelSubjectLine(adv.label);
	const band = labelBandLine(adv.label);

	if (adv.kind === AIRMET_FAMILIES.SIERRA) {
		if (/MOUNTAIN OBSCURATION/i.test(subject)) {
			return {
				referenceTag: 'MTN OBSCN',
				blockTag: 'MTN OBSCN',
				conditionsLine: 'MTNS OBSC BY CLDS/PCPN/BR.',
			};
		}
		return {
			referenceTag: 'IFR',
			blockTag: 'IFR',
			conditionsLine: 'CIG BLW 010 AND/OR VIS BLW 3SM PCPN/BR.',
		};
	}

	if (adv.kind === AIRMET_FAMILIES.TANGO) {
		return {
			referenceTag: 'TURB',
			blockTag: 'TURB',
			conditionsLine: `OCNL MOD TURB BTN ${band}.`,
		};
	}

	// ZULU -- icing.
	return {
		referenceTag: 'ICE',
		blockTag: 'ICE',
		conditionsLine: `MOD ICE BTN ${band}.`,
	};
}

/**
 * Second line of an advisory `label` is the hazard subject
 * (`formatLabel` emits `<banner>\n<subject>\n<band>`).
 */
function labelSubjectLine(label: string): string {
	const parts = label.split('\n');
	return (parts[1] ?? '').trim().toUpperCase();
}

/**
 * Third line of an advisory `label` is the altitude band code
 * (`<minK>-<maxK>`). Reformatted to the FAA `<lo> AND <hi>` /
 * `<lo> AND ABOVE` band grammar used in the conditions line.
 */
function labelBandLine(label: string): string {
	const parts = label.split('\n');
	const band = (parts[2] ?? '').trim();
	if (band.endsWith('AND ABOVE')) {
		const lo = band
			.replace(/-?AND ABOVE$/, '')
			.replace(/-$/, '')
			.trim();
		return `${normalizeAltCode(lo)} AND ABOVE`;
	}
	const dash = band.indexOf('-');
	if (dash === -1) return normalizeAltCode(band);
	const lo = band.slice(0, dash).trim();
	const hi = band.slice(dash + 1).trim();
	return `${normalizeAltCode(lo)} AND ${normalizeAltCode(hi)}`;
}

/**
 * Normalize an altitude code to FAA convention: `SFC` and `FLxxx` codes
 * pass through unchanged; a bare hundreds-of-feet code is zero-padded to
 * three digits (`60` -> `060`), matching the AIRMET catalog examples
 * (`MOD ICE BTN FRZLVL AND FL180`, `OCNL MOD TURB BTN 060 AND FL240`).
 */
function normalizeAltCode(code: string): string {
	if (code === 'SFC' || code === '') return code;
	if (code.startsWith('FL')) return code;
	if (/^\d+$/.test(code)) return code.padStart(3, '0');
	return code;
}

// ----------------------------------------------------------------------
// Polygon + time formatting
// ----------------------------------------------------------------------

/**
 * Format a closed ring as the FAA `FROM ... TO ...` vertex chain. The
 * closing vertex (a repeat of the first, added by `deriveAirmets`) is kept
 * so the chain reads as a closed loop, matching the reference bulletins.
 */
function formatRing(rings: readonly (readonly (readonly [number, number])[])[]): string {
	const ring = rings[0];
	if (ring === undefined || ring.length === 0) return '';
	return ring.map((pt) => formatVertex(pt)).join(' TO ');
}

/**
 * Format a `[lon, lat]` vertex as FAA `Nxxxx Wxxxxx` notation: two-digit
 * degrees + two-digit minutes for latitude, three-digit degrees + two-digit
 * minutes for longitude. Negative longitude -> `W`; the truth model's
 * scenarios are all in the western hemisphere.
 */
function formatVertex(pt: readonly [number, number]): string {
	const [lon, lat] = pt;
	const latHemi = lat >= 0 ? 'N' : 'S';
	const lonHemi = lon >= 0 ? 'E' : 'W';
	const latStr = formatDegMin(Math.abs(lat), 2);
	const lonStr = formatDegMin(Math.abs(lon), 3);
	return `${latHemi}${latStr} ${lonHemi}${lonStr}`;
}

/** Format a decimal degree as `DDMM` (or `DDDMM`), degrees + rounded minutes. */
function formatDegMin(deg: number, degDigits: number): string {
	let whole = Math.floor(deg);
	let minutes = Math.round((deg - whole) * 60);
	if (minutes === 60) {
		minutes = 0;
		whole += 1;
	}
	return `${String(whole).padStart(degDigits, '0')}${String(minutes).padStart(2, '0')}`;
}

function formatDdHhMm(d: Date): string {
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${dd}${hh}${mm}`;
}

/**
 * The `CONDS CONTG` outlook uses `DDHHZ` (day + hour, Zulu) -- not the
 * minute-precision `DDHHMM` of the header. `shiftHours` advances the base
 * timestamp by whole hours before formatting.
 */
function shiftHoursDdHhZ(iso: string, hours: number): string {
	const d = new Date(new Date(iso).getTime() + hours * 3_600_000);
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	return `${dd}${hh}Z`;
}

// ----------------------------------------------------------------------
// Region / family code helpers
// ----------------------------------------------------------------------

/**
 * Three-letter region prefix in the type line (`<REGION><LETTER> WA ...`).
 * The truth model carries no AWC desk-region metadata, so the CONUS-central
 * desk code `KCI` is used uniformly -- it matches the central-US scenarios
 * the engine ships (the frontal XC, the Texas thunderstorm set). A future
 * truth-model `awcRegion` field would let this vary per scenario.
 */
function familyRegionPrefix(): string {
	return 'KCI';
}

/** Single-letter family tag appended to the region in the type line. */
function familyLetter(family: AirmetFamily): string {
	switch (family) {
		case AIRMET_FAMILIES.SIERRA:
			return 'S';
		case AIRMET_FAMILIES.TANGO:
			return 'T';
		case AIRMET_FAMILIES.ZULU:
			return 'Z';
	}
}

/** Phonetic family name for the reference line. */
function familyName(family: AirmetFamily): string {
	switch (family) {
		case AIRMET_FAMILIES.SIERRA:
			return 'SIERRA';
		case AIRMET_FAMILIES.TANGO:
			return 'TANGO';
		case AIRMET_FAMILIES.ZULU:
			return 'ZULU';
	}
}

function uniqueInOrder(items: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of items) {
		if (seen.has(item)) continue;
		seen.add(item);
		out.push(item);
	}
	return out;
}
