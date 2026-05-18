// @browser-globals: server-only -- never imported by client .svelte
/**
 * Scenario validation entrypoint.
 *
 * `validateScenario(slug)` resolves a scenario, composes its bundle, and
 * runs schema + cross-layer consistency checks WITHOUT writing to disk.
 * This is the load-bearing guarantee the `bun run check` step enforces:
 * the viewer cannot ship a scenario whose composition is internally
 * inconsistent.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "`bun run xc-scenario
 * validate --all`".
 */

import type { XcScenario } from '@ab/constants';
import { composeScenario } from '../scenario/compose';
import { type ConsistencyReport, runConsistency } from './consistency';

/** The result of validating one scenario. */
export interface ScenarioValidationResult {
	/** The scenario slug. */
	slug: XcScenario;
	/** Whether the scenario passed every check. */
	ok: boolean;
	/** The consistency report (issues + warnings). */
	report: ConsistencyReport;
	/** A fatal error (schema failure, unresolved reference, missing file). */
	error?: string;
}

/**
 * Validate one scenario: compose the bundle (schema-validates every
 * literal as a side effect) then run the cross-layer consistency rules.
 * Catches and reports any thrown error rather than crashing the caller.
 */
export function validateScenario(slug: XcScenario): ScenarioValidationResult {
	try {
		const bundle = composeScenario(slug);
		const report = runConsistency(bundle);
		return { slug, ok: report.ok, report };
	} catch (err) {
		return {
			slug,
			ok: false,
			report: { ok: false, issues: [] },
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
