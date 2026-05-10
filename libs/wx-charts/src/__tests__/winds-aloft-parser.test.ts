/**
 * Unit tests for the winds aloft FB parser.
 *
 * Covers WP test plan WXC-33 / WXC-34: missing-temp at low altitudes
 * (4-char rows), the FB encoding rule for winds > 99 KT (dir + 50,
 * speed - 100), light-and-variable encoding, sign convention above
 * FL240, and bulletins with multiple stations.
 */

import { describe, expect, it } from 'vitest';
import { parseFbGrid } from '../wx/winds-aloft/parser';

const SAMPLE_BULLETIN = `DATA BASED ON 211200Z
VALID 211800Z   FOR USE 1700-2100Z. TEMPS NEG ABV 24000

   FT  3000    6000    9000   12000   18000   24000   30000   34000   39000
ABQ        2306+15  2410+10  2515+05  2519-04  2528-15  264547  265253  256456
ABR  2515  2207+02  250207  270413  261917  282231  283047  274054  264565
ORD  9900  3608+10  3612+05  3614+00  3617-05  3620-12  264235  264549  254056`;

describe('parseFbGrid', () => {
	it('parses the bulletin header (basedOn + validAt)', () => {
		const result = parseFbGrid(SAMPLE_BULLETIN);
		expect(result.basedOn).toMatch(/^D21T12/);
		expect(result.validAt).toMatch(/^D21T18/);
		expect(result.warnings).toEqual([]);
	});

	it('parses three stations with rows aligned to the FT header', () => {
		const result = parseFbGrid(SAMPLE_BULLETIN);
		expect(result.stations).toHaveLength(3);
		const abr = result.stations.find((s) => s.station === 'ABR');
		expect(abr).toBeDefined();
		expect(abr?.rows).toHaveLength(9); // ABR has all nine altitude columns.
	});

	it('decodes a typical 6-char row (250/02 KT, +07 C)', () => {
		// ABR has a 3000 row so its tokens map 1:1 to the 9-alt header. The
		// 9000 row is `250207` -> dirCode 25 -> dir=250, spd=02, temp=+07.
		const result = parseFbGrid(SAMPLE_BULLETIN);
		const abr = result.stations.find((s) => s.station === 'ABR');
		const row9000 = abr?.rows.find((r) => r.altitudeFt === 9000);
		expect(row9000).toBeDefined();
		expect(row9000?.directionDeg).toBe(250);
		expect(row9000?.speedKt).toBe(2);
		expect(row9000?.temperatureC).toBe(7);
	});

	it('decodes a 4-char row (no temperature) at low altitude', () => {
		const result = parseFbGrid(SAMPLE_BULLETIN);
		const abr = result.stations.find((s) => s.station === 'ABR');
		const row3000 = abr?.rows.find((r) => r.altitudeFt === 3000);
		expect(row3000).toBeDefined();
		expect(row3000?.directionDeg).toBe(250);
		expect(row3000?.speedKt).toBe(15);
		expect(row3000?.temperatureC).toBeNull();
	});

	it('decodes light-and-variable encoding (9900)', () => {
		const result = parseFbGrid(SAMPLE_BULLETIN);
		const ord = result.stations.find((s) => s.station === 'ORD');
		const row3000 = ord?.rows.find((r) => r.altitudeFt === 3000);
		expect(row3000?.directionDeg).toBeNull();
		expect(row3000?.speedKt).toBe(0);
	});

	it('applies the implied-negative-temp rule above FL240 (a 6-char row at FL30000)', () => {
		// ABR is a 9-token station; the FL30000 column is `283047`.
		// dirCode 28 -> dir=280, spd=30, temp=47 -> implied -47 (above FL240).
		const result = parseFbGrid(SAMPLE_BULLETIN);
		const abr = result.stations.find((s) => s.station === 'ABR');
		const row30000 = abr?.rows.find((r) => r.altitudeFt === 30000);
		expect(row30000).toBeDefined();
		expect(row30000?.directionDeg).toBe(280);
		expect(row30000?.speedKt).toBe(30);
		expect(row30000?.temperatureC).toBe(-47);
	});

	it('decodes a >99 KT wind via the dir+50 / spd-100 rule', () => {
		// 731960 at FL390: dirCode 73 -> dir=(73-50)*10=230, spd=19+100=119,
		// temp 60 -> implied negative above FL240 -> -60.
		const bulletin = `DATA BASED ON 211200Z
VALID 211800Z

   FT   39000
ABC  731960`;
		const result = parseFbGrid(bulletin);
		const station = result.stations.find((s) => s.station === 'ABC');
		const row39000 = station?.rows.find((r) => r.altitudeFt === 39000);
		expect(row39000).toBeDefined();
		expect(row39000?.directionDeg).toBe(230);
		expect(row39000?.speedKt).toBe(119);
		expect(row39000?.temperatureC).toBe(-60);
	});

	it('warns and skips an unparseable row', () => {
		const bulletin = `   FT   3000
ABC  XXXX`;
		const result = parseFbGrid(bulletin);
		expect(result.warnings.some((w) => w.includes('unparseable'))).toBe(true);
		expect(result.stations).toHaveLength(0);
	});

	it('warns when a station appears before the FT header', () => {
		const bulletin = `ABC  2515
   FT   3000`;
		const result = parseFbGrid(bulletin);
		expect(result.warnings.some((w) => w.includes('before FT'))).toBe(true);
	});
});
