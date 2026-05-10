/**
 * Spike 01 -- Layer 2 PIREP derivation.
 *
 * Generate 3 PIREPs aligned with the truth state: one in the pre-frontal
 * warm sector (light chop reported by an aircraft heading north), one
 * along the frontal band (moderate turbulence + rain), one in the deep
 * post-frontal cold sector (chop, ceiling report). Each PIREP uses
 * station + radial+distance positioning so it falls inside the relevant
 * truth-state zone.
 *
 * Round-trips via parsePirep with zero warnings.
 */

import { parsePirep, type ParsedPirep } from '@ab/wx-charts';
import type { TruthModel } from '../truth/types';

export interface DerivedPirep {
	parsed: ParsedPirep;
	raw: string;
	lat: number;
	lon: number;
}

/**
 * Spike 01 emits a hand-curated set of PIREPs that match the scenario's
 * truth state. A production engine would walk hazard-zone centroids +
 * convective cells and synthesize aircraft callsigns per kind.
 */
export function derivePireps(truth: TruthModel): DerivedPirep[] {
	// Times in HHMM format (UTC). Anchor to truth.validAt.
	const dt = new Date(truth.validAt);
	const baseHour = dt.getUTCHours();
	const tm = (offsetMin: number) => {
		const t = new Date(dt.getTime() + offsetMin * 60_000);
		return `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`;
	};

	const items: DerivedPirep[] = [];

	// 1. Pre-frontal warm-sector PIREP near KORD: light chop above 6000.
	{
		const raw = `KORD UA /OV ORD180020/TM ${tm(-25)}/FL080/TP B738/TB LGT/SK BKN045 OVC120/RM SMOOTH BELOW 070`;
		const parsed = parsePirep(raw);
		const ord = truth.stations.KORD;
		if (ord !== undefined) {
			items.push({ parsed, raw, lat: ord.lat - 0.3, lon: ord.lon });
		}
	}

	// 2. Frontal-band PIREP near KSPI: moderate turbulence + rain in the band.
	{
		const raw = `KSPI UUA /OV SPI270010/TM ${tm(-12)}/FL060/TP C172/TB MOD 050-080/SK OVC020/WX RA/RM CONT MOD CHOP IN PRECIP`;
		const parsed = parsePirep(raw);
		const spi = truth.stations.KSPI;
		if (spi !== undefined) {
			items.push({ parsed, raw, lat: spi.lat, lon: spi.lon - 0.2 });
		}
	}

	// 3. Deep post-frontal cold-sector PIREP near KMLI: chop + low ceiling.
	{
		const raw = `KMLI UA /OV MLI020015/TM ${tm(-5)}/FL050/TP B190/TB LGT 050-080/SK OVC025/WX FU/RM SMOOTH ABV 080 CONT NW WIND 30KT`;
		const parsed = parsePirep(raw);
		const mli = truth.stations.KMLI;
		if (mli !== undefined) {
			items.push({ parsed, raw, lat: mli.lat + 0.3, lon: mli.lon });
		}
	}

	void baseHour; // currently unused; kept for future absolute-time anchoring
	return items;
}
