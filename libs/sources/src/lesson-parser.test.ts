import { describe, expect, test } from 'vitest';
import { parseLesson, stripMarkdown } from './lesson-parser.ts';

const FILE = 'fixture.md';

describe('parseLesson -- frontmatter acks (ADR 019 §3.4)', () => {
	test('L-01: valid acks parse cleanly with no findings', () => {
		const source = `---
title: Mangiamele review
acknowledgments:
  - id: mangiamele-cost-sharing
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    superseder: airboss-ref:interp/chief-counsel/smith-2027
    reason: original-intact
    historical: false
    note: "Smith narrows but does not overturn the cost-sharing analysis."
---

The [Mangiamele letter (2009)][mangiamele-cost-sharing] established the limit.

[mangiamele-cost-sharing]: airboss-ref:interp/chief-counsel/mangiamele-2009
`;
		const result = parseLesson(FILE, source);
		expect(result.acknowledgments).toHaveLength(1);
		expect(result.acknowledgments[0].id).toBe('mangiamele-cost-sharing');
		expect(result.acknowledgments[0].target).toBe('airboss-ref:interp/chief-counsel/mangiamele-2009');
		expect(result.acknowledgments[0].historical).toBe(false);
		expect(result.findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('L-02: malformed frontmatter YAML emits ERROR with file location', () => {
		const source = `---
title: bad
acknowledgments:
  - id: mangiamele
    target: airboss-ref:interp/x
  - this: [unclosed
---

body`;
		const result = parseLesson(FILE, source);
		const errors = result.findings.filter((f) => f.severity === 'error');
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].message).toMatch(/YAML/);
		expect(errors[0].location.file).toBe(FILE);
	});

	test('ack missing `target` is rejected', () => {
		const source = `---
acknowledgments:
  - id: bad
    reason: missing-target
---

body`;
		const result = parseLesson(FILE, source);
		expect(result.findings.find((f) => f.message.includes('target'))).toBeDefined();
	});

	test('historical defaults to false when not specified', () => {
		const source = `---
acknowledgments:
  - target: airboss-ref:interp/x
---

[a](airboss-ref:interp/x)
`;
		const result = parseLesson(FILE, source);
		expect(result.acknowledgments[0].historical).toBe(false);
	});
});

describe('parseLesson -- inline links', () => {
	test('L-03: inline link emits one occurrence with link text', () => {
		const source = `# Lesson

The rule is at [@cite](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0].raw).toBe('airboss-ref:regs/cfr-14/91/103?at=2026');
		expect(result.occurrences[0].linkText).toBe('@cite');
		expect(result.occurrences[0].isBare).toBe(false);
		expect(result.occurrences[0].referenceLabel).toBeNull();
	});

	test('inline link location reports correct line in file (frontmatter offset)', () => {
		const source = `---
title: x
---

# H

intro line

[@cite](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		// Frontmatter is 3 lines (`---`, `title: x`, `---`) so body starts at line 4.
		// Within body: blank, `# H`, blank, `intro line`, blank, link line.
		// Body line 6 -> file line 9.
		expect(result.occurrences[0].location.line).toBe(9);
	});
});

describe('parseLesson -- reference-style links', () => {
	test('L-04: reference-style link binds via label', () => {
		const source = `---
acknowledgments:
  - id: smith
    target: airboss-ref:interp/chief-counsel/smith-2027
---

The [Smith letter][smith] expanded.

[smith]: airboss-ref:interp/chief-counsel/smith-2027
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0].referenceLabel).toBe('smith');
		expect(result.occurrences[0].raw).toBe('airboss-ref:interp/chief-counsel/smith-2027');
		expect(result.findings.filter((f) => f.severity === 'error')).toHaveLength(0);
	});

	test('L-05: reference-style link with undefined label emits ERROR', () => {
		const source = `# Lesson

The [Smith letter][missing-label] is great.
`;
		const result = parseLesson(FILE, source);
		const errors = result.findings.filter((f) => f.severity === 'error');
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toMatch(/undefined reference label/);
		expect(errors[0].message).toMatch(/missing-label/);
	});
});

describe('parseLesson -- bare URL detection', () => {
	test('L-06: bare URL in prose emits a bare occurrence', () => {
		const source = `See airboss-ref:regs/cfr-14/91/103?at=2026 for the rule.
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0].isBare).toBe(true);
		expect(result.occurrences[0].linkText).toBeNull();
	});

	test('inline link does not duplicate as bare URL', () => {
		const source = `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0].isBare).toBe(false);
	});
});

describe('parseLesson -- code skipping', () => {
	test('L-07: identifier inside fenced code block is skipped', () => {
		const source = `Some prose.

\`\`\`text
airboss-ref:regs/cfr-14/91/103?at=2026
\`\`\`

More prose.
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(0);
	});

	test('L-08: identifier inside inline code is skipped', () => {
		const source = `Use \`airboss-ref:regs/cfr-14/91/103?at=2026\` as the syntax.
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(0);
	});

	test('inline link inside fenced code is also skipped', () => {
		const source = `\`\`\`md
[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)
\`\`\`
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(0);
	});
});

describe('parseLesson -- link text quirks', () => {
	test('L-09: empty inline link text [](url) is captured for the validator to flag row 7', () => {
		const source = `Empty: [](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.occurrences[0].linkText).toBe('');
		expect(result.occurrences[0].strippedText).toBe('');
	});

	test('L-10: emphasised text strips to non-empty', () => {
		const source = `Italic: [*foo*](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences[0].linkText).toBe('*foo*');
		expect(result.occurrences[0].strippedText).toBe('foo');
	});

	test('L-11: lazy link text echoing canonical short form is preserved verbatim', () => {
		const source = `Cite: [§91.103](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences[0].strippedText).toBe('§91.103');
	});
});

describe('parseLesson -- ack cross-checks', () => {
	test('L-12: orphan ack emits WARNING', () => {
		const source = `---
acknowledgments:
  - target: airboss-ref:interp/chief-counsel/walker-2017
    historical: false
    reason: original-intact
---

# No body references the target.

Some unrelated prose with [@cite](airboss-ref:regs/cfr-14/91/103?at=2026).
`;
		const result = parseLesson(FILE, source);
		const warnings = result.findings.filter((f) => f.severity === 'warning');
		expect(warnings.find((w) => w.message.includes('walker-2017'))).toBeDefined();
	});

	test('L-13: two acks same target without explicit reference labels => ERROR', () => {
		const source = `---
acknowledgments:
  - id: cost-sharing
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    historical: false
  - id: compensation
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    historical: false
---

The [Mangiamele letter](airboss-ref:interp/chief-counsel/mangiamele-2009) is great.

[cost-sharing]: airboss-ref:interp/chief-counsel/mangiamele-2009
[compensation]: airboss-ref:interp/chief-counsel/mangiamele-2009
`;
		const result = parseLesson(FILE, source);
		const errors = result.findings.filter((f) => f.severity === 'error');
		expect(errors.find((e) => e.message.includes('multiple acks'))).toBeDefined();
	});

	test('two acks same target WITH explicit reference labels => no §3.4 error', () => {
		const source = `---
acknowledgments:
  - id: cost-sharing
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    historical: false
  - id: compensation
    target: airboss-ref:interp/chief-counsel/mangiamele-2009
    historical: false
---

The [Mangiamele 1][cost-sharing] and [Mangiamele 2][compensation] cover both facets.

[cost-sharing]: airboss-ref:interp/chief-counsel/mangiamele-2009
[compensation]: airboss-ref:interp/chief-counsel/mangiamele-2009
`;
		const result = parseLesson(FILE, source);
		const errors = result.findings.filter((f) => f.severity === 'error' && f.message.includes('multiple acks'));
		expect(errors).toHaveLength(0);
	});
});

describe('parseLesson -- empty / no-airboss-ref content', () => {
	test('L-14: lesson with zero airboss-ref URLs returns no occurrences and no findings', () => {
		const source = `---
title: regular lesson
---

# Heading

Plain content with [an external link](https://www.faa.gov/) only.
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(0);
		expect(result.findings).toHaveLength(0);
	});

	test('lesson with no frontmatter parses', () => {
		const source = `# Heading

[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)
`;
		const result = parseLesson(FILE, source);
		expect(result.occurrences).toHaveLength(1);
		expect(result.acknowledgments).toHaveLength(0);
		// Body line 3 with no frontmatter -> file line 3.
		expect(result.occurrences[0].location.line).toBe(3);
	});
});

describe('stripMarkdown', () => {
	test('strips emphasis and trims', () => {
		expect(stripMarkdown('*foo*')).toBe('foo');
		expect(stripMarkdown('  __bar__  ')).toBe('bar');
		expect(stripMarkdown('`baz`')).toBe('baz');
		expect(stripMarkdown('***')).toBe('');
		expect(stripMarkdown('  ')).toBe('');
	});
});
