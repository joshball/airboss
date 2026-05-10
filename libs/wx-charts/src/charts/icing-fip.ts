/**
 * Forecast Icing Product (FIP) chart renderer.
 *
 * The Forecast Icing Product (FIP) projects the same icing-probability +
 * severity field forward in time (1, 2, 3, 6, 9, 12, 15, 18 hour valid
 * periods per the AWC product page at https://aviationweather.gov/icing).
 * The symbology is identical to CIP -- filled probability bands cyan ->
 * blue -> purple plus optional severity contour lines -- so the renderer
 * delegates to the shared CIP / FIP body and only differs in the spec
 * schema's `type` literal and the chrome-attribution string.
 *
 * Source data shape mirrors `icing-cip.ts`; the only meaningful field
 * addition is `forecast_valid_iso` for the chrome subtitle.
 *
 * Pure renderer: bytes in, SVG string out. Browser-safe (no Node imports).
 */

import { CHART_TYPES } from '@ab/constants';
import { z } from 'zod';
import type { ChartRenderInput, ChartRenderResult, ChartSpec } from '../types';
import { renderCipFipShared } from './icing-cip';

// ------------------------------------------------------------------
// Spec schema
// ------------------------------------------------------------------

const projectionSchema = z.object({
	kind: z.literal('lambert'),
	parallels: z.tuple([z.number(), z.number()]),
	rotate: z.tuple([z.number(), z.number()]),
});

const extentSchema = z.union([
	z.literal('conus'),
	z.literal('alaska'),
	z.literal('hawaii'),
	z.object({
		lon_min: z.number(),
		lat_min: z.number(),
		lon_max: z.number(),
		lat_max: z.number(),
	}),
]);

const fipOptionsSchema = z.object({
	show_legend: z.boolean().default(true),
	show_severity_contours: z.boolean().default(true),
	source_attribution: z.string().optional(),
});

export const icingFipSpecSchema = z.object({
	slug: z.string(),
	type: z.literal(CHART_TYPES.ICING_FIP),
	title: z.string().min(1),
	subtitle: z.string().optional(),
	projection: projectionSchema,
	extent: extentSchema,
	sources: z.object({
		field: z.string(),
	}),
	options: fipOptionsSchema.optional(),
});

export type IcingFipSpec = z.infer<typeof icingFipSpecSchema> & ChartSpec;

// ------------------------------------------------------------------
// Renderer entry point
// ------------------------------------------------------------------

export async function renderIcingFip(input: ChartRenderInput<IcingFipSpec>): Promise<ChartRenderResult> {
	// The shared body parses the spec/source contract; we only need to
	// remap the input.spec to the CIP shape so the discriminator
	// matches.
	return renderCipFipShared(
		{
			...input,
			spec: { ...input.spec, type: CHART_TYPES.ICING_CIP } as never,
		},
		'icing-fip',
	);
}
