/**
 * Round-trip validation -- the load-bearing correctness check for the engine.
 *
 * Every emitted METAR / TAF / FB grid / PIREP is parsed back through the
 * `@ab/wx-charts` parsers; the engine cannot ship a product the wx-charts
 * library cannot read cleanly. The per-product derivations (`deriveMetar`,
 * `deriveTaf`, `deriveFbGrid`, `derivePireps`) already throw on warning when
 * they re-parse internally, so a successful `generateScenario` is itself a
 * full round-trip pass.
 *
 * This module exposes a friendlier API for the Phase F CLI:
 *
 *   - `summarizeRoundTrip(bundle)` -- per-product counts (no parsing done;
 *     reads the `parsed.warnings` field that the derivation populated)
 *   - `runRoundTrip(bundle)` -- re-runs the parsers explicitly so the CLI
 *     can report per-product warnings with full station context, even if the
 *     internal-throw guarantee is ever relaxed in the future
 *
 * AIRMETs do not round-trip: AWC AIRMET is delivered as the graphical advisory
 * shape the wx-charts overlay renderer consumes directly. The CLI surfaces
 * AIRMET counts but does not parse them.
 */

import { parseFbGrid, parseMetar, parsePirep, parseTaf } from '@ab/wx-charts';
import type { ScenarioBundle } from '../engine';

/** Per-product round-trip outcome. */
export interface ProductRoundTripResult {
	/** Product kind. AIRMETs report `count` only; the rest carry parser context. */
	kind: 'metar' | 'taf' | 'fb' | 'pirep' | 'airmet';
	/** Total products emitted by the engine for this kind. */
	count: number;
	/** Per-product failures discovered during the explicit round-trip. */
	failures: ProductRoundTripFailure[];
}

export interface ProductRoundTripFailure {
	/** Stable per-product label for the failure: ICAO, FB bulletin, PIREP id. */
	label: string;
	warnings: string[];
	raw: string;
}

export interface RoundTripReport {
	scenarioId: string;
	results: ProductRoundTripResult[];
	/** Total warning count across every product. Zero means the bundle is clean. */
	totalFailures: number;
}

/**
 * Re-parse every product in the bundle and collect failures. The engine's
 * per-product derivations already throw on warning at emit time, so a
 * `generateScenario` that returned a bundle is internally clean -- but the
 * CLI re-runs the harness explicitly so the report has per-station context.
 */
export function runRoundTrip(bundle: ScenarioBundle): RoundTripReport {
	const results: ProductRoundTripResult[] = [];

	// METARs
	const metarFailures: ProductRoundTripFailure[] = [];
	for (const m of bundle.products.metars) {
		const reparsed = parseMetar(m.raw);
		if (reparsed.warnings.length > 0) {
			metarFailures.push({
				label: m.parsed.station,
				warnings: reparsed.warnings,
				raw: m.raw,
			});
		}
	}
	results.push({ kind: 'metar', count: bundle.products.metars.length, failures: metarFailures });

	// TAFs
	const tafFailures: ProductRoundTripFailure[] = [];
	for (const t of bundle.products.tafs) {
		const reparsed = parseTaf(t.raw);
		if (reparsed.warnings.length > 0) {
			tafFailures.push({
				label: t.parsed.station,
				warnings: reparsed.warnings,
				raw: t.raw,
			});
		}
	}
	results.push({ kind: 'taf', count: bundle.products.tafs.length, failures: tafFailures });

	// FB bulletin (single product per scenario)
	const fbFailures: ProductRoundTripFailure[] = [];
	if (bundle.products.fbGrid !== null) {
		const reparsed = parseFbGrid(bundle.products.fbGrid.raw);
		if (reparsed.warnings.length > 0) {
			fbFailures.push({
				label: 'fb-bulletin',
				warnings: reparsed.warnings,
				raw: bundle.products.fbGrid.raw,
			});
		}
	}
	results.push({ kind: 'fb', count: bundle.products.fbGrid === null ? 0 : 1, failures: fbFailures });

	// PIREPs
	const pirepFailures: ProductRoundTripFailure[] = [];
	for (const p of bundle.products.pireps) {
		const reparsed = parsePirep(p.raw);
		if (reparsed.warnings.length > 0) {
			pirepFailures.push({
				label: p.parsed.station,
				warnings: reparsed.warnings,
				raw: p.raw,
			});
		}
	}
	results.push({ kind: 'pirep', count: bundle.products.pireps.length, failures: pirepFailures });

	// AIRMETs: no parser; report count only.
	results.push({ kind: 'airmet', count: bundle.products.airmets.length, failures: [] });

	const totalFailures = results.reduce((acc, r) => acc + r.failures.length, 0);
	return { scenarioId: bundle.scenarioId, results, totalFailures };
}

/**
 * Cheap variant of `runRoundTrip` that reads the cached `parsed.warnings`
 * field rather than re-parsing. Useful inside tests that already constructed
 * the bundle.
 */
export function summarizeRoundTrip(bundle: ScenarioBundle): RoundTripReport {
	const results: ProductRoundTripResult[] = [];

	const metarFailures: ProductRoundTripFailure[] = bundle.products.metars
		.filter((m) => m.parsed.warnings.length > 0)
		.map((m) => ({
			label: m.parsed.station,
			warnings: m.parsed.warnings,
			raw: m.raw,
		}));
	results.push({ kind: 'metar', count: bundle.products.metars.length, failures: metarFailures });

	const tafFailures: ProductRoundTripFailure[] = bundle.products.tafs
		.filter((t) => t.parsed.warnings.length > 0)
		.map((t) => ({
			label: t.parsed.station,
			warnings: t.parsed.warnings,
			raw: t.raw,
		}));
	results.push({ kind: 'taf', count: bundle.products.tafs.length, failures: tafFailures });

	const fbFailures: ProductRoundTripFailure[] =
		bundle.products.fbGrid !== null && bundle.products.fbGrid.parsed.warnings.length > 0
			? [
					{
						label: 'fb-bulletin',
						warnings: bundle.products.fbGrid.parsed.warnings,
						raw: bundle.products.fbGrid.raw,
					},
				]
			: [];
	results.push({ kind: 'fb', count: bundle.products.fbGrid === null ? 0 : 1, failures: fbFailures });

	const pirepFailures: ProductRoundTripFailure[] = bundle.products.pireps
		.filter((p) => p.parsed.warnings.length > 0)
		.map((p) => ({
			label: p.parsed.station,
			warnings: p.parsed.warnings,
			raw: p.raw,
		}));
	results.push({ kind: 'pirep', count: bundle.products.pireps.length, failures: pirepFailures });

	results.push({ kind: 'airmet', count: bundle.products.airmets.length, failures: [] });

	const totalFailures = results.reduce((acc, r) => acc + r.failures.length, 0);
	return { scenarioId: bundle.scenarioId, results, totalFailures };
}
