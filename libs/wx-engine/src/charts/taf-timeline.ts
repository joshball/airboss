/**
 * Layer-3 TAF timeline chart spec derivation (per-station).
 *
 * Emits the wx-charts `taf-timeline` spec for a single station's TAF. The
 * source JSON carries the raw TAF text + issue / validity timestamps; the
 * renderer parses the raw text (`parseTaf`) and draws the timeline.
 *
 * `taf-timeline` is the one chart whose spec carries a `stationIcao`
 * field (required by `tafTimelineSpecSchema`). Slug pattern is
 * `wx-scenarios/<scenario-id>/taf-<station-lowercased>` so a 5-station
 * scenario emits 5 distinct timeline slugs (per ADR 027 PR 3).
 *
 * Lifted from the spike's pre-retirement
 * `spikes/wx-engine/src/charts/product-charts.ts` (PR #801).
 */

import { wxScenarioChartSlug } from '@ab/constants';
import type { DerivedTaf } from '../products/types';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';
import { CONUS_CENTRAL_MERIDIAN } from '@ab/wx-charts';

export function deriveTafTimelineChart(
	_truth: TruthModel,
	taf: DerivedTaf,
	stationIcao: string,
	scenarioId: string,
): ChartArtifact {
	const stationLower = stationIcao.toLowerCase();
	const slug = wxScenarioChartSlug(scenarioId, `taf-${stationLower}`);
	const cacheRelPath = `scenarios/${scenarioId}/taf-${stationLower}.json`;

	const sourceJson = {
		stationIcao,
		issuedAt: taf.issuedAt,
		validFrom: taf.validFrom,
		validTo: taf.validTo,
		source: 'wx-engine -- truth-derived synthetic TAF',
		raw: taf.raw,
	};

	const spec = {
		slug,
		type: 'taf-timeline' as const,
		title: `TAF Timeline -- ${stationIcao} (truth-derived)`,
		subtitle: `${taf.issuedAt} TAF -- valid ${taf.validFrom} to ${taf.validTo}`,
		extent: 'time' as const,
		stationIcao,
		// The taf-timeline schema requires the projection block (renderer ignores it).
		projection: {
			kind: 'lambert' as const,
			parallels: [33, 45] as [number, number],
			rotate: [CONUS_CENTRAL_MERIDIAN, 0] as [number, number],
		},
		sources: {
			taf: `cache://${cacheRelPath}`,
		},
		options: {
			axis_tick_hours: 3,
			show_legend: true,
			source_attribution: 'wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				path: cacheRelPath,
				bytes: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}
