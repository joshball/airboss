/**
 * One-shot migration script for ADR 027 PR 3.
 *
 * Moves the flat-layout chart directories under `data/charts/wx/` into the
 * two-family nested layout:
 *
 *   Reference fixtures (20 dirs):
 *     data/charts/wx/wx-<chart-kind>-<date-zulu>/
 *       -> data/charts/wx/reference-fixtures/wx-<chart-kind>-<date-zulu>/
 *     (artifact filenames unchanged: spec.yaml / chart.svg / meta.json)
 *
 *   Scenario charts (102 dirs):
 *     data/charts/wx/wx-scenario-<scenario-id>-<chart-kind>/
 *       -> data/charts/wx/wx-scenarios/<scenario-id>/<chart-kind>/
 *     (artifact filenames disambiguated:
 *      spec.yaml / chart.svg / meta.json  ->
 *      <scenario-id>-<chart-kind>-spec.yaml /
 *      <scenario-id>-<chart-kind>-chart.svg /
 *      <scenario-id>-<chart-kind>-meta.json)
 *
 * Uses `git mv` so history follows the files. Idempotent (re-running on a
 * partially-migrated tree is a no-op for dirs already in the new layout).
 *
 * Bundle-side per-chart subdirs under `data/wx-scenarios/<id>/charts/` are
 * also renamed from the legacy `wx-scenario-<id>-<kind>/` form to the
 * chart-kind tail (`<kind>/`) so the engine's writer doesn't leave dead
 * twins on the next regeneration. The bundle subdirs are generated
 * artifacts; the next `bun run wx-scenario build --all` re-creates them.
 *
 * One-shot: delete this file after PR 3 ships.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WX_CHART_FAMILIES, WX_SCENARIO_VALUES } from '@ab/constants';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CHARTS_ROOT = resolve(REPO_ROOT, 'data', 'charts', 'wx');
const BUNDLES_ROOT = resolve(REPO_ROOT, 'data', 'wx-scenarios');

function gitMv(from: string, to: string): void {
	console.log(`  git mv ${from.slice(REPO_ROOT.length + 1)}  ->  ${to.slice(REPO_ROOT.length + 1)}`);
	execSync(`git mv ${JSON.stringify(from)} ${JSON.stringify(to)}`, { cwd: REPO_ROOT, stdio: 'inherit' });
}

/** Parse `wx-scenario-<scenario-id>-<chart-kind>` -> { scenarioId, chartKind }. */
function parseLegacyScenarioDir(name: string): { scenarioId: string; chartKind: string } | null {
	if (!name.startsWith('wx-scenario-')) return null;
	const body = name.slice('wx-scenario-'.length);
	// Match against the closed enum of scenario ids -- chart kinds can
	// contain hyphens (e.g. `taf-kstl`, `g-airmet-icing`) so a naive split
	// on the last hyphen is wrong.
	for (const scenarioId of WX_SCENARIO_VALUES) {
		const prefix = `${scenarioId}-`;
		if (body.startsWith(prefix)) {
			const chartKind = body.slice(prefix.length);
			if (chartKind.length === 0) return null;
			return { scenarioId, chartKind };
		}
	}
	return null;
}

interface MoveOp {
	from: string;
	to: string;
	rename?: { fromFilename: string; toFilename: string }[];
}

function planReferenceFixtureMoves(): MoveOp[] {
	const refTarget = resolve(CHARTS_ROOT, WX_CHART_FAMILIES.REFERENCE_FIXTURES);
	const ops: MoveOp[] = [];
	for (const name of readdirSync(CHARTS_ROOT)) {
		const dir = resolve(CHARTS_ROOT, name);
		if (!statSync(dir).isDirectory()) continue;
		// skip already-migrated family dirs
		if (
			name === WX_CHART_FAMILIES.REFERENCE_FIXTURES ||
			name === WX_CHART_FAMILIES.WX_SCENARIOS ||
			name === WX_CHART_FAMILIES.MOCKUPS
		) {
			continue;
		}
		// scenarios handled separately
		if (name.startsWith('wx-scenario-')) continue;
		// reference-fixture pattern: starts with `wx-` and not a scenario
		if (!name.startsWith('wx-')) {
			console.warn(`  warning: unexpected directory name '${name}' under data/charts/wx/, skipping`);
			continue;
		}
		ops.push({ from: dir, to: resolve(refTarget, name) });
	}
	return ops;
}

function planScenarioMoves(): MoveOp[] {
	const scenariosTarget = resolve(CHARTS_ROOT, WX_CHART_FAMILIES.WX_SCENARIOS);
	const ops: MoveOp[] = [];
	for (const name of readdirSync(CHARTS_ROOT)) {
		const dir = resolve(CHARTS_ROOT, name);
		if (!statSync(dir).isDirectory()) continue;
		if (!name.startsWith('wx-scenario-')) continue;
		const parsed = parseLegacyScenarioDir(name);
		if (parsed === null) {
			throw new Error(
				`move-wx-chart-dirs: could not parse legacy scenario dir '${name}' -- no matching scenario id found in WX_SCENARIO_VALUES`,
			);
		}
		const { scenarioId, chartKind } = parsed;
		const toDir = resolve(scenariosTarget, scenarioId, chartKind);
		const rename = (['spec.yaml', 'chart.svg', 'meta.json'] as const).map((artifact) => ({
			fromFilename: artifact,
			toFilename: `${scenarioId}-${chartKind}-${artifact}`,
		}));
		ops.push({ from: dir, to: toDir, rename });
	}
	return ops;
}

function planBundleChartSubdirMoves(): MoveOp[] {
	const ops: MoveOp[] = [];
	if (!existsSync(BUNDLES_ROOT)) return ops;
	for (const scenarioId of readdirSync(BUNDLES_ROOT)) {
		const chartsDir = resolve(BUNDLES_ROOT, scenarioId, 'charts');
		if (!existsSync(chartsDir) || !statSync(chartsDir).isDirectory()) continue;
		for (const name of readdirSync(chartsDir)) {
			const dir = resolve(chartsDir, name);
			if (!statSync(dir).isDirectory()) continue;
			if (!name.startsWith('wx-scenario-')) continue;
			const parsed = parseLegacyScenarioDir(name);
			if (parsed === null) continue;
			// the bundle dir is already nested under <scenarioId>; just
			// rename the per-chart dir from the legacy form to the chart-kind tail
			ops.push({ from: dir, to: resolve(chartsDir, parsed.chartKind) });
		}
	}
	return ops;
}

function runMoves(ops: MoveOp[]): void {
	for (const op of ops) {
		if (existsSync(op.to)) {
			console.log(`  skip: target already exists ${op.to.slice(REPO_ROOT.length + 1)}`);
			continue;
		}
		// ensure parent exists (git mv doesn't create intermediate dirs)
		const parent = dirname(op.to);
		if (!existsSync(parent)) {
			execSync(`mkdir -p ${JSON.stringify(parent)}`, { cwd: REPO_ROOT, stdio: 'inherit' });
		}
		gitMv(op.from, op.to);
		if (op.rename !== undefined) {
			for (const r of op.rename) {
				const fromFile = resolve(op.to, r.fromFilename);
				const toFile = resolve(op.to, r.toFilename);
				if (!existsSync(fromFile)) continue;
				gitMv(fromFile, toFile);
			}
		}
	}
}

function main(): void {
	if (!existsSync(CHARTS_ROOT)) {
		console.error(`charts root not found: ${CHARTS_ROOT}`);
		process.exit(1);
	}

	console.log('## Phase 1: reference fixtures');
	const refOps = planReferenceFixtureMoves();
	console.log(`  planned: ${refOps.length} reference-fixture moves`);
	runMoves(refOps);

	console.log('## Phase 2: wx-scenario charts');
	const scenarioOps = planScenarioMoves();
	console.log(`  planned: ${scenarioOps.length} wx-scenario moves`);
	runMoves(scenarioOps);

	console.log('## Phase 3: bundle-side chart subdir renames');
	const bundleOps = planBundleChartSubdirMoves();
	console.log(`  planned: ${bundleOps.length} bundle chart subdir renames`);
	runMoves(bundleOps);

	console.log('done');
}

main();
