import { describe, expect, test } from 'vitest';
import { extractImageUrls, normalizeHandbookAssetPath, renderMarkdown } from './markdown';

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
