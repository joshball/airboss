/**
 * Layer-4 (scenario) Zod schemas.
 *
 * v1's `scenarioSpecSchema` rejects a non-empty `events` array
 * (`z.array(...).length(0)`) -- explicit so the v2 unlock is an obvious
 * one-line schema change. The `timedEventSchema` union is declared so the
 * wider design is visible.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` A.8.
 */

import { WX_SCENARIO_VALUES, XC_REGION_VALUES, XC_SCENARIO_VALUES } from '@ab/constants';
import { z } from 'zod';

const wxChangeEventSchema = z.object({
	kind: z.literal('wx-change'),
	atMinute: z.number().min(0),
	wxScenarioSlug: z.enum(WX_SCENARIO_VALUES as [string, ...string[]]),
});

const acFailureEventSchema = z.object({
	kind: z.literal('ac-failure'),
	atMinute: z.number().min(0),
	system: z.enum(['engine', 'electrical', 'vacuum', 'pitot-static']),
});

const atcChangeEventSchema = z.object({
	kind: z.literal('atc-change'),
	atMinute: z.number().min(0),
	instruction: z.string().min(1),
});

const notamActivationEventSchema = z.object({
	kind: z.literal('notam-activation'),
	atMinute: z.number().min(0),
	notamId: z.string().min(1),
});

const pirepDropEventSchema = z.object({
	kind: z.literal('pirep-drop'),
	atMinute: z.number().min(0),
	pirepId: z.string().min(1),
});

/** The timed-event discriminated union. */
export const timedEventSchema = z.discriminatedUnion('kind', [
	wxChangeEventSchema,
	acFailureEventSchema,
	atcChangeEventSchema,
	notamActivationEventSchema,
	pirepDropEventSchema,
]);

/**
 * The scenario spec schema. v1 rejects any non-empty `events` array -- the
 * `.max(0)` is an explicit gate, not an accident. v2 raises the cap.
 */
export const scenarioSpecSchema = z.object({
	id: z.enum(XC_SCENARIO_VALUES as [string, ...string[]]),
	label: z.string().min(1),
	regionSlug: z.enum(XC_REGION_VALUES as [string, ...string[]]),
	routeId: z.string().min(1),
	aircraftId: z.string().min(1),
	wxScenarioSlug: z.enum(WX_SCENARIO_VALUES as [string, ...string[]]),
	events: z.array(timedEventSchema).max(0, 'v1 scenarios ship zero events; raise this cap in v2'),
	validAt: z.string().datetime().optional(),
});

export type ScenarioSpecSchema = z.infer<typeof scenarioSpecSchema>;
