/**
 * Layer-2 (flight) Zod schemas.
 *
 * Validates: route waypoint ids are unique; altitude profile is
 * non-negative; the CG envelope is a valid polygon (forward < aft at every
 * weight); the cruise polar is monotonic in pressure altitude; the
 * fuel-burn curve is non-negative; equipment values are in the known
 * enums.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Validation".
 */

import { XC_AIRCRAFT_VALUES, XC_ROUTE_VALUES } from '@ab/constants';
import { z } from 'zod';

export const waypointSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	lon: z.number().min(-180).max(180),
	lat: z.number().min(-90).max(90),
	airportIcao: z.string().optional(),
	kind: z.enum(['airport', 'fix']),
});

export const altitudeStepSchema = z.object({
	altitudeFtMsl: z.number().min(0, 'altitude must be non-negative').max(60000),
});

export const speedStepSchema = z.object({
	tasKt: z.number().gt(0, 'true airspeed must be positive').max(600),
});

export const routeSpecSchema = z
	.object({
		id: z.enum(XC_ROUTE_VALUES as [string, ...string[]]),
		label: z.string().min(1),
		waypoints: z.array(waypointSchema).min(2, 'a route needs at least 2 waypoints'),
		altitudeProfile: z.array(altitudeStepSchema),
		speedProfile: z.array(speedStepSchema),
		alternateIcao: z.string().optional(),
		plannedDepartureUtc: z.string().datetime(),
	})
	.refine((r) => new Set(r.waypoints.map((w) => w.id)).size === r.waypoints.length, {
		message: 'route waypoint ids must be unique',
	})
	.refine((r) => r.altitudeProfile.length === r.waypoints.length - 1, {
		message: 'altitudeProfile length must equal waypoints.length - 1 (one per leg)',
	})
	.refine((r) => r.speedProfile.length === r.waypoints.length - 1, {
		message: 'speedProfile length must equal waypoints.length - 1 (one per leg)',
	});

export const cruisePolarPointSchema = z.object({
	pressureAltitudeFtMsl: z.number().min(0).max(60000),
	tasKt: z.number().gt(0).max(600),
	gph: z.number().gt(0).max(100),
});

export const performancePolarSchema = z
	.object({
		climb: z.object({ rateFpm: z.number().gt(0), kiasIas: z.number().gt(0) }),
		cruise: z.object({
			points: z.array(cruisePolarPointSchema).min(2, 'cruise polar needs at least 2 points'),
		}),
		descent: z.object({ rateFpm: z.number().gt(0), kiasIas: z.number().gt(0) }),
		serviceCeilingFtMsl: z.number().gt(0).max(60000),
	})
	.refine(
		(p) => {
			// Pressure altitude must strictly increase across the polar points.
			for (let i = 1; i < p.cruise.points.length; i++) {
				if (p.cruise.points[i].pressureAltitudeFtMsl <= p.cruise.points[i - 1].pressureAltitudeFtMsl) {
					return false;
				}
			}
			return true;
		},
		{ message: 'cruise polar points must be strictly monotonic in pressure altitude' },
	);

export const fuelBurnCurveSchema = z.object({
	cruise: z.object({ defaultGph: z.number().gt(0).max(100) }),
	climb: z.object({ gph: z.number().gt(0).max(100) }),
	taxi: z.object({ gph: z.number().gt(0).max(100) }),
});

export const wbEnvelopeVertexSchema = z.object({
	weightLb: z.number().gt(0),
	fwdCgIn: z.number().gt(0),
	aftCgIn: z.number().gt(0),
});

export const weightBalanceEnvelopeSchema = z
	.object({
		maxGrossWeightLb: z.number().gt(0),
		minWeightLb: z.number().gt(0),
		envelope: z.array(wbEnvelopeVertexSchema).min(2, 'CG envelope needs at least 2 vertices'),
	})
	.refine((wb) => wb.minWeightLb < wb.maxGrossWeightLb, {
		message: 'minWeightLb must be less than maxGrossWeightLb',
	})
	.refine((wb) => wb.envelope.every((v) => v.fwdCgIn < v.aftCgIn), {
		message: 'CG envelope is inverted -- forward CG must be less than aft CG at every weight',
	});

export const equipmentListSchema = z.object({
	nav: z.array(z.enum(['vor', 'gps-vfr-only', 'gps-ifr', 'dme', 'adf'])),
	com: z.array(z.enum(['comm-1', 'comm-2'])),
	transponder: z.enum(['none', 'mode-a', 'mode-c', 'mode-s']),
	adsbOut: z.boolean(),
	autopilot: z.boolean(),
	ifrCertified: z.boolean(),
});

export const aircraftSpecSchema = z.object({
	id: z.enum(XC_AIRCRAFT_VALUES as [string, ...string[]]),
	model: z.string().min(1),
	perfPolar: performancePolarSchema,
	fuelBurnCurve: fuelBurnCurveSchema,
	fuelCapacityGal: z.number().gt(0).max(500),
	wbEnvelope: weightBalanceEnvelopeSchema,
	equipment: equipmentListSchema,
});

export const pilotProfileSchema = z.object({
	certificate: z.enum(['student', 'private', 'commercial', 'atp']),
	instrumentRated: z.boolean(),
	totalTimeHr: z.number().min(0),
});

export const flightSchema = z.object({
	scenarioId: z.string().min(1),
	route: routeSpecSchema,
	aircraft: aircraftSpecSchema,
	pilot: pilotProfileSchema.optional(),
});

export type RouteSpecSchema = z.infer<typeof routeSpecSchema>;
export type AircraftSpecSchema = z.infer<typeof aircraftSpecSchema>;
export type FlightSchema = z.infer<typeof flightSchema>;
