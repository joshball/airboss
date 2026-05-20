import { describe, expect, it } from 'vitest';
import { looksLikeConvectiveSigmet, parseConvectiveSigmet } from '../parse-convective-sigmet';

// The user's pasted bulletin, byte-for-byte.
const FIXTURE_70E = `WSUS31 KKCI 192055
SIGE
CONVECTIVE SIGMET 70E
VALID UNTIL 2255Z
ME MA NH RI VT CT NY NJ AND ME MA NH CSTL WTRS
FROM 50NE ENE-70SE ENE-20ESE SAX-10SW ALB-40SSE MPV-50NE ENE
AREA TS MOV FROM 26035KT. TOPS TO FL400.

OUTLOOK VALID 192255-200255
AREA 1...FROM 40SW MSS-50SSW ALB-50SW BGR-50NE ACK-DCA-50ESE
EKN-GQO-30E MSL-40N BVT-50ESE ASP-50S DXO-40SW MSS
REF WW 230.
WST ISSUANCES EXPD. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.

AREA 2...FROM 40S MGM-60NE OMN-190SE CHS-220ENE TRV-60E PBI-90SE
MIA-160SE MIA-60WSW EYW-50SE TLH-40SSW CEW-40S MGM
WST ISSUANCES EXPD. REFER TO MOST RECENT ACUS01 KWNS FROM STORM
PREDICTION CENTER FOR SYNOPSIS AND METEOROLOGICAL DETAILS.`;

// AWC GFA viewer often prepends a "SIGMET: Convective" preview block.
const FIXTURE_70E_WITH_PREVIEW = `SIGMET: Convective
Begins:2026-05-19T20:55:00.000Z
Ends:2026-05-19T22:55:00.000Z
Top:40,000 ft
Movement:260 at 35 kt
${FIXTURE_70E}`;

const REFERENCE_NOW = new Date('2026-05-19T21:30:00Z');

describe('looksLikeConvectiveSigmet', () => {
	it('accepts a valid bulletin', () => {
		expect(looksLikeConvectiveSigmet(FIXTURE_70E)).toBe(true);
	});

	it('accepts a bulletin with the GFA preview header', () => {
		expect(looksLikeConvectiveSigmet(FIXTURE_70E_WITH_PREVIEW)).toBe(true);
	});

	it('rejects unrelated text', () => {
		expect(looksLikeConvectiveSigmet('METAR KMEM 191953Z 26010G15KT 10SM ...')).toBe(false);
	});
});

describe('parseConvectiveSigmet', () => {
	it('parses the WMO header and series id', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.wmoHeader).toBe('WSUS31 KKCI 192055');
		expect(parsed.region).toBe('SIGE');
		expect(parsed.seriesId).toBe('70E');
		expect(parsed.seriesNumber).toBe(70);
	});

	it('parses the issue + valid window in UTC', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.issuedAt.toISOString()).toBe('2026-05-19T20:55:00.000Z');
		expect(parsed.validUntil.toISOString()).toBe('2026-05-19T22:55:00.000Z');
	});

	it('parses the affected-regions list (states + waters)', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.affectedRegions).toEqual(['ME', 'MA', 'NH', 'RI', 'VT', 'CT', 'NY', 'NJ', 'ME MA NH CSTL WTRS']);
	});

	it('parses the active polygon as six FROM-points (closed ring)', () => {
		// FROM 50NE ENE-70SE ENE-20ESE SAX-10SW ALB-40SSE MPV-50NE ENE
		//  -> 6 vertices, last repeats first to close the polygon.
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.boundary.points).toHaveLength(6);
		expect(parsed.boundary.points[0]).toMatchObject({
			distanceNm: 50,
			quadrant: 'NE',
			navaidId: 'ENE',
			navaidName: 'Kennebunk',
		});
		expect(parsed.boundary.points[2]).toMatchObject({
			distanceNm: 20,
			quadrant: 'ESE',
			navaidId: 'SAX',
		});
		// Closing vertex equals the opening vertex.
		expect(parsed.boundary.points[5]).toMatchObject({
			distanceNm: 50,
			quadrant: 'NE',
			navaidId: 'ENE',
		});
	});

	it('classifies the phenomenon as area TS and parses movement + tops', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.phenomenon).toBe('area-ts');
		expect(parsed.movement).toEqual({ fromDeg: 260, speedKt: 35 });
		expect(parsed.topsFL).toBe(400);
		expect(parsed.severity).toBe('severe');
	});

	it('parses the outlook block with two areas', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(parsed.outlook).not.toBeNull();
		expect(parsed.outlook?.validFrom.toISOString()).toBe('2026-05-19T22:55:00.000Z');
		expect(parsed.outlook?.validUntil.toISOString()).toBe('2026-05-20T02:55:00.000Z');
		expect(parsed.outlook?.areas).toHaveLength(2);
	});

	it('captures the SPC watch reference (WW 230) in outlook area 1', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		const area1 = parsed.outlook?.areas[0];
		expect(area1?.label).toBe('AREA 1');
		expect(area1?.references).toContain('WW 230');
		expect(area1?.references.some((r) => r.startsWith('ACUS01'))).toBe(true);
	});

	it('also captures the ACUS01 reference in outlook area 2 (no WW)', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E, { now: REFERENCE_NOW });
		const area2 = parsed.outlook?.areas[1];
		expect(area2?.label).toBe('AREA 2');
		expect(area2?.references.some((r) => r.startsWith('ACUS01'))).toBe(true);
	});

	it('strips the GFA preview block before parsing', () => {
		const parsed = parseConvectiveSigmet(FIXTURE_70E_WITH_PREVIEW, { now: REFERENCE_NOW });
		expect(parsed.seriesId).toBe('70E');
		expect(parsed.boundary.points).toHaveLength(6);
	});

	it('throws when the WMO header is missing', () => {
		expect(() => parseConvectiveSigmet('not a sigmet', { now: REFERENCE_NOW })).toThrow(/WMO header/i);
	});
});
