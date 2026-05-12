/**
 * Layer-3 winds-aloft FB chart spec derivation.
 *
 * Emits the wx-charts `winds-aloft-fb` spec from the truth-derived FB
 * bulletin + the station-coordinate registry. The wx-charts renderer
 * parses the raw bulletin (`parseFbGrid`) and matches each parsed station
 * code to the lon/lat lookup the source envelope provides.
 *
 * FB bulletins use 3-letter station codes (no leading `K`); the lookup
 * strips the `K` prefix from 4-letter ICAOs when emitting the source
 * envelope so the renderer can join the bulletin row to the registry.
 *
 * Lifted from the spike's pre-retirement
 * `spikes/wx-engine/src/charts/product-charts.ts` (PR #801).
 */

import { wxScenarioChartSlug } from '@ab/constants';
import type { DerivedFbGrid } from '../products/types';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';
import { CONUS_CENTRAL_MERIDIAN } from '@ab/wx-charts';

const BASE_BACK_OFFSET_HOURS = 6;
const MS_PER_HOUR = 3_600_000;

export function deriveWindsAloftChart(
	truth: TruthModel,
	fb: DerivedFbGrid,
	stationIcaos: string[],
	scenarioId: string,
): ChartArtifact {
	const slug = wxScenarioChartSlug(scenarioId, 'winds-aloft');
	const cacheRelPath = `scenarios/${scenarioId}/winds-aloft.json`;

	const stations = stationIcaos
		.map((icao) => truth.stations[icao])
		.filter((s): s is NonNullable<typeof s> => s !== undefined)
		.map((s) => ({
			icao: s.icao.length === 4 && s.icao.startsWith('K') ? s.icao.slice(1) : s.icao,
			lat: s.lat,
			lon: s.lon,
		}));

	const basedOnIso = new Date(new Date(truth.validAt).getTime() - BASE_BACK_OFFSET_HOURS * MS_PER_HOUR).toISOString();

	const sourceJson = {
		validAt: truth.validAt,
		basedOn: basedOnIso,
		source: 'wx-engine -- truth-derived synthetic FB bulletin',
		stations,
		raw: fb.raw,
	};

	const spec = {
		slug,
		type: 'winds-aloft-fb' as const,
		title: 'Winds and Temperatures Aloft (truth-derived)',
		subtitle: `${truth.validAt} -- ${stationIcaos.length} forecast points`,
		projection: {
			kind: 'lambert' as const,
			parallels: [33, 45] as [number, number],
			rotate: [CONUS_CENTRAL_MERIDIAN, 0] as [number, number],
		},
		extent: 'conus' as const,
		sources: {
			bulletin: `cache://${cacheRelPath}`,
		},
		options: {
			altitudes_ft: [3000, 6000, 9000, 12000, 18000],
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
