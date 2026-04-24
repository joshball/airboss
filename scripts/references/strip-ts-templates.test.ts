/**
 * Tests the TS template-literal blanker used by the wiki-link scanner.
 *
 * Each case feeds source through `stripTsTemplateLiterals` and then
 * `extractWikilinks`, asserting on the set of ids that survive. This
 * mirrors how the scanner composes the two layers in production.
 */

import { extractWikilinks } from '@ab/aviation';
import { describe, expect, it } from 'vitest';
import { stripTsTemplateLiterals } from './strip-ts-templates';

// Built via concatenation so the test source itself doesn't contain a
// real `${...}` template placeholder (which would trip biome's
// noTemplateCurlyInString rule).
const DOLLAR_OPEN = `$${'{'}`;
const BRACE_CLOSE = '}';

function ids(source: string): string[] {
	const stripped = stripTsTemplateLiterals(source);
	return extractWikilinks(stripped)
		.wikilinks.map((w) => w.id)
		.filter((id): id is string => id !== null);
}

describe('stripTsTemplateLiterals', () => {
	it('blanks a single-line template literal with no interpolation', () => {
		const source = 'const x = `See [[VFR::cfr-14-91-155]] here.`;';
		expect(ids(source)).toEqual([]);
	});

	it('blanks a template literal that spans multiple lines', () => {
		const source = ['const body = `', '## Heading', '', 'See [[VFR::cfr-14-91-155]] for minimums.', '`;'].join('\n');
		expect(ids(source)).toEqual([]);
	});

	it('blanks a template literal that contains an interpolation', () => {
		const source = `const x = \`before ${DOLLAR_OPEN}expr${BRACE_CLOSE} [[IN::id-1]] after\`;`;
		expect(ids(source)).toEqual([]);
	});

	it('blanks nested backticks inside an interpolation expression', () => {
		// Without the fix the markdown inline-code skip closes on the
		// inner opening backtick, leaking `[[A::a]]` as a phantom match
		// and dropping the outer `[[B::b]]` into skipped-text mode.
		const source = `const x = \`outer ${DOLLAR_OPEN}\`inner [[A::a]]\`${BRACE_CLOSE} tail [[B::b]]\`;`;
		// Baseline: handing the raw source straight to the parser is wrong
		// and produces the phantom match. This assertion pins the bug in
		// place so that if the upstream parser is ever hardened to handle
		// TS backticks natively we notice and can simplify the scanner.
		const rawIds = extractWikilinks(source)
			.wikilinks.map((w) => w.id)
			.filter((id): id is string => id !== null);
		expect(rawIds).toContain('a');
		// With the fix, both ids are blanked.
		expect(ids(source)).toEqual([]);
	});

	it('leaves single-quoted string literals alone so they can still be scanned', () => {
		const source = [
			'// [[InComment::com-1]] lives in a comment',
			'const tmpl = `tmpl [[InTmpl::tmpl-1]]`;',
			"const str = '[[InStr::str-1]]';",
		].join('\n');
		// Comments and single-quoted strings survive; template content is
		// blanked.
		expect(ids(source).sort()).toEqual(['com-1', 'str-1'].sort());
	});

	it('preserves source length so parser error offsets stay meaningful', () => {
		const source = 'const x = `body [[A::a]] tail`;';
		const stripped = stripTsTemplateLiterals(source);
		expect(stripped.length).toBe(source.length);
		// Newlines survive, so line numbers do too.
		const multi = 'const x = `\nbody [[A::a]]\ntail`;';
		const strippedMulti = stripTsTemplateLiterals(multi);
		expect(strippedMulti.length).toBe(multi.length);
		expect(strippedMulti.split('\n').length).toBe(multi.split('\n').length);
	});

	it('handles escaped backticks inside a template literal', () => {
		const source = 'const x = `escaped \\` not a close [[E::e]]`;';
		expect(ids(source)).toEqual([]);
	});

	it('leaves ordinary markdown-in-a-comment alone', () => {
		// The stripper only acts on template literals; comments pass through
		// verbatim and the downstream parser treats them like any prose.
		const source = '/**\n * See [[DocRef::doc-1]] for details.\n */';
		expect(ids(source)).toEqual(['doc-1']);
	});
});
