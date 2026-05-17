/**
 * Unit tests for the TAF parser.
 *
 * Coverage targets the AIM 7-1-29 / AC 00-45H Ch 5 example structures:
 *   - Header: TAF / AMD / COR prefixes, station, issuance group, valid period.
 *   - INITIAL period: wind / visibility / weather / clouds.
 *   - FM change groups: timestamp resolved against issuance.
 *   - TEMPO / BECMG / PROB30 / PROB40 with explicit DDHH/DDHH ranges.
 *   - CAVOK shorthand.
 *   - Wind shear (`WS010/31022KT`) silently skipped (deferred per types.ts).
 *   - Multi-line whitespace normalization.
 */

import { describe, expect, it } from 'vitest';
import { parseTaf } from '../wx/taf/parser';

describe('parseTaf', () => {
	it('parses a typical TAF with FM groups', () => {
		const raw = `TAF KORD 101726Z 1018/1124 31011G19KT P6SM SCT080
  FM102100 05010KT P6SM SCT080
  FM110200 08005KT P6SM SCT080
  FM111100 04011KT P6SM FEW100`;
		const p = parseTaf(raw);
		expect(p.station).toBe('KORD');
		expect(p.amended).toBe(false);
		expect(p.corrected).toBe(false);
		// Initial + 3 FM = 4 periods.
		expect(p.periods).toHaveLength(4);
		const initial = p.periods[0];
		expect(initial?.kind).toBe('INITIAL');
		expect(initial?.wind).toEqual({
			directionDeg: 310,
			speedKt: 11,
			gustKt: 19,
			variable: false,
			calm: false,
		});
		expect(initial?.visibilitySM).toBeNull(); // P6SM is not a digit-shaped vis token; skipped.
		expect(initial?.clouds).toEqual([{ cover: 'SCT', heightFtAgl: 8000, cloudType: null }]);
		const fm1 = p.periods[1];
		expect(fm1?.kind).toBe('FM');
		expect(fm1?.start).toMatch(/T21:00:00\.000Z$/);
		expect(fm1?.wind).toEqual({
			directionDeg: 50,
			speedKt: 10,
			gustKt: null,
			variable: false,
			calm: false,
		});
		// Each baseline period's `end` matches the next FM's `start`.
		expect(initial?.end).toBe(fm1?.start);
		const fm2 = p.periods[2];
		expect(fm2?.kind).toBe('FM');
		expect(fm1?.end).toBe(fm2?.start);
		const fm3 = p.periods[3];
		expect(fm3?.end).toBe(p.validTo);
	});

	it('parses a TAF with PROB30 and FM groups (KMEM-like)', () => {
		const raw = `TAF KMEM 101720Z 1018/1124 34006KT P6SM SCT050 BKN120
  PROB30 1019/1024 4SM -TSRA BKN045CB
  FM110100 03009KT P6SM VCSH BKN060 BKN100
  PROB30 1102/1104 4SM -TSRA BKN045CB
  FM111200 04009KT P6SM BKN060 OVC100
  FM112000 03009KT P6SM SCT250`;
		const p = parseTaf(raw);
		expect(p.station).toBe('KMEM');
		// 6 periods: INITIAL, PROB30, FM, PROB30, FM, FM.
		expect(p.periods).toHaveLength(6);
		const prob1 = p.periods[1];
		expect(prob1?.kind).toBe('PROB30');
		expect(prob1?.probability).toBe(30);
		expect(prob1?.visibilitySM).toBe(4);
		expect(prob1?.weather).toContain('-TSRA');
		expect(prob1?.clouds).toEqual([{ cover: 'BKN', heightFtAgl: 4500, cloudType: 'CB' }]);
		// Check change ordering: INITIAL precedes PROB30 (stays at validFrom),
		// PROB30 carries explicit window 1019/1024.
		const initial = p.periods[0];
		expect(initial?.kind).toBe('INITIAL');
		expect(initial?.start).toBe(p.validFrom);
		// FM110100 is third period.
		const fm1 = p.periods[2];
		expect(fm1?.kind).toBe('FM');
		expect(fm1?.start).toMatch(/T01:00:00\.000Z$/);
	});

	it('parses a TAF with PROB30 TEMPO combo (composite change group)', () => {
		const raw = 'TAF KBOS 101720Z 1018/1124 20006KT P6SM FEW020 BKN040 PROB30 TEMPO 1021/1024 5SM -SHRA';
		const p = parseTaf(raw);
		// 2 periods: INITIAL + PROB30 (TEMPO swallowed into PROB).
		expect(p.periods).toHaveLength(2);
		const prob = p.periods[1];
		expect(prob?.kind).toBe('PROB30');
		expect(prob?.probability).toBe(30);
		expect(prob?.visibilitySM).toBe(5);
		expect(prob?.weather).toContain('-SHRA');
	});

	it('parses a TAF with TEMPO change groups (explicit window)', () => {
		const raw =
			'TAF KPIT 091730Z 0918/1024 15005KT 5SM HZ FEW020 TEMPO 0920/0922 1/2SM +TSRA OVC008CB FM100100 27008KT 5SM SHRA BKN020 OVC040';
		const p = parseTaf(raw);
		expect(p.station).toBe('KPIT');
		expect(p.periods).toHaveLength(3);
		const tempo = p.periods[1];
		expect(tempo?.kind).toBe('TEMPO');
		expect(tempo?.visibilitySM).toBe(0.5);
		expect(tempo?.weather).toContain('+TSRA');
		// Explicit window 0920/0922.
		expect(tempo?.start).toMatch(/T20:00:00\.000Z$/);
		expect(tempo?.end).toMatch(/T22:00:00\.000Z$/);
	});

	it('parses a TAF with BECMG change group', () => {
		const raw = 'TAF KSEA 091730Z 0918/1024 18005KT 6SM -SHRA OVC020 BECMG 1013/1015 P6SM SKC';
		const p = parseTaf(raw);
		expect(p.periods).toHaveLength(2);
		const becmg = p.periods[1];
		expect(becmg?.kind).toBe('BECMG');
		expect(becmg?.start).toMatch(/T13:00:00\.000Z$/);
		expect(becmg?.end).toMatch(/T15:00:00\.000Z$/);
		expect(becmg?.clouds).toEqual([{ cover: 'SKC', heightFtAgl: null, cloudType: null }]);
	});

	it('parses CAVOK in a TAF', () => {
		const raw = 'TAF KSFO 091800Z 0918/1018 27010KT CAVOK';
		const p = parseTaf(raw);
		const initial = p.periods[0];
		expect(initial?.cavok).toBe(true);
		expect(initial?.visibilitySM).toBe(10);
	});

	it('parses TAF AMD prefix', () => {
		const raw = 'TAF AMD KSEA 131800Z 1318/1424 09015G22KT 10SM SCT240';
		const p = parseTaf(raw);
		expect(p.amended).toBe(true);
		expect(p.station).toBe('KSEA');
	});

	it('parses TAF COR prefix', () => {
		const raw = 'TAF COR KSEA 131800Z 1318/1424 09015G22KT 10SM SCT240';
		const p = parseTaf(raw);
		expect(p.corrected).toBe(true);
	});

	it('skips wind-shear groups (deferred per v1)', () => {
		const raw = 'TAF KPIT 091730Z 0918/1024 15005KT 5SM HZ FEW020 WS010/31022KT';
		const p = parseTaf(raw);
		const initial = p.periods[0];
		// HZ is a present-weather token and should be captured.
		expect(initial?.weather).toEqual(['HZ']);
		// WS group is silently skipped: it is neither a cloud layer nor a wx code.
		expect(initial?.clouds).toEqual([{ cover: 'FEW', heightFtAgl: 2000, cloudType: null }]);
	});

	it('parses VRB wind direction', () => {
		const raw = 'TAF KDEN 101724Z 1018/1124 VRB06KT P6SM SCT040 BKN200';
		const p = parseTaf(raw);
		const initial = p.periods[0];
		expect(initial?.wind?.variable).toBe(true);
		expect(initial?.wind?.directionDeg).toBeNull();
		expect(initial?.wind?.speedKt).toBe(6);
	});

	it('handles multi-line TAF whitespace correctly', () => {
		const raw = `TAF KSEA 101736Z 1018/1124 23007KT P6SM BKN015
  FM102000 20006KT P6SM SCT020 BKN150
  FM110000 01007KT P6SM BKN080`;
		const p = parseTaf(raw);
		expect(p.periods).toHaveLength(3);
		const initial = p.periods[0];
		expect(initial?.wind?.directionDeg).toBe(230);
		expect(initial?.clouds).toEqual([{ cover: 'BKN', heightFtAgl: 1500, cloudType: null }]);
	});

	it('throws on missing station identifier', () => {
		expect(() => parseTaf('TAF 101736Z 1018/1124 23007KT')).toThrow(/expected 4-letter station identifier/);
	});

	it('throws on missing valid-period group', () => {
		expect(() => parseTaf('TAF KSEA 101736Z 23007KT P6SM')).toThrow(/expected DDHH\/DDHH valid-period group/);
	});

	it('preserves the original raw TAF after whitespace normalization', () => {
		const raw = `TAF KSEA 101736Z 1018/1124 23007KT P6SM BKN015
  FM102000 20006KT P6SM SCT020`;
		const p = parseTaf(raw);
		expect(p.raw).toBe('TAF KSEA 101736Z 1018/1124 23007KT P6SM BKN015 FM102000 20006KT P6SM SCT020');
	});

	it('decodes hour 24 as next-day 00Z (FAA convention)', () => {
		// Valid period 0918/1024 means "day 09 18Z through day 10 24Z" -- 24Z is day 11 00Z.
		const raw = 'TAF KSEA 091700Z 0918/1024 23007KT P6SM SKC';
		const p = parseTaf(raw);
		expect(p.validFrom).toMatch(/T18:00:00\.000Z$/);
		expect(p.validTo).toMatch(/T00:00:00\.000Z$/);
		// validTo should be on day 11.
		expect(new Date(p.validTo).getUTCDate()).toBe(11);
	});

	it('records the FM change-group decoded raw substring per period', () => {
		const raw = 'TAF KSEA 091700Z 0918/1024 23007KT P6SM SKC FM092100 27010KT 6SM -SHRA OVC020';
		const p = parseTaf(raw);
		expect(p.periods).toHaveLength(2);
		expect(p.periods[1]?.raw).toContain('FM092100');
	});
});
