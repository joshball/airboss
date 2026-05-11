/**
 * `bun run wx-scenario check-round-trip --all`
 *
 * Walks every registered scenario, runs the validate suite (round-trip +
 * consistency + knowledge-node resolution), exits non-zero on any failure.
 *
 * Designed to be invoked from `bun run check` -- the always-full-scope
 * gate that guarantees the engine cannot ship a product the wx-charts
 * library cannot parse cleanly, the engine cannot ship a scenario whose
 * cross-product invariants are broken, and commentary cannot drift away
 * from the knowledge corpus without surfacing here.
 *
 * NO disk writes. Pure validation pass.
 */

import { WX_SCENARIO_VALUES, type WxScenario } from '@ab/constants';
import { formatHumanDurationMs } from './lib';
import { validateOne } from './validate';

interface ScenarioCheckOutcome {
	slug: WxScenario;
	passed: boolean;
	roundTripCount: number;
	roundTripFailures: number;
	consistencyIssues: number;
	knowledgeUnresolved: number;
	errorLines: string[];
	durationMs: number;
}

export async function runCheckRoundTrip(args: readonly string[]): Promise<void> {
	const all = args.includes('--all');
	if (!all) {
		console.error('wx-scenario check-round-trip: this subcommand always walks every scenario. Pass --all explicitly.');
		process.exit(2);
	}

	const start = performance.now();
	const outcomes: ScenarioCheckOutcome[] = [];
	let failures = 0;
	for (const slug of WX_SCENARIO_VALUES) {
		const scenarioStart = performance.now();
		try {
			const result = await validateOne(slug);
			const roundTripCount = result.roundTrip.results.reduce((acc, x) => acc + x.count, 0);
			outcomes.push({
				slug,
				passed: !result.failed,
				roundTripCount,
				roundTripFailures: result.roundTrip.totalFailures,
				consistencyIssues: result.consistency.issues.length,
				knowledgeUnresolved: result.knowledge.unresolved.length,
				errorLines: result.errorLines,
				durationMs: performance.now() - scenarioStart,
			});
			if (result.failed) failures += 1;
		} catch (err) {
			failures += 1;
			outcomes.push({
				slug,
				passed: false,
				roundTripCount: 0,
				roundTripFailures: 0,
				consistencyIssues: 0,
				knowledgeUnresolved: 0,
				errorLines: [`scenario load failed: ${err instanceof Error ? err.message : String(err)}`],
				durationMs: performance.now() - scenarioStart,
			});
		}
	}

	for (const o of outcomes) {
		const tag = o.passed ? 'PASS' : 'FAIL';
		const ms = formatHumanDurationMs(o.durationMs);
		console.log(
			`[${tag}] ${o.slug}  (${ms})  ${o.roundTripCount} products / ` +
				`${o.consistencyIssues} consistency issues / ${o.knowledgeUnresolved} unresolved knowledge ids`,
		);
		for (const line of o.errorLines) {
			console.log(`    - scenario=${o.slug} ${line}`);
		}
	}

	const totalElapsed = formatHumanDurationMs(performance.now() - start);
	const passed = outcomes.length - failures;
	console.log('');
	console.log(`wx-scenario round-trip: ${passed} of ${outcomes.length} scenarios passed (${totalElapsed} total)`);

	if (failures > 0) process.exit(1);
}
