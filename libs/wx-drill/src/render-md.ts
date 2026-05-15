/**
 * Markdown rendering of a `DrillPack`. CLI consumer writes the output to
 * `<basename>.md`. Browser-safe -- pure string construction.
 */

import type { DrillItem, DrillPack } from './types';

function renderItemHeader(item: DrillItem): string {
	const station = item.stationIcao ? ` (${item.stationIcao})` : '';
	return `### Item ${item.index + 1} - ${item.product.toUpperCase()}${station}`;
}

function renderItemProduct(item: DrillItem): string {
	return ['```text', item.raw, '```'].join('\n');
}

function renderItemAnnotations(item: DrillItem): string {
	const lines = ['| Token | Family | Decode | Why |', '| --- | --- | --- | --- |'];
	for (const a of item.annotations) {
		lines.push(`| \`${a.token}\` | \`${a.family}\` | ${a.decode} | ${a.why ?? ''} |`);
	}
	return lines.join('\n');
}

export function renderDrillMarkdown(pack: DrillPack): string {
	const lines: string[] = [];
	lines.push('# Encoded-text drill');
	lines.push('');
	lines.push(
		`Generated ${pack.generatedAt} from scenarios=${
			pack.args.fromScenarios === 'all' ? 'all' : pack.args.fromScenarios.join(',')
		}, seed=${pack.args.seed}, coverage=${pack.args.coverage}, layout=${pack.args.layout}.`,
	);
	lines.push('');
	lines.push(
		`Coverage: ${pack.coverageReport.coveredFamilies} / ${pack.coverageReport.totalFamilies} catalog token families exercised.`,
	);
	lines.push('');

	if (pack.args.layout === 'two-section') {
		lines.push('## Products');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemProduct(item));
			lines.push('');
		}
		lines.push('## Explanations');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemAnnotations(item));
			lines.push('');
		}
	} else {
		lines.push('## Items');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemProduct(item));
			lines.push('');
			lines.push(renderItemAnnotations(item));
			lines.push('');
		}
	}

	if (pack.coverageReport.uncoveredFamilies.length > 0) {
		lines.push('## Uncovered token families');
		lines.push('');
		for (const f of pack.coverageReport.uncoveredFamilies) lines.push(`- ${f}`);
		lines.push('');
	}

	return lines.join('\n');
}
