/**
 * Spike 01 -- Layer 2 AIRMET derivation.
 *
 * Pure function: truth.hazardZones -> AirmetAdvisory[]. Maps hazard kind
 * to AIRMET family (Sierra/Tango/Zulu) and uses the hazard polygon as
 * the AIRMET ring. The advisory polygon agrees by construction with the
 * truth-state IFR/turbulence/icing zones used by the METAR overlay --
 * killer-feature consistency.
 */

import type { TruthModel } from '../truth/types';

export type AirmetKind = 'airmet-sierra' | 'airmet-tango' | 'airmet-zulu';

export interface AirmetAdvisory {
	id: string;
	kind: AirmetKind;
	label: string;
	labelLonLat?: [number, number];
	rings: [number, number][][];
	validFrom: string;
	validTo: string;
	fromHazardZoneId: string;
}

export function deriveAirmets(truth: TruthModel): AirmetAdvisory[] {
	const advisories: AirmetAdvisory[] = [];
	const validFrom = truth.validAt;
	const validTo = new Date(new Date(truth.validAt).getTime() + 6 * 3600_000).toISOString();

	for (const hz of truth.hazardZones) {
		const kind = mapKindToAirmet(hz.kind);
		if (kind === null) continue;
		// Close the ring (first vertex repeated as last).
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

function mapKindToAirmet(hazardKind: string): AirmetKind | null {
	switch (hazardKind) {
		case 'ifr':
		case 'mountain-obscuration':
			return 'airmet-sierra';
		case 'turbulence':
			return 'airmet-tango';
		case 'icing':
			return 'airmet-zulu';
		default:
			return null;
	}
}

function formatLabel(kind: AirmetKind, hz: { kind: string; severity: string; altitudeBandFtMsl: { min: number; max: number | null } }): string {
	const banner =
		kind === 'airmet-sierra' ? 'AIRMET SIERRA' : kind === 'airmet-tango' ? 'AIRMET TANGO' : 'AIRMET ZULU';
	const subj =
		hz.kind === 'ifr'
			? 'IFR Conditions'
			: hz.kind === 'mountain-obscuration'
				? 'Mountain Obscuration'
				: hz.kind === 'turbulence'
					? `${capitalize(hz.severity)} Turbulence`
					: hz.kind === 'icing'
						? `${capitalize(hz.severity)} Icing`
						: '';
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
	return s.length === 0 ? s : s[0]?.toUpperCase() + s.slice(1);
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
