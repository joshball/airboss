/**
 * Chart-renderer registry.
 *
 * Maps `CHART_TYPES` enum values to their renderer functions plus the
 * Zod schema for the chart's `spec.yaml`. The CLI looks up the renderer
 * by `spec.type` and validates the spec via the schema before invoking.
 *
 * Phase A registers the surface-analysis renderer. Phase B/C/D/E append
 * additional entries as each chart-type ships.
 */

import { CHART_TYPES, type ChartType } from '@ab/constants';
import type { z } from 'zod';
import type { ChartRenderer, ChartSpec } from '../types';
import { airmetSigmetSpecSchema, renderAirmetSigmet } from './airmet-sigmet';
import { freezingLevelSpecSchema, renderFreezingLevel } from './freezing-level';
import { gfaSpecSchema, renderGfa } from './gfa';
import { icingCipSpecSchema, renderIcingCip } from './icing-cip';
import { icingFipSpecSchema, renderIcingFip } from './icing-fip';
import { icingGairmetSpecSchema, renderIcingGairmet } from './icing-gairmet';
import { metarPlotGridSpecSchema, renderMetarPlotGrid } from './metar-plot-grid';
import { pirepPlotGridSpecSchema, renderPirepPlotGrid } from './pirep-plot-grid';
import { progChartSpecSchema, renderProgChart } from './prog-chart';
import { radarMosaicSpecSchema, renderRadarMosaic } from './radar-mosaic';
import { renderSatelliteIr, satelliteIrSpecSchema } from './satellite-ir';
import { renderSatelliteVis, satelliteVisSpecSchema } from './satellite-vis';
import { renderSatelliteWv, satelliteWvSpecSchema } from './satellite-wv';
import { renderSurfaceAnalysis, surfaceAnalysisSpecSchema } from './surface-analysis';
import { renderTafTimeline, tafTimelineSpecSchema } from './taf-timeline';
import { renderTurbulenceGairmet, turbulenceGairmetSpecSchema } from './turbulence-gairmet';
import { renderTurbulenceGtg, turbulenceGtgSpecSchema } from './turbulence-gtg';
import { renderWindsAloftFb, windsAloftFbSpecSchema } from './winds-aloft-fb';

export interface ChartRendererRegistration<TSpec extends ChartSpec = ChartSpec> {
	render: ChartRenderer<TSpec>;
	schema: z.ZodTypeAny;
}

/**
 * Per-chart-type renderer + spec schema. The CLI uses this for both
 * `bun run charts build` (lookup + invoke) and `bun run charts validate`
 * (lookup + validate without invoke).
 */
export const CHART_RENDERERS: Record<ChartType, ChartRendererRegistration> = {
	[CHART_TYPES.SURFACE_ANALYSIS]: {
		render: renderSurfaceAnalysis as ChartRenderer<ChartSpec>,
		schema: surfaceAnalysisSpecSchema,
	},
	// Phase B
	[CHART_TYPES.RADAR_MOSAIC]: {
		render: renderRadarMosaic as ChartRenderer<ChartSpec>,
		schema: radarMosaicSpecSchema,
	},
	[CHART_TYPES.ADVISORY_OVERLAY]: {
		render: renderAirmetSigmet as ChartRenderer<ChartSpec>,
		schema: airmetSigmetSpecSchema,
	},
	// Phase C
	[CHART_TYPES.METAR_PLOT_GRID]: {
		render: renderMetarPlotGrid as ChartRenderer<ChartSpec>,
		schema: metarPlotGridSpecSchema,
	},
	[CHART_TYPES.PIREP_PLOT_GRID]: {
		render: renderPirepPlotGrid as ChartRenderer<ChartSpec>,
		schema: pirepPlotGridSpecSchema,
	},
	[CHART_TYPES.WINDS_ALOFT_FB]: {
		render: renderWindsAloftFb as ChartRenderer<ChartSpec>,
		schema: windsAloftFbSpecSchema,
	},
	// Phase D (forecast cluster: prog + GFA + convective outlook + CVA)
	[CHART_TYPES.PROG_CHART]: {
		render: renderProgChart as ChartRenderer<ChartSpec>,
		schema: progChartSpecSchema,
	},
	[CHART_TYPES.GFA]: {
		render: renderGfa as ChartRenderer<ChartSpec>,
		schema: gfaSpecSchema,
	},
	[CHART_TYPES.CONVECTIVE_OUTLOOK]: notYetRegistered(CHART_TYPES.CONVECTIVE_OUTLOOK),
	[CHART_TYPES.CVA]: notYetRegistered(CHART_TYPES.CVA),
	// Phase E (icing + turbulence forecast cluster)
	[CHART_TYPES.TURBULENCE_GAIRMET]: {
		render: renderTurbulenceGairmet as ChartRenderer<ChartSpec>,
		schema: turbulenceGairmetSpecSchema,
	},
	[CHART_TYPES.TURBULENCE_GTG]: {
		render: renderTurbulenceGtg as ChartRenderer<ChartSpec>,
		schema: turbulenceGtgSpecSchema,
	},
	[CHART_TYPES.ICING_GAIRMET]: {
		render: renderIcingGairmet as ChartRenderer<ChartSpec>,
		schema: icingGairmetSpecSchema,
	},
	[CHART_TYPES.ICING_CIP]: {
		render: renderIcingCip as ChartRenderer<ChartSpec>,
		schema: icingCipSpecSchema,
	},
	[CHART_TYPES.ICING_FIP]: {
		render: renderIcingFip as ChartRenderer<ChartSpec>,
		schema: icingFipSpecSchema,
	},
	[CHART_TYPES.FREEZING_LEVEL]: {
		render: renderFreezingLevel as ChartRenderer<ChartSpec>,
		schema: freezingLevelSpecSchema,
	},
	// Phase F (GOES satellite -- IR, visible, water vapor)
	[CHART_TYPES.SATELLITE_IR]: {
		render: renderSatelliteIr as ChartRenderer<ChartSpec>,
		schema: satelliteIrSpecSchema,
	},
	[CHART_TYPES.SATELLITE_VISIBLE]: {
		render: renderSatelliteVis as ChartRenderer<ChartSpec>,
		schema: satelliteVisSpecSchema,
	},
	[CHART_TYPES.SATELLITE_WATER_VAPOR]: {
		render: renderSatelliteWv as ChartRenderer<ChartSpec>,
		schema: satelliteWvSpecSchema,
	},
	// Phase G
	[CHART_TYPES.TAF_TIMELINE]: {
		render: renderTafTimeline as ChartRenderer<ChartSpec>,
		schema: tafTimelineSpecSchema,
	},
};

/**
 * Placeholder for chart types whose renderers ship in a later phase.
 * The CLI surfaces the exact phase the type is scheduled for so authors
 * can route a request to the correct WP-phase agent.
 */
function notYetRegistered(type: ChartType): ChartRendererRegistration {
	const phaseFor: Partial<Record<ChartType, string>> = {
		'metar-plot-grid': 'C',
		'pirep-plot-grid': 'C',
		'winds-aloft-fb': 'C',
		'prog-chart': 'D',
		gfa: 'D',
		'convective-outlook': 'D',
		cva: 'D',
	};
	const phase = phaseFor[type] ?? '?';
	const message = `chart type '${type}' renderer not yet registered (scheduled for Phase ${phase}; see docs/work-packages/wx-chart-symbology-library/tasks.md)`;
	return {
		render: () => Promise.reject(new Error(message)),
		schema: {
			parse: () => {
				throw new Error(message);
			},
		} as unknown as z.ZodTypeAny,
	};
}
