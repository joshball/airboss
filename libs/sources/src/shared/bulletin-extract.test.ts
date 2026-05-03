/**
 * Unit tests for the bulletin (SAFO / InFO) section extractor.
 */

import { describe, expect, it } from 'vitest';
import { extractBulletinSections, findBulletinDate } from './bulletin-extract.ts';

describe('extractBulletinSections', () => {
	it('returns empty sections when the body has no recognised heading', () => {
		const body = 'Just a paragraph with no headings to detect.';
		const result = extractBulletinSections(body);
		expect(result.sections).toEqual([]);
	});

	it('returns empty sections for an empty body', () => {
		expect(extractBulletinSections('').sections).toEqual([]);
	});

	it('extracts the canonical SAFO section set', () => {
		const body = `Subject: Potential Damage to Nose Landing Gear by Improper Towing Procedures.

Purpose: This SAFO serves to alert air carriers about damage risks.

Background: The AMM advises only securing the towing strap to the chrome piston.

Discussion: Some General Operations Manuals instruct operators to place the
towing strap in specific places.

Recommended Action: Air carriers and commercial operators should remain mindful
that instructions in GOMs only indicate following this procedure when no tow
collar is present.

Contact: Questions or comments regarding this SAFO should be directed to the
Aircraft Evaluation Division.
`;
		const result = extractBulletinSections(body);
		expect(result.sections.map((s) => s.code)).toEqual([
			'subject',
			'purpose',
			'background',
			'discussion',
			'recommended-action',
			'contact',
		]);
		// Each section's body starts with the prose AFTER the heading line.
		const purpose = result.sections.find((s) => s.code === 'purpose');
		expect(purpose).toBeDefined();
		expect(purpose?.bodyMd.startsWith('This SAFO serves to alert')).toBe(true);
	});

	it('preserves document order via ordinal', () => {
		const body = `Subject: A.

Discussion: B.

Recommended Action: C.

Contact: D.
`;
		const result = extractBulletinSections(body);
		expect(result.sections.map((s) => s.ordinal)).toEqual([0, 1, 2, 3]);
	});

	it('emits stable content_hash per section', () => {
		const body = 'Subject: Stable.\n\nContact: 9-avs-afs-100@faa.gov.\n';
		const a = extractBulletinSections(body);
		const b = extractBulletinSections(body);
		expect(a.sections.map((s) => s.contentHash)).toEqual(b.sections.map((s) => s.contentHash));
	});

	it('handles plural variant "Recommended Actions"', () => {
		const body = `Subject: A.

Recommended Actions: Multiple bulletpoints.

Contact: end.
`;
		const result = extractBulletinSections(body);
		expect(result.sections.map((s) => s.code)).toEqual(['subject', 'recommended-actions', 'contact']);
	});
});

describe('findBulletinDate', () => {
	it('extracts MM/DD/YY from the FAA header band', () => {
		const body = `SAFO 23001
DATE: 01/03/23
Flight Standards Service`;
		expect(findBulletinDate(body)).toBe('2023-01-03');
	});

	it('extracts MM/DD/YYYY from the FAA header band', () => {
		const body = `InFO 25001
DATE: 1/16/2025
Flight Standards Service`;
		expect(findBulletinDate(body)).toBe('2025-01-16');
	});

	it('returns null when no DATE line is present', () => {
		expect(findBulletinDate('No date line in this body.')).toBeNull();
	});

	it('only scans the header (first ~30 lines)', () => {
		const filler = Array(40).fill('filler').join('\n');
		const body = `${filler}\nDATE: 01/01/23`;
		expect(findBulletinDate(body)).toBeNull();
	});
});
