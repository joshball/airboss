/**
 * Tests for the static `helpId` / `pageId` extractor + validator.
 *
 * Fixtures are in-memory strings that mimic real Svelte source. The
 * extractor is pure and file-I/O agnostic so these stay hermetic.
 */

import { describe, expect, it } from 'vitest';
import { extractHelpIdRefs } from './extract';
import { extractHelpPageIds } from './registry-scan';
import { validateHelpIds } from './validate';

const FIXTURE_PATH = 'fixtures/example.svelte';

describe('extractHelpIdRefs', () => {
	it('captures double-quoted static helpId', () => {
		const src = '<InfoTip helpId="session-start" />';
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
		const ref = refs[0];
		expect(ref).toBeDefined();
		if (!ref) return;
		expect(ref.kind).toBe('static');
		if (ref.kind !== 'static') return;
		expect(ref.propName).toBe('helpId');
		expect(ref.helpId).toBe('session-start');
		expect(ref.line).toBe(1);
	});

	it('captures single-quoted static helpId', () => {
		const src = "<InfoTip helpId='session-start' />";
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
		const ref = refs[0];
		if (!ref || ref.kind !== 'static') throw new Error('expected static ref');
		expect(ref.helpId).toBe('session-start');
	});

	it('captures bare template-literal static helpId', () => {
		const src = '<InfoTip helpId={`session-start`} />';
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
		const ref = refs[0];
		if (!ref || ref.kind !== 'static') throw new Error('expected static ref');
		expect(ref.helpId).toBe('session-start');
	});

	it('captures pageId prop the same way as helpId', () => {
		const src = '<PageHelp pageId="memory-review" />';
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
		const ref = refs[0];
		if (!ref || ref.kind !== 'static') throw new Error('expected static ref');
		expect(ref.propName).toBe('pageId');
		expect(ref.helpId).toBe('memory-review');
	});

	it('reports dynamic expressions without failing', () => {
		const src = '<InfoTip helpId={KIND_HELP[item.kind].helpId} />';
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
		const ref = refs[0];
		if (!ref) throw new Error('missing ref');
		expect(ref.kind).toBe('dynamic');
		if (ref.kind !== 'dynamic') return;
		expect(ref.expression).toBe('KIND_HELP[item.kind].helpId');
	});

	it('computes accurate 1-based line numbers for every hit', () => {
		const src = [
			'<section>',
			'<PageHelp pageId="dashboard" />',
			'',
			'<InfoTip',
			'    helpId="memory-review"',
			'/>',
			'</section>',
		].join('\n');
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(2);
		expect(refs[0]?.line).toBe(2);
		expect(refs[1]?.line).toBe(5);
	});

	it('captures multiple references in a single file', () => {
		const src = [
			'<PageHelp pageId="dashboard" />',
			'<InfoTip helpId="memory-review" />',
			'<InfoTip helpId={dyn} />',
			"<PageHelp pageId='session-start' />",
		].join('\n');
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(4);
		const statics = refs.filter((r) => r.kind === 'static').map((r) => (r.kind === 'static' ? r.helpId : ''));
		expect(statics).toEqual(['dashboard', 'memory-review', 'session-start']);
	});

	it('ignores prop names that are not helpId or pageId', () => {
		const src = '<Foo somethingId="not-help" />';
		expect(extractHelpIdRefs(src, FIXTURE_PATH)).toHaveLength(0);
	});

	it('tolerates whitespace around the equals sign', () => {
		const src = '<InfoTip helpId = "session-start" />';
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		expect(refs).toHaveLength(1);
	});
});

describe('validateHelpIds', () => {
	it('reports unregistered static ids as errors', () => {
		const refs = extractHelpIdRefs('<PageHelp pageId="made-up" />', FIXTURE_PATH);
		const registered = new Set(['session-start']);
		const result = validateHelpIds(refs, registered);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.helpId).toBe('made-up');
		expect(result.errors[0]?.propName).toBe('pageId');
		expect(result.errors[0]?.filePath).toBe(FIXTURE_PATH);
		expect(result.staticChecked).toBe(1);
		expect(result.dynamicSkipped).toBe(0);
	});

	it('passes cleanly when every static id is registered', () => {
		const refs = extractHelpIdRefs('<PageHelp pageId="session-start" />', FIXTURE_PATH);
		const registered = new Set(['session-start', 'memory-review']);
		const result = validateHelpIds(refs, registered);
		expect(result.errors).toEqual([]);
		expect(result.staticChecked).toBe(1);
	});

	it('counts dynamic references in the skipped total, not the error list', () => {
		const refs = extractHelpIdRefs('<InfoTip helpId={foo} />', FIXTURE_PATH);
		const registered = new Set<string>();
		const result = validateHelpIds(refs, registered);
		expect(result.errors).toEqual([]);
		expect(result.dynamicSkipped).toBe(1);
		expect(result.staticChecked).toBe(0);
	});

	it('combines static + dynamic in the same pass', () => {
		const src = [
			'<PageHelp pageId="session-start" />',
			'<InfoTip helpId={dyn} />',
			'<PageHelp pageId="drifted-id" />',
		].join('\n');
		const refs = extractHelpIdRefs(src, FIXTURE_PATH);
		const registered = new Set(['session-start']);
		const result = validateHelpIds(refs, registered);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.helpId).toBe('drifted-id');
		expect(result.dynamicSkipped).toBe(1);
		expect(result.staticChecked).toBe(2);
	});
});

describe('extractHelpPageIds', () => {
	it('captures the page-level id on a typed export', () => {
		const src = [
			"import type { HelpPage } from '@ab/help';",
			'export const gettingStarted: HelpPage = {',
			"    id: 'getting-started',",
			'    sections: [',
			"        { id: 'intro', title: 'Intro', body: '' },",
			'    ],',
			'};',
		].join('\n');
		expect(extractHelpPageIds(src)).toEqual(['getting-started']);
	});

	it('captures the page-level id on a `satisfies HelpPage` export', () => {
		const src = [
			"import type { HelpPage } from '@ab/help';",
			'export const gettingStarted = {',
			"    id: 'getting-started',",
			'} satisfies HelpPage;',
		].join('\n');
		expect(extractHelpPageIds(src)).toEqual(['getting-started']);
	});

	it('returns an empty list for files with no page declaration', () => {
		const src = ["export const notAPage = { id: 'not-a-page' };", 'export const helper = () => 42;'].join('\n');
		expect(extractHelpPageIds(src)).toEqual([]);
	});

	it('captures multiple page declarations in the same file', () => {
		const src = [
			"import type { HelpPage } from '@ab/help';",
			"export const a: HelpPage = { id: 'a', sections: [{ id: 'a-1' }] };",
			"export const b: HelpPage = { id: 'b', sections: [{ id: 'b-1' }] };",
		].join('\n');
		expect(extractHelpPageIds(src)).toEqual(['a', 'b']);
	});
});
