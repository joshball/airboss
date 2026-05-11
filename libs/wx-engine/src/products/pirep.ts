/**
 * Layer-2 PIREP derivation.
 *
 * Pure function: `(TruthModel) -> DerivedPirep[]`. Generates a hand-curated
 * set of PIREPs aligned with the truth state's pre-frontal warm sector, the
 * frontal precipitation band, and the deep post-frontal cold sector. Each
 * PIREP uses station + radial/distance positioning so the report falls inside
 * the referenced truth-state zone.
 *
 * Every emitted PIREP round-trips through `parsePirep` from `@ab/wx-charts`
 * with zero warnings.
 *
 * V1 emits the spike's curated set. A future revision walks
 * `truth.hazardZones` and `truth.convection.cells` to author PIREPs
 * automatically; the hand-curated set is the regression baseline.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/pirep.ts`
 * (PR #801 -- now retired).
 */

import { parsePirep } from '@ab/wx-charts';
import type { TruthModel } from '../truth/types';
import type { DerivedPirep } from './types';

/** Time-offset minutes relative to truth.validAt for each curated PIREP. */
const PIREP_KORD_TIME_OFFSET_MIN = -25;
const PIREP_KSPI_TIME_OFFSET_MIN = -12;
const PIREP_KMLI_TIME_OFFSET_MIN = -5;

/** Lat/lon offsets (deg) anchoring each curated PIREP near its station. */
const PIREP_KORD_LAT_OFFSET = -0.3;
const PIREP_KSPI_LON_OFFSET = -0.2;
const PIREP_KMLI_LAT_OFFSET = 0.3;

/**
 * Derive the PIREP set for the truth model. Returns an empty array when the
 * referenced anchor stations (KORD, KSPI, KMLI) are not registered.
 */
export function derivePireps(truth: TruthModel): DerivedPirep[] {
	const dt = new Date(truth.validAt);
	const tm = (offsetMin: number): string => {
		const t = new Date(dt.getTime() + offsetMin * 60_000);
		return `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`;
	};

	const items: DerivedPirep[] = [];

	// 1. Pre-frontal warm-sector PIREP near KORD: light chop above 6000.
	const ord = truth.stations.KORD;
	if (ord !== undefined) {
		const raw = `KORD UA /OV ORD180020/TM ${tm(PIREP_KORD_TIME_OFFSET_MIN)}/FL080/TP B738/TB LGT/SK BKN045 OVC120/RM SMOOTH BELOW 070`;
		items.push(makePirep(raw, ord.lon, ord.lat + PIREP_KORD_LAT_OFFSET));
	}

	// 2. Frontal-band PIREP near KSPI: moderate turbulence + rain in the band.
	const spi = truth.stations.KSPI;
	if (spi !== undefined) {
		const raw = `KSPI UUA /OV SPI270010/TM ${tm(PIREP_KSPI_TIME_OFFSET_MIN)}/FL060/TP C172/TB MOD 050-080/SK OVC020/WX RA/RM CONT MOD CHOP IN PRECIP`;
		items.push(makePirep(raw, spi.lon + PIREP_KSPI_LON_OFFSET, spi.lat));
	}

	// 3. Deep post-frontal cold-sector PIREP near KMLI: chop + low ceiling.
	const mli = truth.stations.KMLI;
	if (mli !== undefined) {
		const raw = `KMLI UA /OV MLI020015/TM ${tm(PIREP_KMLI_TIME_OFFSET_MIN)}/FL050/TP B190/TB LGT 050-080/SK OVC025/WX FU/RM SMOOTH ABV 080 CONT NW WIND 30KT`;
		items.push(makePirep(raw, mli.lon, mli.lat + PIREP_KMLI_LAT_OFFSET));
	}

	return items;
}

function makePirep(raw: string, lon: number, lat: number): DerivedPirep {
	const parsed = parsePirep(raw);
	if (parsed.warnings.length > 0) {
		throw new Error(
			`derivePireps: emitted PIREP re-parses with warnings: ${parsed.warnings.join('; ')}\nraw: ${raw}`,
		);
	}
	return { raw, parsed, lon, lat };
}
