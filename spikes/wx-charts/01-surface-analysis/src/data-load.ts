/**
 * Loader for the synoptic data sample. Reads a JSON file written by
 * `data-acquire.ts` (one-shot script that pulls + traces from the WPC
 * archive once). The repo carries the JSON so renders are reproducible
 * without a network round-trip.
 *
 * Schema:
 *   - title: string (display, e.g. "2024-12-23 12Z (Mon)")
 *   - validTimeIso: ISO timestamp
 *   - centers: { kind: 'H'|'L', lon, lat, pressureMb }
 *   - fronts: { kind: 'cold'|'warm'|'occluded'|'stationary', points: [lon,lat][] }
 *   - isobars: optional precomputed contour data; otherwise computed from centers
 *   - stations: optional sparse station obs for overlay
 */

import { readFileSync, existsSync } from 'node:fs';

export type FrontKind = 'cold' | 'warm' | 'occluded' | 'stationary';

export interface PressureCenter {
	kind: 'H' | 'L';
	lon: number;
	lat: number;
	pressureMb: number;
}

export interface Front {
	kind: FrontKind;
	// Polyline traced lon/lat points in direction of motion (for cold/warm).
	// For stationary/occluded, motion is conventional.
	points: [number, number][];
}

export interface StationOb {
	id: string;
	lon: number;
	lat: number;
	tempF: number;
	dewF: number;
	pressureMb: number; // sea-level
	windDir: number; // deg from
	windKt: number;
	skyCover: 'CLR' | 'FEW' | 'SCT' | 'BKN' | 'OVC';
}

export interface SurfaceAnalysisData {
	title: string;
	validTimeIso: string;
	centers: PressureCenter[];
	fronts: Front[];
	stations?: StationOb[];
}

export function loadSurfaceAnalysis(path: string): SurfaceAnalysisData {
	if (!existsSync(path)) {
		throw new Error(`Surface analysis data not found at ${path}. Run data-acquire.ts first.`);
	}
	const raw = JSON.parse(readFileSync(path, 'utf8')) as SurfaceAnalysisData;
	return raw;
}
