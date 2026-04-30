#!/usr/bin/env bun

/**
 * Engine targeting source counter (engine-goal-cutover phase 7).
 *
 * Reads structured production logs (one JSON object per line, see
 * `emitEngineTargetingTelemetry` in
 * `libs/bc/study/src/engine-targeting.ts`) from stdin or a file and
 * tallies the `source` field across `previewSession` calls.
 *
 * Drives the trigger condition for dropping `study_plan.cert_goals`:
 * after 14 consecutive days where the `plan` and `empty` source counts
 * are zero on every day, the column is safe to drop. The script reports
 * `READY TO DROP` when the input window passes the test, otherwise
 * surfaces the count by source for diagnostic purposes.
 *
 * Usage:
 *   cat production.log | bun scripts/db/check-engine-targeting-source.ts
 *   bun scripts/db/check-engine-targeting-source.ts < production.log
 *   bun scripts/db/check-engine-targeting-source.ts --window=14d --file=production.log
 *
 * Flags:
 *   --window=Nd     Consecutive-day window required to report READY TO DROP
 *                   (default: 14). Days are computed in UTC.
 *   --file=PATH     Read the log from a file instead of stdin.
 *   --json          Emit machine-readable totals + per-day counts.
 */

import { ENGINE_TARGETING_SOURCES, type EngineTargetingSource } from '@ab/constants';

interface LogEntry {
	level?: string;
	message?: string;
	timestamp?: string;
	app?: string;
	metadata?: {
		event?: string;
		source?: string;
	};
}

interface SourceCounts {
	[ENGINE_TARGETING_SOURCES.GOAL]: number;
	[ENGINE_TARGETING_SOURCES.PLAN]: number;
	[ENGINE_TARGETING_SOURCES.EMPTY]: number;
}

const KNOWN_SOURCES: ReadonlySet<string> = new Set<EngineTargetingSource>([
	ENGINE_TARGETING_SOURCES.GOAL,
	ENGINE_TARGETING_SOURCES.PLAN,
	ENGINE_TARGETING_SOURCES.EMPTY,
]);

function emptyCounts(): SourceCounts {
	return {
		[ENGINE_TARGETING_SOURCES.GOAL]: 0,
		[ENGINE_TARGETING_SOURCES.PLAN]: 0,
		[ENGINE_TARGETING_SOURCES.EMPTY]: 0,
	};
}

function parseFlag(name: string): string | null {
	for (const arg of process.argv.slice(2)) {
		if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
		if (arg === `--${name}`) return '';
	}
	return null;
}

function dayKey(timestamp: string | undefined): string | null {
	if (!timestamp) return null;
	const d = new Date(timestamp);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString().slice(0, 10);
}

async function readSource(): Promise<string> {
	const filePath = parseFlag('file');
	if (filePath !== null && filePath !== '') {
		const file = Bun.file(filePath);
		return await file.text();
	}
	return await new Response(Bun.stdin.stream()).text();
}

async function main(): Promise<void> {
	const wantsJson = process.argv.includes('--json');
	const windowFlag = parseFlag('window') ?? '14d';
	const windowDaysMatch = /^(\d+)d$/.exec(windowFlag);
	const windowDays = windowDaysMatch ? Number.parseInt(windowDaysMatch[1], 10) : 14;

	const text = await readSource();
	const lines = text.split('\n').filter((l) => l.trim().length > 0);

	const totals = emptyCounts();
	const byDay = new Map<string, SourceCounts>();
	let parsedLines = 0;

	for (const raw of lines) {
		let entry: LogEntry;
		try {
			entry = JSON.parse(raw);
		} catch {
			continue;
		}
		if (entry.metadata?.event !== 'engine-targeting') continue;
		const source = entry.metadata.source;
		if (!source || !KNOWN_SOURCES.has(source)) continue;
		const sourceTyped = source as EngineTargetingSource;
		totals[sourceTyped] += 1;
		parsedLines += 1;

		const day = dayKey(entry.timestamp);
		if (day !== null) {
			const dayCounts = byDay.get(day) ?? emptyCounts();
			dayCounts[sourceTyped] += 1;
			byDay.set(day, dayCounts);
		}
	}

	const sortedDays = [...byDay.keys()].sort();
	const lastDays = sortedDays.slice(-windowDays);
	const windowClean =
		lastDays.length >= windowDays &&
		lastDays.every((day) => {
			const c = byDay.get(day);
			return c !== undefined && c[ENGINE_TARGETING_SOURCES.PLAN] === 0;
		});

	if (wantsJson) {
		process.stdout.write(
			`${JSON.stringify(
				{
					parsedLines,
					totals,
					byDay: Object.fromEntries(sortedDays.map((d) => [d, byDay.get(d)])),
					windowDays,
					windowClean,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}

	console.log(`engine-targeting events parsed: ${parsedLines}`);
	console.log(`source totals: goal=${totals.goal} plan=${totals.plan} empty=${totals.empty}`);
	console.log(`days observed: ${sortedDays.length}`);
	if (sortedDays.length > 0) {
		const window = lastDays.length > 0 ? `${lastDays[0]} -> ${lastDays[lastDays.length - 1]}` : '(no days)';
		console.log(`last ${windowDays} days: ${window}`);
	}

	if (windowClean) {
		console.log(`\nREADY TO DROP cert_goals: ${windowDays} consecutive days with zero source='plan' reads.`);
	} else if (sortedDays.length === 0) {
		console.log(`\nNOT READY: no engine-targeting events found in input.`);
	} else {
		const remaining = windowDays - lastDays.length;
		const planInWindow = lastDays.reduce((sum, day) => sum + (byDay.get(day)?.plan ?? 0), 0);
		console.log(
			`\nNOT READY: ${planInWindow} legacy plan-source reads in last ${lastDays.length} day(s); need ${windowDays} consecutive clean days${remaining > 0 ? ` (${remaining} more needed)` : ''}.`,
		);
	}
}

await main();
