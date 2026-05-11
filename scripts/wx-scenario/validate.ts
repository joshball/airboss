/**
 * `bun run wx-scenario validate <slug>`
 *
 * Loads the scenario truth, generates the bundle in-memory (no disk
 * writes), runs the three load-bearing checks, and reports per-category
 * PASS / FAIL.
 *
 *   1. Round-trip parse: every METAR / TAF / FB / PIREP re-parses with zero
 *      warnings via the wx-charts parsers. The per-product derivation
 *      already throws on warning, so reaching this point implies pass.
 *      The validate runner re-runs the harness explicitly so the report
 *      lists per-product counts.
 *   2. Cross-product consistency: winds-vs-isobars, TAF FM vs front
 *      arrival, AIRMET ring vs hazard polygon, AIRMET ring closure, PIREP
 *      vs hazard centroid. The rules live in
 *      `libs/wx-engine/src/validate/consistency.ts`.
 *   3. Knowledge-node resolution: every callout's `knowledgeNodeIds`
 *      points to a real directory under `course/knowledge/weather/`.
 *
 * Exits 0 on PASS, non-zero on any failure. NO disk writes.
 */

import { generateScenario, runConsistency, runRoundTrip, validateAllKnowledgeNodes } from '@ab/wx-engine/server';
import { formatHumanDurationMs, REPO_ROOT, resolveScenarioSlug } from './lib';

export async function runValidate(args: readonly string[]): Promise<void> {
	if (args.length === 0) {
		console.error('wx-scenario validate: missing slug. Usage: bun run wx-scenario validate <slug>');
		process.exit(2);
	}
	const slug = resolveScenarioSlug(args[0]);
	const start = performance.now();
	const result = await validateOne(slug);
	const elapsed = formatHumanDurationMs(performance.now() - start);

	console.log(`# ${slug}  (${elapsed})`);
	console.log(`  round-trip:    ${formatRoundTripSummary(result.roundTrip)}`);
	console.log(`  consistency:   ${formatConsistencySummary(result.consistency)}`);
	console.log(`  knowledge:     ${formatKnowledgeSummary(result.knowledge)}`);
	if (result.failed) {
		for (const line of result.errorLines) console.log(`    - ${line}`);
		console.log('FAIL');
		process.exit(1);
	}
	console.log('PASS');
}

interface ValidateRunResult {
	failed: boolean;
	errorLines: string[];
	roundTrip: ReturnType<typeof runRoundTrip>;
	consistency: ReturnType<typeof runConsistency>;
	knowledge: KnowledgeSummary;
}

interface KnowledgeSummary {
	/** Total `knowledgeNodeIds[*]` references across every callout (not distinct). */
	totalRefs: number;
	/** Distinct unresolved ids. */
	unresolved: string[];
	/** Callout ids carrying at least one unresolved knowledge-node id. */
	calloutIds: string[];
}

export async function validateOne(slug: ReturnType<typeof resolveScenarioSlug>): Promise<ValidateRunResult> {
	const errorLines: string[] = [];

	const bundle = generateScenario({ kind: slug });

	const roundTrip = runRoundTrip(bundle);
	for (const r of roundTrip.results) {
		for (const f of r.failures) {
			errorLines.push(`round-trip ${r.kind} ${f.label}: ${f.warnings.join('; ')}`);
		}
	}

	const consistency = runConsistency(bundle);
	for (const issue of consistency.issues) {
		const labelBits = [issue.rule];
		if (issue.station !== undefined) labelBits.push(`station=${issue.station}`);
		if (issue.hazardZoneId !== undefined) labelBits.push(`hazard=${issue.hazardZoneId}`);
		if (issue.calloutId !== undefined) labelBits.push(`callout=${issue.calloutId}`);
		errorLines.push(`consistency ${labelBits.join(' ')}: ${issue.detail}`);
	}

	const knowledgeReport = validateAllKnowledgeNodes(bundle.commentary, { repoRoot: REPO_ROOT });
	const totalRefs = bundle.commentary.reduce((acc, c) => acc + c.knowledgeNodeIds.length, 0);
	const knowledge: KnowledgeSummary = {
		totalRefs,
		unresolved: knowledgeReport.unresolved,
		calloutIds: knowledgeReport.calloutIds,
	};
	for (const id of knowledge.unresolved) {
		errorLines.push(
			`knowledge-node id "${id}" does not resolve under course/knowledge/weather/ (in callouts: ${knowledge.calloutIds.join(', ')})`,
		);
	}

	const failed = roundTrip.totalFailures > 0 || consistency.issues.length > 0 || knowledge.unresolved.length > 0;
	return { failed, errorLines, roundTrip, consistency, knowledge };
}

function formatRoundTripSummary(r: ReturnType<typeof runRoundTrip>): string {
	const total = r.results.reduce((acc, x) => acc + x.count, 0);
	const fail = r.totalFailures;
	return fail === 0 ? `PASS (${total} products parsed clean)` : `FAIL (${fail} of ${total} products with warnings)`;
}

function formatConsistencySummary(r: ReturnType<typeof runConsistency>): string {
	const totalChecked =
		r.counts.windsVsIsobars.checked +
		r.counts.tafFmVsFront.checked +
		r.counts.airmetRingVsHazard.checked +
		r.counts.airmetRingClosure.checked +
		r.counts.pirepVsHazard.checked;
	const failed = r.issues.length;
	return failed === 0
		? `PASS (${totalChecked} cross-product checks green)`
		: `FAIL (${failed} of ${totalChecked} checks failed)`;
}

function formatKnowledgeSummary(r: KnowledgeSummary): string {
	const failed = r.unresolved.length;
	return failed === 0
		? `PASS (${r.totalRefs} knowledge-node refs resolved)`
		: `FAIL (${failed} unresolved id(s) across ${r.calloutIds.length} callout(s))`;
}
