import { describe, expect, test } from 'vitest';
import {
	dedupeFirstHeading,
	extractHandbookTableLinks,
	extractImageUrls,
	findFigureReferences,
	injectFigureRefs,
	normalizeHandbookAssetPath,
	parseFrontmatter,
	renderMarkdown,
	sanitizeInlineHtml,
	stripFrontmatter,
} from './markdown';

describe('renderMarkdown -- block-level images', () => {
	test('renders a single-line image as a <figure>', () => {
		const html = renderMarkdown('![Alt text](/handbooks/phak/figures/foo.png)');
		expect(html).toContain('<figure class="md-figure">');
		expect(html).toContain('src="/handbook-asset/phak/figures/foo.png"');
		expect(html).toContain('alt="Alt text"');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('<figcaption>Alt text</figcaption>');
	});

	test('rewrites /handbooks/ URLs to /handbook-asset/', () => {
		const html = renderMarkdown('![X](/handbooks/avwx/foo.png)');
		expect(html).toContain('src="/handbook-asset/avwx/foo.png"');
		expect(html).not.toContain('src="/handbooks/');
	});

	test('passes other URLs through unchanged', () => {
		const html = renderMarkdown('![X](https://example.com/a.png)');
		expect(html).toContain('src="https://example.com/a.png"');
	});

	test('collapses an image whose alt text wraps across multiple lines', () => {
		const md =
			'![Figure 4-1. Vertical Structure of the Atmosphere\n4.4 The Standard Atmosphere\nrepresents an average](/handbooks/avwx/figures/fig-4-1.png)';
		const html = renderMarkdown(md);
		expect(html).toContain('<figure class="md-figure">');
		expect(html).toContain('src="/handbook-asset/avwx/figures/fig-4-1.png"');
		// Soft-wrapped newlines collapse to single spaces in the alt+caption.
		expect(html).toContain(
			'Figure 4-1. Vertical Structure of the Atmosphere 4.4 The Standard Atmosphere represents an average',
		);
	});

	test('escapes alt text', () => {
		const html = renderMarkdown('![<script>](/x.png)');
		expect(html).toContain('alt="&lt;script&gt;"');
		expect(html).not.toContain('<script>');
	});

	test('emits no figcaption when alt is empty', () => {
		const html = renderMarkdown('![](/x.png)');
		expect(html).toContain('<figure class="md-figure">');
		expect(html).not.toContain('<figcaption>');
	});

	test('does not double-render image syntax as a link', () => {
		const html = renderMarkdown('![Caption](/x.png)');
		// The link regex must not catch `[Caption](/x.png)` after the leading `!`.
		expect(html).not.toContain('!<a href');
		expect(html).not.toContain('<a href="/x.png">Caption</a>');
	});

	test('inline link still renders correctly when not preceded by `!`', () => {
		const html = renderMarkdown('see [the docs](https://example.com)');
		expect(html).toContain('<a href="https://example.com">the docs</a>');
	});
});

describe('extractImageUrls', () => {
	test('returns every image URL in document order', () => {
		const md = `![A](/handbooks/a.png)\n\nsome text\n\n![B](/handbooks/b.png)`;
		expect(extractImageUrls(md)).toEqual(['/handbooks/a.png', '/handbooks/b.png']);
	});

	test('returns empty array when there are no images', () => {
		expect(extractImageUrls('plain text\n[link](https://x)')).toEqual([]);
	});

	test('captures URLs across soft-wrapped alt text', () => {
		const md = '![Figure with\nwrapped alt](/handbooks/x.png)';
		expect(extractImageUrls(md)).toEqual(['/handbooks/x.png']);
	});
});

describe('normalizeHandbookAssetPath', () => {
	test('strips a leading /handbooks/ prefix', () => {
		expect(normalizeHandbookAssetPath('/handbooks/phak/figures/x.png')).toBe('phak/figures/x.png');
	});

	test('strips a leading handbooks/ prefix without leading slash', () => {
		expect(normalizeHandbookAssetPath('handbooks/phak/x.png')).toBe('phak/x.png');
	});

	test('strips a leading /handbook-asset/ prefix', () => {
		expect(normalizeHandbookAssetPath('/handbook-asset/phak/x.png')).toBe('phak/x.png');
	});

	test('strips a leading handbook-asset/ prefix without leading slash', () => {
		expect(normalizeHandbookAssetPath('handbook-asset/phak/x.png')).toBe('phak/x.png');
	});

	test('returns the same canonical form for both delivery paths', () => {
		const a = normalizeHandbookAssetPath('/handbooks/avwx/figures/foo.png');
		const b = normalizeHandbookAssetPath('handbooks/avwx/figures/foo.png');
		const c = normalizeHandbookAssetPath('/handbook-asset/avwx/figures/foo.png');
		expect(a).toBe(b);
		expect(a).toBe(c);
	});

	test('passes through an already-canonical path', () => {
		expect(normalizeHandbookAssetPath('phak/figures/x.png')).toBe('phak/figures/x.png');
	});
});

describe('stripFrontmatter', () => {
	test('strips a leading YAML frontmatter block', () => {
		const md = ['---', 'handbook: ifh', 'edition: FAA-H-8083-15B', '---', '', 'Body paragraph one.', ''].join('\n');
		expect(stripFrontmatter(md)).toBe('Body paragraph one.\n');
	});

	test('preserves CRLF inputs and strips frontmatter cleanly', () => {
		const md = ['---', 'handbook: ifh', '---', '', 'Body line.'].join('\r\n');
		expect(stripFrontmatter(md)).toBe('Body line.');
	});

	test('returns input unchanged when no frontmatter is present', () => {
		expect(stripFrontmatter('No frontmatter here.')).toBe('No frontmatter here.');
	});

	test('returns input unchanged when fence is unclosed', () => {
		const md = '---\nhandbook: ifh\nno closing fence';
		expect(stripFrontmatter(md)).toBe(md);
	});

	test('does not strip when input begins with `--- foo` (no newline after fence)', () => {
		expect(stripFrontmatter('--- foo bar')).toBe('--- foo bar');
	});

	test('returns empty string when only frontmatter is present', () => {
		const md = '---\nhandbook: ifh\n---\n';
		expect(stripFrontmatter(md)).toBe('');
	});

	test('strips frontmatter even when body starts with a heading', () => {
		const md = ['---', 'title: x', '---', '', '# Body Heading', '', 'Body text.'].join('\n');
		expect(stripFrontmatter(md)).toBe('# Body Heading\n\nBody text.');
	});
});

describe('parseFrontmatter', () => {
	test('parses key:value pairs and returns the body separately', () => {
		const md = [
			'---',
			'handbook: ifh',
			'edition: FAA-H-8083-15B',
			'faa_pages: 14-3',
			'---',
			'',
			'Body paragraph one.',
		].join('\n');
		const { entries, body } = parseFrontmatter(md);
		expect(entries).toEqual([
			{ key: 'handbook', value: 'ifh' },
			{ key: 'edition', value: 'FAA-H-8083-15B' },
			{ key: 'faa_pages', value: '14-3' },
		]);
		expect(body).toBe('Body paragraph one.');
	});

	test('preserves URL values that contain colons (split on first colon only)', () => {
		const md = ['---', 'source_url: https://www.faa.gov/path/to/file.pdf', '---', '', 'Body.'].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries).toEqual([{ key: 'source_url', value: 'https://www.faa.gov/path/to/file.pdf' }]);
	});

	test('strips matching surrounding double or single quotes from values', () => {
		const md = ['---', 'a: "quoted value"', "b: 'single'", 'c: bare', '---', ''].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries).toEqual([
			{ key: 'a', value: 'quoted value' },
			{ key: 'b', value: 'single' },
			{ key: 'c', value: 'bare' },
		]);
	});

	test('preserves source order of keys as authored', () => {
		const md = ['---', 'z: 1', 'a: 2', 'm: 3', '---', ''].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries.map((e) => e.key)).toEqual(['z', 'a', 'm']);
	});

	test('handles empty values', () => {
		const md = ['---', 'a:', 'b: ', '---', ''].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries).toEqual([
			{ key: 'a', value: '' },
			{ key: 'b', value: '' },
		]);
	});

	test('skips comment lines and blank lines inside the block', () => {
		const md = ['---', '# a comment', '', 'a: 1', '# another comment', 'b: 2', '---', ''].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries).toEqual([
			{ key: 'a', value: '1' },
			{ key: 'b', value: '2' },
		]);
	});

	test('returns empty entries when no frontmatter is present', () => {
		const { entries, body } = parseFrontmatter('No frontmatter here.');
		expect(entries).toEqual([]);
		expect(body).toBe('No frontmatter here.');
	});

	test('returns empty entries when the fence is unclosed', () => {
		const md = '---\nhandbook: ifh\nno closing fence';
		const { entries, body } = parseFrontmatter(md);
		expect(entries).toEqual([]);
		expect(body).toBe(md);
	});

	test('returns empty entries when nothing in the block parses (silent fallback)', () => {
		const md = ['---', 'no colons here at all', 'still no colons', '---', '', 'Body.'].join('\n');
		const { entries, body } = parseFrontmatter(md);
		expect(entries).toEqual([]);
		// Body is still stripped since the fence parsed; the panel will simply
		// not render because entries is empty.
		expect(body).toBe('Body.');
	});

	test('last value wins for duplicate keys, but original ordinal is preserved', () => {
		const md = ['---', 'a: 1', 'b: 2', 'a: 3', '---', ''].join('\n');
		const { entries } = parseFrontmatter(md);
		expect(entries).toEqual([
			{ key: 'a', value: '3' },
			{ key: 'b', value: '2' },
		]);
	});
});

describe('dedupeFirstHeading', () => {
	test('drops a leading H1 that matches the title', () => {
		const md = '# Communication Equipment\n\nFirst paragraph.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe('First paragraph.');
	});

	test('matches case-insensitively', () => {
		const md = '# communication EQUIPMENT\n\nBody.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe('Body.');
	});

	test('matches across whitespace differences', () => {
		const md = '#  Communication   Equipment\n\nBody.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe('Body.');
	});

	test('preserves an unrelated leading H1', () => {
		const md = '# Different Title\n\nBody.';
		expect(dedupeFirstHeading(md, 'Section Title')).toBe(md);
	});

	test('preserves H2 headings', () => {
		const md = '## Communication Equipment\n\nBody.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe(md);
	});

	test('preserves subsequent H1 headings (only the first is dropped)', () => {
		const md = '# Communication Equipment\n\nIntro.\n\n# Another H1\n\nMore body.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe('Intro.\n\n# Another H1\n\nMore body.');
	});

	test('handles leading blank lines before the heading', () => {
		const md = '\n\n# Communication Equipment\n\nBody.';
		expect(dedupeFirstHeading(md, 'Communication Equipment')).toBe('Body.');
	});

	test('returns input unchanged when body is empty', () => {
		expect(dedupeFirstHeading('', 'Anything')).toBe('');
	});

	test('returns input unchanged when first non-blank line is not a heading', () => {
		const md = 'Plain paragraph.\n\n# Heading later.';
		expect(dedupeFirstHeading(md, 'Plain paragraph')).toBe(md);
	});
});

describe('findFigureReferences', () => {
	test('captures a single figure reference', () => {
		expect(findFigureReferences('See Figure 2-5 below.')).toEqual(['2-5']);
	});

	test('captures multiple distinct figure references in order', () => {
		expect(findFigureReferences('See Figure 2-5 and Figure 2-7 below.')).toEqual(['2-5', '2-7']);
	});

	test('dedupes repeated references', () => {
		expect(findFigureReferences('Figure 2-5 ... Figure 2-5 again.')).toEqual(['2-5']);
	});

	test('handles trailing punctuation and word boundaries', () => {
		expect(findFigureReferences('Figure 2-5. Phonetic guide.')).toEqual(['2-5']);
	});

	test('handles single-number figures (no chapter prefix)', () => {
		expect(findFigureReferences('Per Figure 12 above.')).toEqual(['12']);
	});

	test('returns an empty array when no references are present', () => {
		expect(findFigureReferences('Plain text with no figures.')).toEqual([]);
	});
});

describe('injectFigureRefs', () => {
	test('injects a figure block after the paragraph that first references it', () => {
		const figures = new Map([
			[
				'2-5',
				{ caption: 'Figure 2-5. Phonetic pronunciation guide.', assetPath: 'handbooks/ifh/figures/figure-2-5.png' },
			],
		]);
		const body = 'See Figure 2-5 below.\n\nNext paragraph.';
		const { body: out, injected } = injectFigureRefs(body, figures);
		expect(out).toContain('![Figure 2-5. Phonetic pronunciation guide.](/handbooks/ifh/figures/figure-2-5.png)');
		expect(injected.has('2-5')).toBe(true);
		// Image block sits between the two paragraphs.
		const idxRef = out.indexOf('See Figure 2-5');
		const idxImg = out.indexOf('![');
		const idxNext = out.indexOf('Next paragraph');
		expect(idxRef).toBeLessThan(idxImg);
		expect(idxImg).toBeLessThan(idxNext);
	});

	test('injects each figure only once even when referenced repeatedly', () => {
		const figures = new Map([['2-5', { caption: 'cap', assetPath: 'handbooks/x/2-5.png' }]]);
		const body = 'Figure 2-5 here.\n\nMore Figure 2-5 here.';
		const { body: out, injected } = injectFigureRefs(body, figures);
		const occurrences = out.split('![cap](').length - 1;
		expect(occurrences).toBe(1);
		expect(injected.size).toBe(1);
	});

	test('skips figures the body does not mention', () => {
		const figures = new Map([
			['2-5', { caption: 'a', assetPath: 'handbooks/x/2-5.png' }],
			['2-9', { caption: 'b', assetPath: 'handbooks/x/2-9.png' }],
		]);
		const body = 'Only Figure 2-5 is referenced.';
		const { injected } = injectFigureRefs(body, figures);
		expect(injected.has('2-5')).toBe(true);
		expect(injected.has('2-9')).toBe(false);
	});

	test('returns input unchanged when the figures map is empty', () => {
		const body = 'Figure 2-5 here.';
		const { body: out, injected } = injectFigureRefs(body, new Map());
		expect(out).toBe(body);
		expect(injected.size).toBe(0);
	});

	test('preserves an asset path that already starts with a slash', () => {
		const figures = new Map([['1-1', { caption: 'cap', assetPath: '/handbooks/x/figures/fig-1-1.png' }]]);
		const body = 'Figure 1-1 there.';
		const { body: out } = injectFigureRefs(body, figures);
		expect(out).toContain('![cap](/handbooks/x/figures/fig-1-1.png)');
		// No double slash.
		expect(out).not.toContain('//handbooks');
	});
});

describe('sanitizeInlineHtml', () => {
	test('passes a handbook-table wrapper through unchanged-modulo-allowlist', () => {
		const html = '<div class="handbook-table"><table><thead><tr><th>A</th></tr></thead></table></div>';
		const out = sanitizeInlineHtml(html);
		expect(out).toContain('<div class="handbook-table">');
		expect(out).toContain('<table>');
		expect(out).toContain('<thead>');
		expect(out).toContain('<tr>');
		expect(out).toContain('<th>A</th>');
	});

	test('strips a <script> tag wholesale', () => {
		const html = '<table><tr><td><script>alert(1)</script>safe</td></tr></table>';
		const out = sanitizeInlineHtml(html);
		expect(out).not.toContain('<script>');
		expect(out).not.toContain('alert(1)');
		expect(out).toContain('safe');
	});

	test('strips <iframe> and inline event handlers', () => {
		const html = '<table onclick="x()"><tr><td><iframe src="x"></iframe>cell</td></tr></table>';
		const out = sanitizeInlineHtml(html);
		expect(out).not.toContain('onclick');
		expect(out).not.toContain('<iframe');
		expect(out).toContain('<table>');
		expect(out).toContain('cell');
	});

	test('strips a generic <span> while preserving allowed siblings', () => {
		const html = '<td><span class="bad">x</span>y</td>';
		const out = sanitizeInlineHtml(html);
		expect(out).not.toContain('<span');
		expect(out).toContain('<td>');
		expect(out).toContain('y');
	});

	test('rewrites the wrapper data-source from /handbooks/ to /handbook-asset/', () => {
		const html = '<div class="handbook-table" data-source="/handbooks/avwx/x/tbl.html"><table></table></div>';
		const out = sanitizeInlineHtml(html);
		expect(out).toContain('data-source="/handbook-asset/avwx/x/tbl.html"');
		expect(out).not.toContain('data-source="/handbooks/');
	});

	test('drops HTML comments', () => {
		const html = '<table><!-- secret --><tr><td>x</td></tr></table>';
		const out = sanitizeInlineHtml(html);
		expect(out).not.toContain('<!--');
		expect(out).not.toContain('secret');
		expect(out).toContain('<td>x</td>');
	});

	test('preserves colspan and rowspan on <th> and <td>', () => {
		const html = '<tr><th colspan="2">A</th><td rowspan="3">B</td></tr>';
		const out = sanitizeInlineHtml(html);
		expect(out).toContain('colspan="2"');
		expect(out).toContain('rowspan="3"');
	});

	test('drops disallowed attributes on allowed tags', () => {
		const html = '<th id="bad" colspan="2">A</th>';
		const out = sanitizeInlineHtml(html);
		expect(out).not.toContain('id=');
		expect(out).toContain('colspan="2"');
	});

	test('escapes text outside tags', () => {
		const html = 'before <table></table> & after <';
		const out = sanitizeInlineHtml(html);
		expect(out).toContain('before ');
		expect(out).toContain('<table>');
		expect(out).toContain('&amp; after &lt;');
	});
});

describe('extractHandbookTableLinks', () => {
	test('returns the data-source path for one wrapper', () => {
		const md = [
			'<div class="handbook-table" data-source="/handbooks/avwx/x/tbl-4-1.html">',
			'<table><caption>Table 4-1. Composition</caption></table>',
			'</div>',
		].join('\n');
		const links = extractHandbookTableLinks(md);
		expect(links).toHaveLength(1);
		expect(links[0]?.assetPath).toBe('/handbooks/avwx/x/tbl-4-1.html');
		expect(links[0]?.caption).toContain('Table 4-1');
	});

	test('returns multiple wrappers in source order', () => {
		const md = [
			'<div class="handbook-table" data-source="/h/a.html"><table></table></div>',
			'',
			'<div class="handbook-table" data-source="/h/b.html"><table></table></div>',
		].join('\n');
		const links = extractHandbookTableLinks(md);
		expect(links.map((l) => l.assetPath)).toEqual(['/h/a.html', '/h/b.html']);
	});

	test('returns empty array when no wrapper is present', () => {
		expect(extractHandbookTableLinks('plain markdown\n\nno tables.')).toEqual([]);
	});

	test('handles caption with whitespace and newlines', () => {
		const md = [
			'<div class="handbook-table" data-source="/h/a.html">',
			'<table><caption>Table 4-1.    Approximations of the',
			"Composition of a Dry Earth's Atmosphere</caption></table>",
			'</div>',
		].join('\n');
		const links = extractHandbookTableLinks(md);
		expect(links).toHaveLength(1);
		const cap = links[0]?.caption ?? '';
		expect(cap).toContain('Table 4-1.');
		expect(cap).toContain('Approximations');
		// Whitespace collapsed to single spaces.
		expect(cap).not.toContain('\n');
	});
});

describe('renderMarkdown -- block-level HTML (handbook tables)', () => {
	test('passes through a single-line wrapped table', () => {
		const md =
			'<div class="handbook-table" data-source="/handbooks/avwx/x/t.html"><table><tr><td>A</td></tr></table></div>';
		const html = renderMarkdown(md);
		expect(html).toContain('<div class="handbook-table"');
		expect(html).toContain('<table>');
		expect(html).toContain('<td>A</td>');
		// Asset path rewritten so the "open original" link lands on the streamer.
		expect(html).toContain('data-source="/handbook-asset/avwx/x/t.html"');
	});

	test('passes through a multi-line wrapped table with multi-line caption', () => {
		const md = [
			'Some preceding paragraph.',
			'',
			'<div class="handbook-table" data-source="/handbooks/avwx/x/t.html">',
			'<table><caption>Table 4-1.',
			'Composition</caption><tbody><tr><td>A</td></tr></tbody></table>',
			'</div>',
			'',
			'Trailing paragraph.',
		].join('\n');
		const html = renderMarkdown(md);
		expect(html).toContain('<div class="handbook-table"');
		expect(html).toContain('<caption>');
		expect(html).toContain('<tbody>');
		expect(html).toContain('<td>A</td>');
		expect(html).toContain('<p>Some preceding paragraph.</p>');
		expect(html).toContain('<p>Trailing paragraph.</p>');
	});

	test('strips a <script> tag inside an inline HTML block', () => {
		const md = '<table><tr><td><script>bad()</script>good</td></tr></table>';
		const html = renderMarkdown(md);
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('bad()');
		expect(html).toContain('<td>');
		expect(html).toContain('good');
	});

	test('falls back to escaped paragraph when block is unclosed', () => {
		const md = '<div class="handbook-table">\nno close';
		const html = renderMarkdown(md);
		// No closing </div> -> the html-block path bails; the line(s) flow into
		// the paragraph parser, which html-escapes the leading `<`.
		expect(html).toContain('&lt;div');
		expect(html).not.toContain('<div class="handbook-table">');
	});

	test('injects an "Open original" link inside every wrapper', () => {
		const md =
			'<div class="handbook-table" data-source="/handbooks/avwx/x/t.html"><table><tr><td>A</td></tr></table></div>';
		const html = renderMarkdown(md);
		expect(html).toContain('class="handbook-table-source"');
		expect(html).toContain('href="/handbook-asset/avwx/x/t.html"');
		expect(html).toContain('Open original table');
	});
});
