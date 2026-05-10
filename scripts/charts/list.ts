/**
 * `bun run charts list` -- enumerate chart slugs under data/charts/wx/.
 *
 * Default: flat list. `--by-type`: groups by chart type, with each
 * group's CHART_TYPE_LABELS entry as the header.
 */

import { CHART_TYPE_LABELS, CHART_TYPE_VALUES, type ChartType } from '@ab/constants';
import { listChartSlugs, loadSpec } from './lib';

export function runList(args: readonly string[]): void {
	const slugs = listChartSlugs();
	if (slugs.length === 0) {
		console.log('charts list: no charts found under data/charts/wx/.');
		return;
	}

	if (!args.includes('--by-type')) {
		for (const slug of slugs) console.log(slug);
		return;
	}

	const groups = new Map<ChartType, string[]>();
	const orphans: { slug: string; type: string }[] = [];
	for (const slug of slugs) {
		try {
			const spec = loadSpec(slug);
			const type = spec.specObject.type;
			if (!(CHART_TYPE_VALUES as readonly string[]).includes(type)) {
				orphans.push({ slug, type });
				continue;
			}
			const t = type as ChartType;
			const list = groups.get(t) ?? [];
			list.push(slug);
			groups.set(t, list);
		} catch (err) {
			orphans.push({ slug, type: `unreadable (${err instanceof Error ? err.message : String(err)})` });
		}
	}

	for (const t of CHART_TYPE_VALUES) {
		const list = groups.get(t);
		if (list === undefined || list.length === 0) continue;
		console.log(`# ${CHART_TYPE_LABELS[t]}  (${list.length})`);
		for (const slug of list) console.log(`  ${slug}`);
	}
	if (orphans.length > 0) {
		console.log('# unrecognized type');
		for (const o of orphans) console.log(`  ${o.slug}  (${o.type})`);
	}
}
