/**
 * Layer-2 AIRMET derivation.
 *
 * Pure function: `truth.hazardZones -> AirmetAdvisory[]`. Maps each hazard
 * zone's `kind` to an AIRMET family via the `AIRMET_FAMILIES` constants:
 *
 *   `ifr`                  -> Sierra (`airmet-sierra`)
 *   `mountain-obscuration` -> Sierra
 *   `turbulence`           -> Tango (`airmet-tango`)
 *   `icing`                -> Zulu (`airmet-zulu`)
 *
 * The hazard polygon doubles as the AIRMET ring (closed -- first point
 * repeated as last). The advisory carries the originating hazard-zone id
 * so the consistency checker can confirm one-to-one mapping. There is no
 * AWC product parser in v1; the engine emits the advisory shape that
 * the wx-charts library's overlay renderer consumes directly.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/airmet.ts`
 * (PR #801 -- now retired).
 */

import { AIRMET_FAMILIES, type AirmetFamily } from '@ab/constants';
import type { HazardKind, HazardZone, TruthModel } from '../truth/types';
import type { AirmetAdvisory } from './types';

/** AIRMET validity window in hours from the truth's analysis time. */
const AIRMET_VALID_HOURS = 6;

/**
 * Derive every AIRMET implied by the truth's hazard zones. Hazard kinds that
 * do not map to an AIRMET family are skipped silently (none in v1 -- every
 * `HazardKind` has a defined family). The output array order matches the
 * order of `truth.hazardZones`.
 */
export function deriveAirmets(truth: TruthModel): AirmetAdvisory[] {
	const advisories: AirmetAdvisory[] = [];
	const validFrom = truth.validAt;
	const validTo = new Date(new Date(truth.validAt).getTime() + AIRMET_VALID_HOURS * 3_600_000).toISOString();

	for (const hz of truth.hazardZones) {
		const kind = mapKindToAirmet(hz.kind);
		if (kind === null) continue;

		// Close the ring (first vertex repeated as last) so the chart renderer
		// can iterate without special-casing the closing segment.
		const ring = [...hz.polygon];
		const first = ring[0];
		const last = ring[ring.length - 1];
		if (first !== undefined && last !== undefined && (first[0] !== last[0] || first[1] !== last[1])) {
			ring.push(first);
		}

		const labelLonLat = polygonCentroid(hz.polygon);

		advisories.push({
			id: `WAUS41-WXENGINE-${hz.id}`,
			kind,
			label: formatLabel(kind, hz),
			labelLonLat,
			rings: [ring],
			validFrom,
			validTo,
			fromHazardZoneId: hz.id,
		});
	}

	return advisories;
}

function mapKindToAirmet(hazardKind: HazardKind): AirmetFamily | null {
	switch (hazardKind) {
		case 'ifr':
		case 'mountain-obscuration':
			return AIRMET_FAMILIES.SIERRA;
		case 'turbulence':
			return AIRMET_FAMILIES.TANGO;
		case 'icing':
			return AIRMET_FAMILIES.ZULU;
	}
}

function formatLabel(kind: AirmetFamily, hz: HazardZone): string {
	const banner =
		kind === AIRMET_FAMILIES.SIERRA
			? 'AIRMET SIERRA'
			: kind === AIRMET_FAMILIES.TANGO
				? 'AIRMET TANGO'
				: 'AIRMET ZULU';
	const subj =
		hz.kind === 'ifr'
			? 'IFR Conditions'
			: hz.kind === 'mountain-obscuration'
				? 'Mountain Obscuration'
				: hz.kind === 'turbulence'
					? `${capitalize(hz.severity)} Turbulence`
					: `${capitalize(hz.severity)} Icing`;
	const minK = altCode(hz.altitudeBandFtMsl.min);
	const maxK = hz.altitudeBandFtMsl.max === null ? 'AND ABOVE' : altCode(hz.altitudeBandFtMsl.max);
	return `${banner}\n${subj}\n${minK}-${maxK}`;
}

function altCode(ft: number): string {
	if (ft < 1500) return 'SFC';
	if (ft < 18000) return `${Math.round(ft / 100)}`;
	return `FL${Math.round(ft / 100)}`;
}

function capitalize(s: string): string {
	if (s.length === 0) return s;
	return `${s[0]?.toUpperCase() ?? ''}${s.slice(1)}`;
}

function polygonCentroid(poly: [number, number][]): [number, number] {
	let sumX = 0;
	let sumY = 0;
	for (const p of poly) {
		sumX += p[0];
		sumY += p[1];
	}
	const n = poly.length || 1;
	return [sumX / n, sumY / n];
}
