/**
 * Pure-function tests for `buildCfrPartMetadata` -- the merge logic that
 * combines manifest-derived `officialTitle` (eCFR XML <HEAD>) with the
 * authoring overlay (`description` / `whyItMatters` / `scope`) into a
 * single `reference.metadata` payload.
 *
 * Lives next to the seeder so refactors to the merge precedence trip
 * here before they reach the seed-from-manifest contract test.
 */

import { describe, expect, it } from 'vitest';
import type { CfrManifest } from '../manifest-validation';
import { buildCfrPartMetadata } from './cfr';
import type { CfrPartOverlay } from './cfr-authoring';

const baseManifest: CfrManifest = {
	kind: 'cfr',
	schemaVersion: 1,
	title: '14',
	editionSlug: '2026',
	editionDate: '2026-04-22',
	sourceUrl: 'file:///fixture.xml',
	sourceSha256: 'a'.repeat(64),
	fetchedAt: '2026-04-30T22:31:18.124Z',
	partCount: 1,
	subpartCount: 0,
	sectionCount: 1,
	parts: [{ number: '91', officialTitle: 'General Operating and Flight Rules' }],
};

describe('buildCfrPartMetadata', () => {
	it('manifest officialTitle wins; authoring description/whyItMatters/scope overlay', () => {
		const overlay: CfrPartOverlay = {
			description: 'description from yaml',
			whyItMatters: 'why from yaml',
			scope: 'Operations',
		};
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: 'General Operating and Flight Rules',
			authoringOverlay: overlay,
		});
		expect(md.officialTitle).toBe('General Operating and Flight Rules');
		expect(md.description).toBe('description from yaml');
		expect(md.whyItMatters).toBe('why from yaml');
		expect(md.scope).toBe('Operations');
		expect(md.title_number).toBe('14');
		expect(md.part_number).toBe('91');
		expect(md.section_count).toBe(286);
	});

	it('authoring entry without an overlay key is omitted from metadata (not stamped as undefined)', () => {
		const overlay: CfrPartOverlay = { description: 'only desc' };
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: 'General Operating and Flight Rules',
			authoringOverlay: overlay,
		});
		expect(md.description).toBe('only desc');
		expect('whyItMatters' in md).toBe(false);
		expect('scope' in md).toBe(false);
	});

	it('missing authoring entry: only manifest fields populate metadata, no errors', () => {
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: 'General Operating and Flight Rules',
			authoringOverlay: undefined,
		});
		expect(md.officialTitle).toBe('General Operating and Flight Rules');
		expect('description' in md).toBe(false);
		expect('whyItMatters' in md).toBe(false);
		expect('scope' in md).toBe(false);
	});

	it('missing manifest officialTitle: officialTitle is omitted; authoring overlay still applies', () => {
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: undefined,
			authoringOverlay: { description: 'x', whyItMatters: 'y', scope: 'Operations' },
		});
		expect('officialTitle' in md).toBe(false);
		expect(md.description).toBe('x');
		expect(md.whyItMatters).toBe('y');
		expect(md.scope).toBe('Operations');
	});

	it('authoring overlay with topics flows through to metadata.topics', () => {
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: 'General Operating and Flight Rules',
			authoringOverlay: { topics: ['weather', 'airspace', 'communications'] },
		});
		expect(md.topics).toEqual(['weather', 'airspace', 'communications']);
	});

	it('authoring overlay without topics omits the key (not stamped as undefined)', () => {
		const md = buildCfrPartMetadata({
			manifest: baseManifest,
			partKey: '91',
			sectionCount: 286,
			manifestPartOfficialTitle: 'General Operating and Flight Rules',
			authoringOverlay: { description: 'desc' },
		});
		expect('topics' in md).toBe(false);
	});
});
