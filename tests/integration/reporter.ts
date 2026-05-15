/**
 * Custom Playwright reporter for the flightbag coverage sweep.
 *
 * Wires into the `flightbag-coverage` project to write
 * `tests/integration/.out/coverage-report.md` summarising:
 *
 *  - Per-tier totals (sanity / structural / content) and pass/fail counts.
 *  - Every failure URL with tier, status hint, and the assertion error message.
 *  - The skipped log (covered-by-parent / no-route) emitted by the spec at
 *    module-load time, grouped by reason.
 *
 * Skipped data is loaded from `tests/integration/.out/skipped.json`, which the
 * spec writes once before tests start. We could instead carry the skip log
 * through the test runner via annotations, but writing once to disk is
 * simpler and survives 32-worker parallelism without coordinating writes.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface FailureRecord {
	readonly tier: string;
	readonly title: string;
	readonly errorMessage: string;
}

interface SkipPayload {
	readonly generatedAt: string;
	readonly counts: {
		readonly sanity: number;
		readonly structural: number;
		readonly content: number;
		readonly skipped: number;
	};
	readonly skipped: ReadonlyArray<{
		readonly kind: string;
		readonly documentSlug: string;
		readonly code: string;
		readonly reason: string;
		readonly classification: 'covered-by-parent' | 'no-route';
	}>;
}

const TIER_PATTERN = /^\[(sanity|structural|content)\]/;

export default class CoverageReporter implements Reporter {
	private readonly perTier: Record<string, { passed: number; failed: number }> = {
		sanity: { passed: 0, failed: 0 },
		structural: { passed: 0, failed: 0 },
		content: { passed: 0, failed: 0 },
		other: { passed: 0, failed: 0 },
	};
	private readonly failures: FailureRecord[] = [];
	private outDir = resolvePath('tests/integration/.out');

	onBegin(_config: FullConfig): void {
		mkdirSync(this.outDir, { recursive: true });
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		// `flightbag-coverage` is the only project this reporter cares about.
		// Skip anything else (e.g. when a future change runs the reporter on
		// the wider config).
		const projectName = test.parent.project()?.name ?? '';
		if (projectName !== 'flightbag-coverage') return;

		const tier = TIER_PATTERN.exec(test.title)?.[1] ?? 'other';
		if (result.status === 'passed') {
			(this.perTier[tier] ?? this.perTier.other).passed += 1;
			return;
		}
		if (result.status === 'failed' || result.status === 'timedOut') {
			(this.perTier[tier] ?? this.perTier.other).failed += 1;
			this.failures.push({
				tier,
				title: test.title,
				errorMessage: result.error?.message ?? result.errors[0]?.message ?? '(no error message)',
			});
		}
	}

	onEnd(result: FullResult): void {
		const skip = readSkipPayload(this.outDir);
		const report = renderReport(this.perTier, this.failures, skip, result.status);
		writeFileSync(resolvePath(this.outDir, 'coverage-report.md'), report);
		// Also emit a machine-readable summary so a follow-up agent can read
		// it without parsing markdown.
		writeFileSync(
			resolvePath(this.outDir, 'coverage-summary.json'),
			JSON.stringify(
				{
					status: result.status,
					perTier: this.perTier,
					failures: this.failures,
					skippedCount: skip?.skipped.length ?? 0,
				},
				null,
				2,
			),
		);
	}
}

function readSkipPayload(outDir: string): SkipPayload | null {
	try {
		const raw = readFileSync(resolvePath(outDir, 'skipped.json'), 'utf8');
		return JSON.parse(raw) as SkipPayload;
	} catch {
		return null;
	}
}

function renderReport(
	perTier: Record<string, { passed: number; failed: number }>,
	failures: readonly FailureRecord[],
	skip: SkipPayload | null,
	overallStatus: FullResult['status'],
): string {
	const today = new Date().toISOString().slice(0, 10);
	const lines: string[] = [];
	lines.push(`# Flightbag coverage run -- ${today}`);
	lines.push('');
	lines.push(`Run status: \`${overallStatus}\``);
	lines.push('');
	lines.push('## Tier totals');
	lines.push('');
	const renderTier = (label: string, key: 'sanity' | 'structural' | 'content'): string => {
		const bucket = perTier[key];
		if (!bucket) return `${label}: (no results)`;
		const total = bucket.passed + bucket.failed;
		return `${label}: ${bucket.passed} / ${total} passed${bucket.failed > 0 ? ` (${bucket.failed} failed)` : ''}`;
	};
	lines.push('```text');
	lines.push(renderTier('sanity    ', 'sanity'));
	lines.push(renderTier('structural', 'structural'));
	lines.push(renderTier('content   ', 'content'));
	lines.push('```');
	lines.push('');

	lines.push(`## Failures (${failures.length})`);
	lines.push('');
	if (failures.length === 0) {
		lines.push('_None._');
	} else {
		for (const failure of failures) {
			lines.push(`- **${failure.tier}** \`${failure.title}\``);
			lines.push(`  - ${failure.errorMessage.split('\n')[0]}`);
		}
	}
	lines.push('');

	lines.push('## Skipped rows (covered-by-parent / no-route)');
	lines.push('');
	if (!skip) {
		lines.push('_No skip log emitted by the spec (skipped.json missing)._');
	} else if (skip.skipped.length === 0) {
		lines.push('_No rows skipped._');
	} else {
		const byClass = new Map<string, Map<string, number>>();
		for (const entry of skip.skipped) {
			const inner = byClass.get(entry.classification) ?? new Map<string, number>();
			inner.set(entry.reason, (inner.get(entry.reason) ?? 0) + 1);
			byClass.set(entry.classification, inner);
		}
		for (const [classification, reasons] of byClass.entries()) {
			lines.push(`### ${classification}`);
			lines.push('');
			const sorted = [...reasons.entries()].sort((a, b) => b[1] - a[1]);
			for (const [reason, count] of sorted) {
				lines.push(`- ${count} -- ${reason}`);
			}
			lines.push('');
		}
	}

	return `${lines.join('\n')}\n`;
}
