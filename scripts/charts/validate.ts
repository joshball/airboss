/**
 * `bun run charts validate <slug>` and `bun run charts validate --all`.
 *
 * Spec-shape validation + source-resolvability check, no renderer call.
 * Used in CI-style "is the chart catalog clean?" scans and in pre-flight
 * checks before committing a new chart.
 */

import { existsSync } from 'node:fs';
import { WX_CHART_SLUG_REGEX, type ChartType, CHART_TYPE_VALUES } from '@ab/constants';
import { CHART_RENDERERS } from '@ab/wx-charts/server';
import { listChartSlugs, loadSpec, resolveSourceUri } from './lib';

interface ValidateResult {
	slug: string;
	ok: boolean;
	errors: string[];
}

export async function runValidate(args: readonly string[]): Promise<void> {
	if (args.length === 0) {
		console.error('charts validate: missing slug. Usage: bun run charts validate <slug> | --all');
		process.exit(2);
	}
	const all = args[0] === '--all';
	const slugs = all ? listChartSlugs() : [args[0]];
	if (slugs.length === 0) {
		console.log('charts validate: no charts found under data/charts/wx/.');
		return;
	}

	let failures = 0;
	for (const slug of slugs) {
		const r = validateOne(slug);
		printResult(r);
		if (!r.ok) failures += 1;
	}
	if (failures > 0) process.exit(1);
}

function validateOne(slug: string): ValidateResult {
	const errors: string[] = [];

	if (!WX_CHART_SLUG_REGEX.test(slug)) {
		errors.push(`slug '${slug}' does not match shape ${WX_CHART_SLUG_REGEX.source}`);
	}

	let spec;
	try {
		spec = loadSpec(slug);
	} catch (err) {
		errors.push(err instanceof Error ? err.message : String(err));
		return { slug, ok: false, errors };
	}

	if (spec.specObject.slug !== slug) {
		errors.push(`spec.slug '${spec.specObject.slug}' does not match directory name '${slug}'`);
	}

	const type = spec.specObject.type;
	if (!(CHART_TYPE_VALUES as readonly string[]).includes(type)) {
		errors.push(`unknown chart type '${type}'. Legal: ${CHART_TYPE_VALUES.join(', ')}.`);
	} else {
		const registration = CHART_RENDERERS[type as ChartType];
		try {
			registration.schema.parse(spec.specObject);
		} catch (err) {
			errors.push(`spec validation failed: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	for (const [key, uri] of Object.entries(spec.specObject.sources)) {
		const resolved = resolveSourceUri(uri);
		if (!existsSync(resolved)) {
			errors.push(`source '${key}' not found at ${resolved}`);
		}
	}

	return { slug, ok: errors.length === 0, errors };
}

function printResult(r: ValidateResult): void {
	const tag = r.ok ? 'ok' : 'FAIL';
	console.log(`[${tag}] ${r.slug}`);
	for (const e of r.errors) {
		console.log(`       ${e}`);
	}
}
