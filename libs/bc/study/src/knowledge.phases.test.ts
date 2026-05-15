/**
 * Tests for `splitContentPhases` and `lifecycleFromContent`.
 *
 * Post-migration both helpers parse `:::phase name="..."` directives
 * (Phase 2 of the markdown-directive cleanup). The legacy H2-heading
 * splitter is gone -- a file that still ships `## Practice` headings
 * will return zero phases here, which is correct: the lint script
 * (`scripts/lint/phase-directive.ts`) catches the regression at
 * `bun run check` time.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NODE_LIFECYCLES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { lifecycleFromContent, splitContentPhases } from './knowledge';

function phaseBlock(name: string, body: string): string {
	return `:::phase name="${name}"\n${body}\n:::`;
}

describe('splitContentPhases', () => {
	it('returns null for every bucket when no phase directives are present', () => {
		const result = splitContentPhases('Some prose without a phase wrapper.');
		expect(result).toEqual({
			context: null,
			problem: null,
			discover: null,
			reveal: null,
			practice: null,
			connect: null,
			verify: null,
		});
	});

	it('populates all seven buckets when every canonical phase is authored', () => {
		const body = [
			phaseBlock('context', 'Context body.'),
			phaseBlock('problem', 'Problem body.'),
			phaseBlock('discover', 'Discover body.'),
			phaseBlock('reveal', 'Reveal body.'),
			phaseBlock('practice', 'Practice body.'),
			phaseBlock('connect', 'Connect body.'),
			phaseBlock('verify', 'Verify body.'),
		].join('\n\n');
		const result = splitContentPhases(body);
		expect(result.context).toBe('Context body.');
		expect(result.problem).toBe('Problem body.');
		expect(result.discover).toBe('Discover body.');
		expect(result.reveal).toBe('Reveal body.');
		expect(result.practice).toBe('Practice body.');
		expect(result.connect).toBe('Connect body.');
		expect(result.verify).toBe('Verify body.');
	});

	it('returns null for missing phases when only a subset is authored', () => {
		const body = [phaseBlock('context', 'Just context.'), phaseBlock('reveal', 'Just reveal.')].join('\n\n');
		const result = splitContentPhases(body);
		expect(result.context).toBe('Just context.');
		expect(result.reveal).toBe('Just reveal.');
		expect(result.problem).toBeNull();
		expect(result.discover).toBeNull();
		expect(result.practice).toBeNull();
		expect(result.connect).toBeNull();
		expect(result.verify).toBeNull();
	});

	it('preserves prose, lists, code fences, and nested :::cards directives inside a phase body', () => {
		const body = phaseBlock(
			'practice',
			[
				'Intro paragraph.',
				'',
				'- list item one',
				'- list item two',
				'',
				'```typescript',
				'const x = 1;',
				'```',
				'',
				':::cards',
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				':::',
			].join('\n'),
		);
		const result = splitContentPhases(body);
		expect(result.practice).toContain('Intro paragraph.');
		expect(result.practice).toContain('- list item one');
		expect(result.practice).toContain('```typescript');
		expect(result.practice).toContain(':::cards');
		expect(result.practice).toContain('- front: "q?"');
	});

	it('downgrades duplicate phase names with last-write-wins (runtime is forgiving)', () => {
		const body = [phaseBlock('context', 'First context.'), phaseBlock('context', 'Second context.')].join('\n\n');
		const result = splitContentPhases(body);
		expect(result.context).toBe('Second context.');
	});

	it('drops non-canonical phase names', () => {
		const body = [phaseBlock('context', 'Real phase.'), ':::phase name="bogus"\nSome body.\n:::'].join('\n\n');
		const result = splitContentPhases(body);
		expect(result.context).toBe('Real phase.');
		// `bogus` is not a canonical phase, so it is not surfaced as a
		// bucket (the build-time validator rejects this; the runtime
		// splitter is defensive).
		expect(Object.keys(result)).toEqual(['context', 'problem', 'discover', 'reveal', 'practice', 'connect', 'verify']);
	});

	it('returns null for a phase with empty body', () => {
		const body = ':::phase name="context"\n\n:::';
		const result = splitContentPhases(body);
		expect(result.context).toBeNull();
	});

	it('does NOT split on legacy `## Context` H2 headings (post-migration shape only)', () => {
		// The migration script wraps every canonical H2 phase heading into
		// a `:::phase` directive. A residual H2 phase heading means the
		// migration did not run; the lint script flags this. The splitter
		// itself is strict: only `:::phase` produces a bucket.
		const body = '## Context\n\nLegacy body.\n\n## Reveal\n\nLegacy reveal.';
		const result = splitContentPhases(body);
		expect(result.context).toBeNull();
		expect(result.reveal).toBeNull();
	});
});

describe('lifecycleFromContent', () => {
	it('returns SKELETON when no phase directives are present', () => {
		expect(lifecycleFromContent('Just prose.')).toBe(NODE_LIFECYCLES.SKELETON);
	});

	it('returns STARTED when some but not all canonical phases are present', () => {
		const body = [phaseBlock('context', 'Context.'), phaseBlock('reveal', 'Reveal.')].join('\n\n');
		expect(lifecycleFromContent(body)).toBe(NODE_LIFECYCLES.STARTED);
	});

	it('returns COMPLETE when every canonical phase directive is present', () => {
		const body = [
			phaseBlock('context', 'c.'),
			phaseBlock('problem', 'p.'),
			phaseBlock('discover', 'd.'),
			phaseBlock('reveal', 'r.'),
			phaseBlock('practice', 'pr.'),
			phaseBlock('connect', 'co.'),
			phaseBlock('verify', 'v.'),
		].join('\n\n');
		expect(lifecycleFromContent(body)).toBe(NODE_LIFECYCLES.COMPLETE);
	});

	it('counts each unique phase once -- duplicates do not inflate the count to COMPLETE', () => {
		const body = [phaseBlock('context', 'first'), phaseBlock('context', 'second'), phaseBlock('problem', 'p.')].join(
			'\n\n',
		);
		expect(lifecycleFromContent(body)).toBe(NODE_LIFECYCLES.STARTED);
	});

	it('ignores non-canonical phase names', () => {
		const body = [phaseBlock('context', 'c.'), ':::phase name="bogus"\nx.\n:::'].join('\n\n');
		expect(lifecycleFromContent(body)).toBe(NODE_LIFECYCLES.STARTED);
	});
});

describe('splitContentPhases on migrated corpus content (card-count parity smoke)', () => {
	/**
	 * Card-count parity guard: the Phase 1 `:::cards` directive sits inside
	 * what Phase 2 wraps as `:::phase name="practice"`. A regression where
	 * the splitter silently eats the practice phase would drop every card
	 * row attached to that node. This test loads a real migrated node
	 * end-to-end and asserts the practice bucket contains the `:::cards`
	 * directive (the seed parses cards out of that bucket; if the directive
	 * survives the split, seed parity is structural).
	 */
	const readingMetarsPath = resolve(
		import.meta.dirname,
		'..',
		'..',
		'..',
		'..',
		'course',
		'knowledge',
		'weather',
		'reading-metars',
		'node.md',
	);

	function loadBody(absPath: string): string {
		const raw = readFileSync(absPath, 'utf8');
		// Strip the leading YAML frontmatter the same way the build pipeline does.
		const FRONTMATTER_DELIM = '---';
		if (!raw.startsWith(`${FRONTMATTER_DELIM}\n`)) return raw;
		const end = raw.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length + 1);
		if (end === -1) return raw;
		return raw.slice(end + `\n${FRONTMATTER_DELIM}`.length).replace(/^\r?\n/, '');
	}

	it('keeps the :::cards directive inside the practice bucket for reading-metars', () => {
		const body = loadBody(readingMetarsPath);
		const buckets = splitContentPhases(body);
		expect(buckets.practice).not.toBeNull();
		// The migration places every phase body inside `:::phase`; the cards
		// directive must survive intact inside the practice slice.
		expect(buckets.practice).toContain(':::cards');
		// At least one authored card front line (`- front: "..."`) is present
		// inside the practice bucket -- structural seed parity.
		expect(buckets.practice).toMatch(/- front:/);
		// Sanity: every canonical phase is present after migration.
		expect(buckets.context).not.toBeNull();
		expect(buckets.problem).not.toBeNull();
		expect(buckets.discover).not.toBeNull();
		expect(buckets.reveal).not.toBeNull();
		expect(buckets.connect).not.toBeNull();
		expect(buckets.verify).not.toBeNull();
	});

	it('reports COMPLETE lifecycle for a migrated knowledge node', () => {
		const body = loadBody(readingMetarsPath);
		expect(lifecycleFromContent(body)).toBe(NODE_LIFECYCLES.COMPLETE);
	});
});
