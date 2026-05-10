/**
 * Unit tests for the METAR parser.
 *
 * Per WP test plan WXC-31 ("parseMetar handles edge tokens"). Covers the
 * field set the station-model renderer consumes plus the visibility /
 * wind / multi-layer-cloud edge cases the spike 03 fixture exercises.
 */

import { describe, expect, it } from 'vitest';
import { parseMetar } from '../wx/metar/parser';

describe('parseMetar', () => {
	it('parses a typical KSEA METAR with gust and high cloud layer', () => {
		const raw = 'KSEA 131153Z 09015G22KT 10SM SCT240 M09/M19 A3012 RMK AO2 SLP211 T10941194 11083 21094 56023 $';
		const p = parseMetar(raw);
		expect(p.station).toBe('KSEA');
		expect(p.day).toBe(13);
		expect(p.hour).toBe(11);
		expect(p.minute).toBe(53);
		expect(p.wind).toEqual({ directionDeg: 90, speedKt: 15, gustKt: 22, variable: false, calm: false });
		expect(p.visibilitySM).toBe(10);
		expect(p.clouds).toHaveLength(1);
		expect(p.clouds[0]).toEqual({ cover: 'SCT', heightFtAgl: 24000 });
		expect(p.tempC).toBe(-9);
		expect(p.dewpointC).toBe(-19);
		expect(p.altimeterInHg).toBe(30.12);
		expect(p.cavok).toBe(false);
		expect(p.warnings).toHaveLength(0);
	});

	it('parses a multi-layer overcast METAR', () => {
		const raw = 'KORD 131151Z 04007KT 1SM R10L/3000VP6000FT BR FEW003 BKN006 OVC012 02/01 A2998';
		const p = parseMetar(raw);
		expect(p.station).toBe('KORD');
		expect(p.wind?.directionDeg).toBe(40);
		expect(p.wind?.speedKt).toBe(7);
		expect(p.visibilitySM).toBe(1);
		expect(p.clouds).toHaveLength(3);
		expect(p.clouds[0]).toEqual({ cover: 'FEW', heightFtAgl: 300 });
		expect(p.clouds[1]).toEqual({ cover: 'BKN', heightFtAgl: 600 });
		expect(p.clouds[2]).toEqual({ cover: 'OVC', heightFtAgl: 1200 });
		expect(p.weather).toContain('BR');
	});

	it('parses a calm-wind METAR (00000KT)', () => {
		const raw = 'KMSP 131153Z 00000KT 10SM CLR M14/M19 A3015';
		const p = parseMetar(raw);
		expect(p.wind?.calm).toBe(true);
		expect(p.wind?.speedKt).toBe(0);
		expect(p.wind?.directionDeg).toBe(0);
	});

	it('handles VRB wind direction', () => {
		const raw = 'KAUS 131153Z VRB03KT 10SM CLR 12/05 A3010';
		const p = parseMetar(raw);
		expect(p.wind?.variable).toBe(true);
		expect(p.wind?.directionDeg).toBeNull();
		expect(p.wind?.speedKt).toBe(3);
	});

	it('handles M1/4SM low visibility', () => {
		const raw = 'KBOS 131153Z 09005KT M1/4SM FG VV001 M02/M03 A2999';
		const p = parseMetar(raw);
		expect(p.visibilitySM).not.toBeNull();
		// M1/4 -> v / 2 = 0.125
		expect(p.visibilitySM).toBeCloseTo(0.125, 3);
	});

	it('handles 1 1/2SM visibility (whole + fraction)', () => {
		const raw = 'KGRR 131153Z 27010KT 1 1/2SM -SN BKN008 OVC020 M02/M04 A2987';
		const p = parseMetar(raw);
		expect(p.visibilitySM).toBeCloseTo(1.5, 3);
	});

	it('handles 1/8SM visibility', () => {
		const raw = 'KCLE 131153Z 18006KT 1/8SM FG VV001 02/02 A2992';
		const p = parseMetar(raw);
		expect(p.visibilitySM).toBeCloseTo(0.125, 3);
	});

	it('handles CAVOK as 10SM', () => {
		const raw = 'EHAM 131150Z 27005KT CAVOK 12/08 Q1018';
		const p = parseMetar(raw);
		expect(p.cavok).toBe(true);
		expect(p.visibilitySM).toBe(10);
		expect(p.altimeterInHg).toBeCloseTo(30.06, 1);
	});

	it('handles VV (vertical visibility) as obscured cloud layer', () => {
		const raw = 'KGSO 131153Z 09003KT 1/4SM FG VV002 M01/M01 A2999';
		const p = parseMetar(raw);
		const vvLayer = p.clouds.find((c) => c.cover === 'VV');
		expect(vvLayer).toBeDefined();
		expect(vvLayer?.heightFtAgl).toBe(200);
	});

	it('parses gust speed and Q-altimeter (hPa) correctly', () => {
		const raw = 'EGLL 131150Z 27015G27KT 9999 SCT040 12/08 Q1010';
		const p = parseMetar(raw);
		expect(p.wind?.gustKt).toBe(27);
		expect(p.altimeterInHg).toBeCloseTo(29.83, 1);
	});

	it('warns and suppresses wind on /////KT sensor-out token', () => {
		const raw = 'KAAA 131153Z /////KT 10SM CLR 15/05 A3010';
		const p = parseMetar(raw);
		expect(p.wind).toBeNull();
		expect(p.warnings.length).toBeGreaterThan(0);
		expect(p.warnings[0]).toMatch(/wind/);
	});

	it('handles AUTO modifier between time and wind', () => {
		const raw = 'KAAA 131153Z AUTO 27010KT 10SM CLR 15/05 A3010';
		const p = parseMetar(raw);
		expect(p.wind?.directionDeg).toBe(270);
		expect(p.wind?.speedKt).toBe(10);
	});

	it('handles METAR/SPECI prefix', () => {
		const raw = 'METAR KAAA 131153Z 27010KT 10SM CLR 15/05 A3010';
		const p = parseMetar(raw);
		expect(p.station).toBe('KAAA');
	});

	it('throws on missing station identifier', () => {
		expect(() => parseMetar('111153Z 27010KT 10SM CLR')).toThrow(/station/);
	});

	it('throws on missing DDhhmmZ group', () => {
		expect(() => parseMetar('KAAA 27010KT 10SM CLR 15/05 A3010')).toThrow(/DDhhmmZ/);
	});

	it('strips RMK section from token parsing', () => {
		const raw = 'KSEA 131153Z 09015KT 10SM CLR 02/M01 A3012 RMK AO2 SLP211 T10941194';
		const p = parseMetar(raw);
		// SLP211 / T10941194 are inside RMK and must NOT pollute the cloud list.
		expect(p.clouds).toHaveLength(1);
		expect(p.clouds[0]?.cover).toBe('CLR');
	});

	it('records dewpoint as null when temp/dew has no slash dewpoint part', () => {
		// e.g. "M02/" appears occasionally when dewpoint sensor is out. Spec
		// scope decision: parser only accepts a fully-formed `MM/DD` group;
		// missing-dew variant 'M02/' falls through as an unknown token (no warning).
		const raw = 'KAAA 131153Z 27010KT 10SM CLR M02 A3010';
		const p = parseMetar(raw);
		expect(p.tempC).toBeNull();
		expect(p.dewpointC).toBeNull();
		// Altimeter still parses.
		expect(p.altimeterInHg).toBeCloseTo(30.1, 1);
	});
});
