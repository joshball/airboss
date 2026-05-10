/**
 * Unit tests for the PIREP parser.
 *
 * Covers the field set the PIREP plot-grid renderer consumes: kind
 * (UA/UUA), location (station + radial/distance), time, altitude,
 * aircraft type, sky cover, weather, temperature, wind, turbulence,
 * icing, and remarks. Plus the WP test-plan WXC-32 cases (light /
 * moderate / severe turbulence; rime / mixed / clear icing).
 */

import { describe, expect, it } from 'vitest';
import { parsePirep } from '../wx/pirep/parser';

describe('parsePirep', () => {
	it('parses a canonical UA report with turbulence + altitude band', () => {
		const raw = 'KCLE UA /OV CLE090030/TM 1538/FL080/TP B737/TB MOD 060-080/RM DURD';
		const p = parsePirep(raw);
		expect(p.station).toBe('KCLE');
		expect(p.kind).toBe('UA');
		expect(p.location.station).toBe('CLE');
		expect(p.location.radialDeg).toBe(90);
		expect(p.location.distanceNm).toBe(30);
		expect(p.timeHhmmZ).toBe(1538);
		expect(p.altitudeFt).toBe(8000);
		expect(p.aircraftType).toBe('B737');
		expect(p.turbulence?.intensity).toBe('MOD');
		expect(p.turbulence?.altitudeBandFt).toEqual({ min: 6000, max: 8000 });
		expect(p.remarks).toContain('DURD');
		expect(p.warnings).toEqual([]);
	});

	it('parses an urgent UUA with severe icing + clear type', () => {
		const raw = 'KORD UUA /OV ORD030020/TM 2245/FL090/TP C172/IC SEV CLR 080-100/RM CLIMB';
		const p = parsePirep(raw);
		expect(p.kind).toBe('UUA');
		expect(p.icing?.intensity).toBe('SEV');
		expect(p.icing?.type).toBe('CLR');
		expect(p.icing?.altitudeBandFt).toEqual({ min: 8000, max: 10000 });
	});

	it('parses an LGT turbulence + RIME icing report', () => {
		const raw = 'KMSP UA /OV MSP/TM 1200/FL060/TP PA28/TB LGT/IC LGT RIME 050-060';
		const p = parsePirep(raw);
		expect(p.turbulence?.intensity).toBe('LGT');
		expect(p.icing?.intensity).toBe('LGT');
		expect(p.icing?.type).toBe('RIME');
	});

	it('parses MX (mixed) icing', () => {
		const raw = 'KDEN UA /OV DEN/TM 1500/FL120/TP B190/IC MOD MX 100-120';
		const p = parsePirep(raw);
		expect(p.icing?.intensity).toBe('MOD');
		expect(p.icing?.type).toBe('MX');
	});

	it('captures sky-cover layers with base + top altitudes', () => {
		const raw = 'KSFO UA /OV SFO/TM 1730/FL050/TP C172/SK BKN025-040 OVC080';
		const p = parsePirep(raw);
		expect(p.skyCover).toHaveLength(2);
		expect(p.skyCover[0]).toEqual({ cover: 'BKN', baseFt: 2500, topFt: 4000 });
		expect(p.skyCover[1]).toEqual({ cover: 'OVC', baseFt: 8000, topFt: null });
	});

	it('captures wind + temperature when reported', () => {
		const raw = 'KMSP UA /OV MSP/TM 1300/FL090/TP B738/TA M15/WV 24045';
		const p = parsePirep(raw);
		expect(p.temperatureC).toBe(-15);
		expect(p.wind).toEqual({ directionDeg: 240, speedKt: 45 });
	});

	it('handles a station-only OV (no radial / distance)', () => {
		const raw = 'KBOS UA /OV BOS/TM 1100/FL040/TP C152/TB LGT';
		const p = parsePirep(raw);
		expect(p.location.station).toBe('BOS');
		expect(p.location.radialDeg).toBeNull();
		expect(p.location.distanceNm).toBeNull();
	});

	it('handles DURC altitude marker (during climb -- no FL stamped)', () => {
		const raw = 'KIAH UA /OV IAH/TM 1430/FL DURC/TP B738/TB MOD';
		const p = parsePirep(raw);
		expect(p.altitudeFt).toBeNull();
		expect(p.turbulence?.intensity).toBe('MOD');
	});

	it('warns on an unparseable WV token', () => {
		const raw = 'KMSP UA /OV MSP/TM 1300/FL090/TP B738/WV BADWIND';
		const p = parsePirep(raw);
		expect(p.wind).toBeNull();
		expect(p.warnings.some((w) => w.includes('WV'))).toBe(true);
	});

	it('throws when the body has no station identifier', () => {
		expect(() => parsePirep('UA /OV ORD/TM 1500')).toThrow(/station/);
	});

	it('throws when the body has no UA / UUA marker', () => {
		expect(() => parsePirep('KORD /OV ORD/TM 1500')).toThrow(/UA/);
	});
});
