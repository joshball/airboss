/**
 * KnowledgeNodeBody contract -- pins the 7-phase scaffolding the renderer
 * displays for both authored and unauthored phases. Extracted in Phase 2 of
 * the course-reader-and-editor WP so the step reader can render the same
 * shape as `/reference/knowledge/[slug]`.
 *
 * Runs under happy-dom via the `unit-dom` vitest project.
 */

import { KNOWLEDGE_PHASE_LABELS, KNOWLEDGE_PHASE_ORDER } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import KnowledgeNodeBody, { type NodeBodyPhase } from './KnowledgeNodeBody.svelte';

afterEach(() => {
	cleanup();
});

function authoredFixture(): NodeBodyPhase[] {
	return KNOWLEDGE_PHASE_ORDER.map((phase) => ({
		phase,
		body: `## ${phase} body\n\nA paragraph about ${phase}.`,
	}));
}

function emptyFixture(): NodeBodyPhase[] {
	return KNOWLEDGE_PHASE_ORDER.map((phase) => ({ phase, body: null }));
}

describe('KnowledgeNodeBody', () => {
	it('renders one heading per phase using the canonical labels', () => {
		render(KnowledgeNodeBody, { props: { phases: authoredFixture() } });
		for (const phase of KNOWLEDGE_PHASE_ORDER) {
			const label = KNOWLEDGE_PHASE_LABELS[phase];
			expect(screen.getByRole('heading', { level: 3, name: label })).toBeInTheDocument();
		}
	});

	it('renders authored markdown body for non-empty phases', () => {
		render(KnowledgeNodeBody, { props: { phases: authoredFixture() } });
		// `renderMarkdown` produces a `<p>` for each paragraph; the phrase appears
		// once per phase. Use a generic match against any phase to avoid pinning
		// the marked-internals output shape.
		const firstPhase = KNOWLEDGE_PHASE_ORDER[0];
		if (!firstPhase) throw new Error('test setup: empty phase order');
		expect(screen.getByText(`A paragraph about ${firstPhase}.`)).toBeInTheDocument();
	});

	it('renders the "Not yet authored." placeholder when a phase body is null', () => {
		render(KnowledgeNodeBody, { props: { phases: emptyFixture() } });
		const placeholders = screen.getAllByText('Not yet authored.');
		expect(placeholders).toHaveLength(KNOWLEDGE_PHASE_ORDER.length);
	});

	it('exposes the "Content phases" aria-label by default', () => {
		render(KnowledgeNodeBody, { props: { phases: emptyFixture() } });
		expect(screen.getByRole('region', { name: 'Content phases' })).toBeInTheDocument();
	});

	it('honours the ariaLabel prop override', () => {
		render(KnowledgeNodeBody, {
			props: { phases: emptyFixture(), ariaLabel: 'Step content' },
		});
		expect(screen.getByRole('region', { name: 'Step content' })).toBeInTheDocument();
	});
});
