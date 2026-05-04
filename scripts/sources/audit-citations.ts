/**
 * `bun run sources audit-citations` -- stage-5 cross-link audit.
 *
 * Reads every row in `study.content_citations` and reports:
 *   - dead targets (citation points at a row that no longer exists)
 *   - dead sources (citation's owning card / scenario / node was hard-deleted)
 *   - resolver coverage gaps (corpus-backed citations whose corpus has no
 *     resolver registered, so the citation chip cannot deep-link)
 *   - invalid external_ref URLs
 *
 * Output is human-readable by default, line-per-finding so it greps cleanly.
 * `--json` emits the full `AuditReport` shape for the scheduled job + future
 * dashboard surfaces.
 *
 * Read-only. Never mutates the database.
 */

import { AUDIT_FINDING_KINDS, type AuditFinding, type AuditReport, auditCitations } from '@ab/bc-study/build';

interface CliFlags {
	json: boolean;
	help: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
	let json = false;
	let help = false;
	for (const arg of argv) {
		if (arg === '--json') json = true;
		else if (arg === '--help' || arg === '-h') help = true;
	}
	return { json, help };
}

const HELP = `audit-citations -- stage-5 cross-link audit

Usage:
  bun run sources audit-citations              # human-readable report
  bun run sources audit-citations --json       # JSON report (scheduled-job format)
  bun run sources audit-citations --help

Exit code: 0 when no findings, 1 otherwise.`;

/**
 * Dispatcher entry point. Returns an exit code; the wrapper in
 * `scripts/sources.ts` is responsible for `process.exit`.
 */
export async function runAuditCitations(argv: readonly string[]): Promise<number> {
	const flags = parseFlags(argv);
	if (flags.help) {
		console.log(HELP);
		return 0;
	}

	const report = await auditCitations();

	if (flags.json) {
		console.log(JSON.stringify(report, null, 2));
		return report.findings.length === 0 ? 0 : 1;
	}

	renderReport(report);
	return report.findings.length === 0 ? 0 : 1;
}

function renderReport(report: AuditReport): void {
	console.log(`stage-5 cross-link audit -- ${report.generatedAt}`);
	console.log(`scanned: ${report.totalCitations} citations`);
	console.log('');

	if (report.totalCitations === 0) {
		console.log('no citations -- nothing to audit.');
		return;
	}

	if (report.findings.length === 0) {
		console.log('clean -- every citation resolves and every target is live.');
	} else {
		console.log(`findings: ${report.findings.length}`);
		const byKind = groupByKind(report.findings);
		for (const kind of Object.values(AUDIT_FINDING_KINDS)) {
			const rows = byKind.get(kind);
			if (rows === undefined || rows.length === 0) continue;
			console.log('');
			console.log(`  ${kind}: ${rows.length}`);
			for (const f of rows) {
				console.log(`    ${f.citationId}  ${f.detail}`);
			}
		}
	}

	console.log('');
	console.log('per-target-type:');
	for (const t of report.targetTypeTallies) {
		console.log(`  ${t.targetType.padEnd(18)} ${t.total}`);
	}

	console.log('');
	console.log('per-corpus coverage:');
	console.log('  corpus              total   missing-resolver   dead-targets');
	for (const c of report.corpusCoverage) {
		console.log(
			`  ${c.corpus.padEnd(18)} ${String(c.total).padStart(5)}   ${String(c.missingResolver).padStart(16)}   ${String(c.deadTargets).padStart(12)}`,
		);
	}

	if (report.corporaMissingResolvers.length > 0) {
		console.log('');
		console.log(`corpora missing a resolver: ${report.corporaMissingResolvers.join(', ')}`);
	}
}

function groupByKind(findings: readonly AuditFinding[]): Map<string, AuditFinding[]> {
	const m = new Map<string, AuditFinding[]>();
	for (const f of findings) {
		const list = m.get(f.kind) ?? [];
		list.push(f);
		m.set(f.kind, list);
	}
	return m;
}
