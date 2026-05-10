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
import { radarMosaicSpecSchema, renderRadarMosaic } from './radar-mosaic';
import { renderSurfaceAnalysis, surfaceAnalysisSpecSchema } from './surface-analysis';

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
	[CHART_TYPES.ADVISORY_OVERLAY]: notYetRegistered(CHART_TYPES.ADVISORY_OVERLAY),
	// Phase C
	[CHART_TYPES.METAR_PLOT_GRID]: notYetRegistered(CHART_TYPES.METAR_PLOT_GRID),
	[CHART_TYPES.PIREP_PLOT_GRID]: notYetRegistered(CHART_TYPES.PIREP_PLOT_GRID),
	[CHART_TYPES.WINDS_ALOFT_FB]: notYetRegistered(CHART_TYPES.WINDS_ALOFT_FB),
	// Phase D
	[CHART_TYPES.PROG_CHART]: notYetRegistered(CHART_TYPES.PROG_CHART),
	[CHART_TYPES.GFA]: notYetRegistered(CHART_TYPES.GFA),
	[CHART_TYPES.CONVECTIVE_OUTLOOK]: notYetRegistered(CHART_TYPES.CONVECTIVE_OUTLOOK),
	// Phase E
	[CHART_TYPES.CVA]: notYetRegistered(CHART_TYPES.CVA),
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
		cva: 'E',
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
