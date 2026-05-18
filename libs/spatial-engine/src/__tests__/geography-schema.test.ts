/**
 * Layer-1 geography schema tests.
 *
 * Verifies the Zod schemas accept a Memphis-like literal and reject
 * malformed inputs (open polygon ring, out-of-CONUS coordinate,
 * out-of-range runway heading).
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-4.
 */

import { describe, expect, it } from 'vitest';
import { airportSchema, airspacePolygonSchema, geographySchema } from '../geography/schema';

const validAirport = {
	icao: 'KMEM',
	name: 'Memphis International',
	lon: -89.9767,
	lat: 35.0424,
	elevationFtMsl: 341,
	attended: true,
	airspaceClass: 'B' as const,
	runways: [
		{
			designator: '18C/36C',
			headingDegMagnetic: 175,
			lengthFt: 9320,
			widthFt: 150,
			surface: 'concrete' as const,
			hasPrecisionApproach: true,
		},
	],
	frequencies: [{ label: 'Tower', mhz: 118.3 }],
	fbos: [{ name: 'Wilson Air Center', fuel: ['100LL' as const, 'JET-A' as const] }],
};

const validAirspace = {
	id: 'asp-kmem-b',
	airspaceClass: 'B' as const,
	label: 'Memphis Class B',
	floorFtMsl: 0,
	ceilingFtMsl: 10000,
	geometry: {
		type: 'Polygon' as const,
		coordinates: [
			[
				[-90.1, 35.0],
				[-89.8, 35.0],
				[-89.8, 35.2],
				[-90.1, 35.2],
				[-90.1, 35.0],
			],
		],
	},
};

describe('geographySchema', () => {
	it('accepts a synthetic Memphis-like geography literal', () => {
		const result = geographySchema.safeParse({
			regionSlug: 'memphis',
			bounds: { minLon: -91.5, minLat: 33.5, maxLon: -87.5, maxLat: 36.7 },
			airports: [validAirport],
			airspace: [validAirspace],
			navaids: [{ id: 'MEM', kind: 'VORTAC', name: 'Memphis VORTAC', lon: -89.98, lat: 35.07, frequencyMhz: 117.5 }],
			basemap: { type: 'FeatureCollection', features: [] },
		});
		expect(result.success).toBe(true);
	});
});

describe('airspacePolygonSchema', () => {
	it('rejects an airspace polygon with an open ring', () => {
		const openRing = {
			...validAirspace,
			geometry: {
				type: 'Polygon' as const,
				// Last point does NOT equal the first -- the ring is open.
				coordinates: [
					[
						[-90.1, 35.0],
						[-89.8, 35.0],
						[-89.8, 35.2],
						[-90.1, 35.2],
					],
				],
			},
		};
		const result = airspacePolygonSchema.safeParse(openRing);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('not closed'))).toBe(true);
		}
	});

	it('accepts a properly closed airspace polygon', () => {
		expect(airspacePolygonSchema.safeParse(validAirspace).success).toBe(true);
	});
});

describe('airportSchema', () => {
	it('rejects an airport with a longitude outside CONUS', () => {
		const result = airportSchema.safeParse({ ...validAirport, lon: 5 });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.includes('lon'))).toBe(true);
		}
	});

	it('rejects an airport with a runway heading of 400 degrees', () => {
		const result = airportSchema.safeParse({
			...validAirport,
			runways: [{ ...validAirport.runways[0], headingDegMagnetic: 400 }],
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.path.join('.').includes('headingDegMagnetic'))).toBe(true);
		}
	});

	it('accepts a valid airport record', () => {
		expect(airportSchema.safeParse(validAirport).success).toBe(true);
	});
});
