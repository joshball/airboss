/**
 * Personal-minimums "implications" computation (personal-minimums-as-typed-
 * contract WP, Phase D).
 *
 * Turns the abstract numeric floors into concrete consequences: for every
 * registered wx-engine scenario, it reads the parsed METAR set, builds a
 * `PersonalMinimumsObservation` per station, runs the personal-minimums
 * lens, and keeps the stations whose conditions fall below the pilot's
 * stated floor.
 *
 * Server-only (the `.server.ts` suffix is the browser-globals guard's
 * opt-out): it reads `data/wx-scenarios/<slug>/products/metars.json` from
 * disk via `node:fs`. The `+page.server.ts` loader calls it; nothing
 * client-side imports it.
 *
 * v1 is intentionally bounded (per design.md "Why the implications
 * subpanel exists at v1"): it only reads wx-engine scenarios. The
 * night-currency check is a deliberate placeholder until logbook ingestion
 * ships -- see `nightCurrencyPlaceholder` below.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectAgainstPersonalMinimums } from '@ab/bc-study';
import type { PersonalMinimums } from '@ab/bc-study/server';
import { WX_SCENARIO_LABELS, WX_SCENARIO_VALUES, type WxScenario, wxScenarioBundleDir } from '@ab/constants';
import type { ConformanceResult, PersonalMinimumsObservation } from '@ab/types';
import { createLogger } from '@ab/utils';

const log = createLogger('study:personal-minimums');

// This file: apps/study/src/routes/(app)/personal-minimums/_lib/implications.ts
// Repo root is SEVEN levels up (_lib -> personal-minimums -> (app) ->
// routes -> src -> study -> apps -> <repo root>).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..', '..');

/** A station whose conditions fall below the pilot's stated floor. */
export interface ScenarioViolation {
	scenario: WxScenario;
	scenarioLabel: string;
	station: string;
	result: ConformanceResult;
}

export interface ImplicationsResult {
	/** Below-floor station x scenario pairs, grouped-ready (flat list). */
	violations: ScenarioViolation[];
	/** True when at least one registered scenario's METAR set was readable. */
	scenariosChecked: number;
	/**
	 * The night-currency check is not yet possible -- the platform has no
	 * record of the pilot's recent night landings until logbook ingestion
	 * ships. The subpanel renders this string as an informational block;
	 * it is NOT a violation claim. The field exists so the future logbook
	 * consumer has an obvious seam to replace.
	 */
	nightCurrencyPlaceholder: string;
}

/** Minimal shape of a parsed METAR cloud layer. */
interface MetarCloudLayer {
	cover: string;
	heightFtAgl: number | null;
}

/** Minimal shape of a parsed METAR (the fields the lens observation needs). */
interface ParsedMetar {
	station: string;
	visibilitySM: number | null;
	wind: { speedKt: number | null; gustKt: number | null } | null;
	clouds: MetarCloudLayer[];
}

/** Lowest BKN/OVC layer in feet AGL -- the ceiling. Large number when none. */
function ceilingFromClouds(clouds: MetarCloudLayer[]): number {
	const ceilings = clouds
		.filter((c) => (c.cover === 'BKN' || c.cover === 'OVC') && typeof c.heightFtAgl === 'number')
		.map((c) => c.heightFtAgl as number);
	return ceilings.length === 0 ? 99999 : Math.min(...ceilings);
}

/** Build a lens observation from a parsed METAR. */
function observationFromMetar(metar: ParsedMetar): PersonalMinimumsObservation {
	// Wind: use the gust peak when present (the conservative reading), else
	// the steady speed. Crosswind is 0 -- a METAR carries no runway, so the
	// subpanel does not make a crosswind claim here (the lens still reports
	// the field; the consumer ignores a 0-crosswind "violation").
	const speed = metar.wind?.speedKt ?? 0;
	const gust = metar.wind?.gustKt ?? null;
	return {
		ceilingFtAgl: ceilingFromClouds(metar.clouds),
		visibilitySm: metar.visibilitySM ?? 99,
		windTotalKt: gust !== null ? gust : speed,
		crosswindKt: 0,
		isNight: false,
	};
}

/** Read + parse a scenario's METAR set; null when the file is absent. */
async function readScenarioMetars(scenario: WxScenario): Promise<ParsedMetar[] | null> {
	const path = resolve(wxScenarioBundleDir(REPO_ROOT, scenario), 'products', 'metars.json');
	try {
		const raw = await readFile(path, 'utf-8');
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? (parsed as ParsedMetar[]) : null;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
		log.warn('personal-minimums implications: failed to read scenario metars', {
			metadata: { scenario, error: String(err) },
		});
		return null;
	}
}

/**
 * Compute the implications of a pilot's active personal minimums against
 * every registered wx-engine scenario. Returns the below-floor stations
 * plus the night-currency placeholder.
 */
export async function computeImplications(minimums: PersonalMinimums): Promise<ImplicationsResult> {
	const violations: ScenarioViolation[] = [];
	let scenariosChecked = 0;

	for (const scenario of WX_SCENARIO_VALUES) {
		const metars = await readScenarioMetars(scenario);
		if (metars === null) continue;
		scenariosChecked += 1;
		for (const metar of metars) {
			const observation = observationFromMetar(metar);
			const result = projectAgainstPersonalMinimums(minimums, observation);
			if (result.pass === 'below') {
				violations.push({
					scenario,
					scenarioLabel: WX_SCENARIO_LABELS[scenario],
					station: metar.station,
					result,
				});
			}
		}
	}

	return {
		violations,
		scenariosChecked,
		nightCurrencyPlaceholder:
			'Night currency could not be verified. Once logbook ingestion ships, this will check your most recent night landings against your stated floor.',
	};
}
