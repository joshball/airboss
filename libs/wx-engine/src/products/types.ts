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

/**
 * A single AIRMET *text bulletin* -- the encoded-text companion to the
 * graphical `AirmetAdvisory`. One bulletin per AIRMET family (SIERRA /
 * TANGO / ZULU) present in a scenario; the `raw` field is the fixed-format
 * FAA AIRMET text per AC 00-45H, emitted by `deriveAirmetBulletins`
 * (`./airmet-text.ts`).
 *
 * Unlike METAR / TAF / PIREP / FB there is no parser round-trip -- the
 * wx-charts library has no AIRMET text parser in v1 -- so the bulletin
 * carries no `parsed` field. The `raw` string is what the catalog coverage
 * matcher (`tools/catalog-build/match-scenarios.ts`) compares by
 * whitespace-normalized equality to a catalog example.
 */
export interface DerivedAirmetBulletin {
	/** The fixed-format FAA AIRMET bulletin text. */
	raw: string;
	/** Which AIRMET family this bulletin covers. */
	family: AirmetFamily;
	/** Issuance time -- the start of the validity window (UTC ISO). */
	issuedAt: string;
	/** Start of the validity window (UTC ISO). Equals `issuedAt`. */
	validFrom: string;
	/** End of the validity window (UTC ISO). */
	validTo: string;
	/** Originating hazard-zone ids, one per hazard block in the bulletin. */
	fromHazardZoneIds: string[];
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
