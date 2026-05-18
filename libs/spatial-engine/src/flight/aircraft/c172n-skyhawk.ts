/**
 * v1 aircraft literal: Cessna 172N Skyhawk.
 *
 * POH-derived performance, hand-transcribed for v1. POH ingest from PDF is
 * a follow-on WP -- the C172N POH is stable (the type has not been
 * published since 1979), so transcription is acceptable and auditable.
 *
 * Source: Cessna 172N Pilot Operating Handbook (1978 reprint).
 * Field-by-field POH citations: `course/aircraft/c172n-skyhawk/CITATION.md`.
 *
 * See `docs/work-packages/xc-viewer-v1/design.md` "Aircraft spec authoring
 * discipline" and `tasks.md` E.1.
 */

import { XC_AIRCRAFT } from '@ab/constants';
import type { AircraftSpec } from '../types';

/** The Cessna 172N Skyhawk. */
export const C172N_SKYHAWK: AircraftSpec = {
	id: XC_AIRCRAFT.C172N_SKYHAWK,
	model: 'Cessna 172N Skyhawk',
	perfPolar: {
		// POH Section 4 (Normal Procedures) -- best-rate climb 75 KIAS.
		climb: { rateFpm: 700, kiasIas: 75 },
		// POH Section 5 (Performance) -- cruise table, 75% power, ISA day.
		// TAS rises with altitude as the same power setting moves into
		// thinner air; gph falls slightly.
		cruise: {
			points: [
				{ pressureAltitudeFtMsl: 2000, tasKt: 109, gph: 8.4 },
				{ pressureAltitudeFtMsl: 4000, tasKt: 112, gph: 8.2 },
				{ pressureAltitudeFtMsl: 6000, tasKt: 114, gph: 8.0 },
				{ pressureAltitudeFtMsl: 8000, tasKt: 116, gph: 7.8 },
			],
		},
		// POH Section 4 -- normal descent 110 KIAS, ~500 fpm.
		descent: { rateFpm: 500, kiasIas: 110 },
		// POH Section 1 -- certificated service ceiling.
		serviceCeilingFtMsl: 14200,
	},
	fuelBurnCurve: {
		// POH Section 5 -- 75% cruise burns ~8 gph.
		cruise: { defaultGph: 8.0 },
		// POH Section 5 -- climb fuel allowance.
		climb: { gph: 10.0 },
		// POH Section 5 -- taxi / runup allowance.
		taxi: { gph: 1.4 },
	},
	// POH Section 1 -- standard tanks, usable fuel. Long-range tanks (50 gal)
	// are a follow-on; v1 ships the standard 40 gal usable.
	fuelCapacityGal: 40,
	wbEnvelope: {
		// POH Section 6 (Weight & Balance) -- normal-category CG envelope.
		maxGrossWeightLb: 2300,
		minWeightLb: 1500,
		envelope: [
			{ weightLb: 1500, fwdCgIn: 33.0, aftCgIn: 47.3 },
			{ weightLb: 1950, fwdCgIn: 35.5, aftCgIn: 47.3 },
			{ weightLb: 2300, fwdCgIn: 38.5, aftCgIn: 47.3 },
		],
	},
	equipment: {
		// Typical 1978-era VFR panel.
		nav: ['vor', 'gps-vfr-only'],
		com: ['comm-1', 'comm-2'],
		transponder: 'mode-c',
		adsbOut: false,
		autopilot: false,
		ifrCertified: false,
	},
};
