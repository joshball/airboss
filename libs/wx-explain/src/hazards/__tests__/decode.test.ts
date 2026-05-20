import { describe, expect, it } from 'vitest';
import { decodeHazardText } from '../decode';

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

const FIXTURE_SVR = `Severe Thunderstorm Warning
End:2215 UTC 19 May
Office:KBOX`;

const REFERENCE_NOW = new Date('2026-05-19T21:00:00Z');

describe('decodeHazardText', () => {
	it('returns one Convective SIGMET for a single bulletin', () => {
		const { hazards, unrecognized } = decodeHazardText(FIXTURE_70E, { now: REFERENCE_NOW });
		expect(hazards).toHaveLength(1);
		expect(hazards[0].kind).toBe('convective-sigmet');
		expect(unrecognized).toHaveLength(0);
	});

	it('extracts the appended SVR from a SIGMET+SVR composite block', () => {
		const composite = `${FIXTURE_70E}\n${FIXTURE_SVR}`;
		const { hazards } = decodeHazardText(composite, { now: REFERENCE_NOW });
		expect(hazards.map((h) => h.kind)).toEqual(['convective-sigmet', 'severe-thunderstorm-warning']);
	});

	it('splits multiple bulletins on the AWC GFA dash separator', () => {
		const block = `${FIXTURE_70E}\n---\n${FIXTURE_70E}\n${FIXTURE_SVR}`;
		const { hazards } = decodeHazardText(block, { now: REFERENCE_NOW });
		// Same SIGMET twice -> dedupe to one; the SVR comes through.
		expect(hazards.map((h) => h.kind)).toEqual(['convective-sigmet', 'severe-thunderstorm-warning']);
	});
});
