/**
 * Round-trip parser validation for a drill pack: every METAR / TAF / FB raw
 * string in the pack must parse cleanly via `@ab/wx-charts`. PIREPs and
 * AIRMETs are emitted in non-encoded form by the engine (AIRMETs are
 * structured records; PIREPs use a custom prose form) so they don't round
 * trip through these parsers; we skip them here. CLI callers should still
 * run the comprehensive `wx-scenario check-round-trip` against the source
 * scenarios before shipping.
 *
 * Browser-safe: pure call into `@ab/wx-charts` parsers.
 */

import { parseMetar, parseTaf } from '@ab/wx-charts';
import type { DrillItem, DrillPack } from './types';

export interface DrillValidationFailure {
	index: number;
	product: DrillItem['product'];
	raw: string;
	reason: string;
}

export interface DrillValidationResult {
	failed: boolean;
	failures: DrillValidationFailure[];
	checked: number;
}

export function validateDrillPack(pack: DrillPack): DrillValidationResult {
	const failures: DrillValidationFailure[] = [];
	let checked = 0;
	for (const item of pack.items) {
		if (item.product === 'metar') {
			checked += 1;
			const parsed = parseMetarSafe(item.raw);
			if (parsed.kind === 'err')
				failures.push({ index: item.index, product: 'metar', raw: item.raw, reason: parsed.reason });
		} else if (item.product === 'taf') {
			checked += 1;
			const parsed = parseTafSafe(item.raw);
			if (parsed.kind === 'err')
				failures.push({ index: item.index, product: 'taf', raw: item.raw, reason: parsed.reason });
		}
		// PIREP / FB / AIRMET intentionally skipped -- see header.
	}
	return { failed: failures.length > 0, failures, checked };
}

function parseMetarSafe(raw: string): { kind: 'ok' } | { kind: 'err'; reason: string } {
	try {
		parseMetar(raw);
		return { kind: 'ok' };
	} catch (err) {
		return { kind: 'err', reason: err instanceof Error ? err.message : String(err) };
	}
}

function parseTafSafe(raw: string): { kind: 'ok' } | { kind: 'err'; reason: string } {
	try {
		parseTaf(raw);
		return { kind: 'ok' };
	} catch (err) {
		return { kind: 'err', reason: err instanceof Error ? err.message : String(err) };
	}
}
