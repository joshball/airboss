/**
 * Layer-2 product types.
 *
 * Each `DerivedX` carries the raw emitted string plus the round-trip parsed
 * `ParsedX` shape from `@ab/wx-charts`. The round-trip parse is the load-
 * bearing correctness check: every derivation re-parses its emit with zero
 * warnings, which guarantees the engine never ships a product the wx-charts
 * library cannot read cleanly.
 *
 * AIRMETs are the exception. The AWC AIRMET product is delivered as the
 * graphical advisory shape used downstream by the wx-charts overlay
 * renderer; there is no parser round-trip in v1. The `AirmetAdvisory`
 * shape is the contract between this engine and `wx-charts/charts/airmet-sigmet.ts`.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/types.ts`
 * (carried inside `metar.ts` / `taf.ts` / `airmet.ts` / `winds-aloft.ts` /
 * `pirep.ts` in the spike); the production lib pulls each typed result into
 * one shared module.
 */

import type { AirmetFamily } from '@ab/constants';
import type { ParsedFbGrid, ParsedMetar, ParsedPirep, ParsedTaf } from '@ab/wx-charts';

export interface DerivedMetar {
	raw: string;
	parsed: ParsedMetar;
	/** Station longitude (deg) for downstream chart positioning. */
	stationLon: number;
	/** Station latitude (deg) for downstream chart positioning. */
	stationLat: number;
}

export interface DerivedTaf {
	raw: string;
	parsed: ParsedTaf;
	issuedAt: string;
	validFrom: string;
	validTo: string;
}

/**
 * AIRMET advisory. Engine-internal shape consumed directly by the wx-charts
 * AIRMET overlay renderer; no parser round-trip in v1. Field names mirror
 * the recorded `data/wx-scenarios/<slug>/products/airmets.json` so the
 * spike-parity test compares directly against the recorded JSON.
 */
export interface AirmetAdvisory {
	id: string;
	kind: AirmetFamily;
	label: string;
	labelLonLat?: [number, number];
	/** One or more closed rings, lon/lat. First point repeated as last. */
	rings: [number, number][][];
	validFrom: string;
	validTo: string;
	fromHazardZoneId: string;
}

export interface DerivedFbGrid {
	raw: string;
	parsed: ParsedFbGrid;
}

export interface DerivedPirep {
	raw: string;
	parsed: ParsedPirep;
	/** Approximate report longitude (deg) for downstream chart positioning. */
	lon: number;
	/** Approximate report latitude (deg) for downstream chart positioning. */
	lat: number;
}
