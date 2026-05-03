/**
 * Smoke tests for `<RenderedSection>`. Locks in the props contract so
 * follow-on rendering WPs can swap the implementation without breaking
 * flightbag consumers.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import RenderedSection from '../src/RenderedSection.svelte';

afterEach(() => {
	cleanup();
});

describe('<RenderedSection>', () => {
	it('renders the title in a heading', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'Lift opposes weight; thrust opposes drag.',
		});
		expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Forces in Flight');
	});

	it('renders the body when present', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'Lift opposes weight; thrust opposes drag.',
		});
		expect(screen.getByTestId('rendered-section').textContent).toContain('Lift opposes weight');
	});

	it('shows the empty placeholder when body is empty', () => {
		render(RenderedSection, {
			title: 'Empty Section',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: '',
		});
		const placeholder = screen.queryByTestId('rendered-section-empty');
		expect(placeholder).not.toBeNull();
		expect(placeholder?.textContent ?? '').toMatch(/no body content/i);
	});

	it('exposes the citable identifier on the root element', () => {
		render(RenderedSection, {
			title: 'Forces in Flight',
			id: 'airboss-ref:handbooks/phak/8083-25C/2/3',
			body: 'body',
		});
		expect(screen.getByTestId('rendered-section').getAttribute('data-ref-id')).toBe(
			'airboss-ref:handbooks/phak/8083-25C/2/3',
		);
	});

	it('strips a leading YAML frontmatter block before rendering', () => {
		const body = ['---', 'handbook: ifh', 'edition: FAA-H-8083-15B', '---', '', 'Body paragraph.'].join('\n');
		render(RenderedSection, {
			title: 'Introduction',
			id: 'airboss-ref:handbooks/ifh/8083-15B/1/1',
			body,
		});
		const root = screen.getByTestId('rendered-section');
		expect(root.textContent ?? '').not.toContain('handbook: ifh');
		expect(root.textContent ?? '').not.toContain('edition:');
		expect(root.textContent ?? '').toContain('Body paragraph.');
	});

	it('falls through to the empty placeholder when only frontmatter is present', () => {
		const body = ['---', 'handbook: ifh', 'edition: FAA-H-8083-15B', '---', ''].join('\n');
		render(RenderedSection, {
			title: 'Introduction',
			id: 'airboss-ref:handbooks/ifh/8083-15B/1/1',
			body,
		});
		expect(screen.queryByTestId('rendered-section-empty')).not.toBeNull();
	});

	it('drops a body H1 that duplicates the section title', () => {
		render(RenderedSection, {
			title: 'Communication Equipment',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/2',
			body: '# Communication Equipment\n\nFirst paragraph.',
		});
		const titleHeadings = screen.getAllByRole('heading', { level: 1 });
		// Only the page title H1 should remain.
		expect(titleHeadings).toHaveLength(1);
		expect(titleHeadings[0]?.textContent).toBe('Communication Equipment');
	});

	it('renders a Metadata disclosure when the body has frontmatter', () => {
		const body = [
			'---',
			'handbook: ifh',
			'edition: FAA-H-8083-15B',
			'faa_pages: 14-3',
			'source_url: https://www.faa.gov/sites/file.pdf',
			'---',
			'',
			'Body paragraph.',
		].join('\n');
		render(RenderedSection, {
			title: 'Liftoff',
			id: 'airboss-ref:handbooks/ifh/8083-15B/14/9',
			body,
		});
		const panel = screen.queryByTestId('rendered-section-metadata');
		expect(panel).not.toBeNull();
		// Collapsed by default -- the `<details>` element does not have the `open` attribute set.
		expect((panel as HTMLDetailsElement).open).toBe(false);
		// The summary reads "Metadata".
		expect(panel?.querySelector('summary')?.textContent ?? '').toMatch(/metadata/i);
		// All keys appear in humanised form, with at least one URL rendered as a link.
		const text = panel?.textContent ?? '';
		expect(text).toContain('Handbook');
		expect(text).toContain('Edition');
		expect(text).toContain('Faa Pages');
		expect(text).toContain('Source Url');
		const link = panel?.querySelector('dd a');
		expect(link?.getAttribute('href')).toBe('https://www.faa.gov/sites/file.pdf');
	});

	it('does not render the Metadata disclosure when the body has no frontmatter', () => {
		render(RenderedSection, {
			title: 'Plain Section',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/2',
			body: 'No frontmatter, just plain body text.',
		});
		expect(screen.queryByTestId('rendered-section-metadata')).toBeNull();
	});

	it('does not render the Metadata disclosure when frontmatter parsing yields no entries (silent fallback)', () => {
		const body = ['---', 'no colons no entries', '---', '', 'Body.'].join('\n');
		render(RenderedSection, {
			title: 'Section',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/2',
			body,
		});
		expect(screen.queryByTestId('rendered-section-metadata')).toBeNull();
		// Body still renders even though frontmatter was malformed.
		expect(screen.getByTestId('rendered-section').textContent ?? '').toContain('Body.');
	});

	it('preserves operator-authored key order in the Metadata disclosure', () => {
		const body = ['---', 'zeta: 1', 'alpha: 2', 'mu: 3', '---', '', 'Body.'].join('\n');
		render(RenderedSection, {
			title: 'Section',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/2',
			body,
		});
		const panel = screen.queryByTestId('rendered-section-metadata');
		expect(panel).not.toBeNull();
		const dts = Array.from(panel?.querySelectorAll('dt') ?? []).map((el) => el.textContent ?? '');
		expect(dts).toEqual(['Zeta', 'Alpha', 'Mu']);
	});

	it('keeps the metadata disclosure visible even when the body collapses to empty', () => {
		const body = ['---', 'handbook: ifh', '---', ''].join('\n');
		render(RenderedSection, {
			title: 'Container Section',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/2',
			body,
		});
		expect(screen.queryByTestId('rendered-section-metadata')).not.toBeNull();
		expect(screen.queryByTestId('rendered-section-empty')).not.toBeNull();
	});

	it('injects a figure inline when the body references "Figure X-Y"', () => {
		render(RenderedSection, {
			title: 'Phonetic Alphabet',
			id: 'airboss-ref:handbooks/ifh/8083-15B/2/5',
			body: 'See Figure 2-5 below.\n\nNext paragraph.',
			figures: [
				{
					id: 'fig_1',
					ordinal: 1,
					caption: 'Figure 2-5. Phonetic pronunciation guide.',
					assetPath: 'handbooks/ifh/FAA-H-8083-15B/figures/figure-2-5.png',
					width: null,
					height: null,
				},
			],
		});
		const root = screen.getByTestId('rendered-section');
		const img = root.querySelector('img');
		expect(img).not.toBeNull();
		expect(img?.getAttribute('src') ?? '').toContain('handbook-asset/ifh/');
	});
});
