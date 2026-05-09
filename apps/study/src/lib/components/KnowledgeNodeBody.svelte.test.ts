/**
 * KnowledgeNodeBody DOM contract.
 *
 * The component is the shared 7-phase node renderer extracted from the
 * existing knowledge detail page (course-reader-and-editor WP, Phase 2).
 * The detail page and the upcoming course-step reader both consume it; the
 * rendering must stay identical to the inline version it replaced.
 *
 * Runs under happy-dom via the `unit-dom` vitest project.
 */

import { KNOWLEDGE_PHASE_LABELS, KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import KnowledgeNodeBody, { type PhaseEntry } from './KnowledgeNodeBody.svelte';

afterEach(() => {
	cleanup();
});

function fullPhases(): PhaseEntry[] {
	// Each phase carries a tiny markdown body so the heading + prose path
	// are both exercised. The "discover" phase intentionally has no body to
	// test the placeholder branch.
	return KNOWLEDGE_PHASE_ORDER.map((phase) => ({
		phase,
		body: phase === 'discover' ? null : `# Body for ${phase}\n\nPara for ${phase}.`,
	}));
}

describe('KnowledgeNodeBody -- 7-phase rendering', () => {
	it('renders one heading per phase using KNOWLEDGE_PHASE_LABELS', () => {
		render(KnowledgeNodeBody, { phases: fullPhases() });
		for (const phase of KNOWLEDGE_PHASE_ORDER) {
			const heading = document.getElementById(`phase-${phase}`);
			expect(heading).toBeInTheDocument();
			expect(heading?.textContent).toBe((KNOWLEDGE_PHASE_LABELS as Record<KnowledgePhase, string>)[phase]);
		}
	});

	it('renders the body markdown for phases that have content', () => {
		render(KnowledgeNodeBody, { phases: fullPhases() });
		// "context" has body "Body for context"; the markdown renderer turns it
		// into an <h1> + <p>. Just sniff for the para.
		expect(document.body.textContent).toMatch(/Para for context/);
		expect(document.body.textContent).toMatch(/Para for verify/);
	});

	it('renders a "Not yet authored" placeholder for phases with null body', () => {
		render(KnowledgeNodeBody, { phases: fullPhases() });
		// "discover" was set to null in the fixture.
		expect(document.body.textContent).toMatch(/Not yet authored/);
	});

	it('skips the mastery-criteria block when no criteria supplied', () => {
		render(KnowledgeNodeBody, { phases: fullPhases() });
		expect(screen.queryByText(/Mastery criteria/)).toBeNull();
	});

	it('renders the mastery-criteria block when supplied', () => {
		render(KnowledgeNodeBody, {
			phases: fullPhases(),
			masteryCriteria: 'Complete 3 scenarios with passing grade.',
		});
		expect(screen.getByText('Mastery criteria')).toBeInTheDocument();
		expect(document.body.textContent).toMatch(/passing grade/);
	});

	it('uses a custom aria-label when supplied', () => {
		render(KnowledgeNodeBody, { phases: fullPhases(), ariaLabel: 'Step content' });
		const region = document.querySelector('section[aria-label="Step content"]');
		expect(region).toBeInTheDocument();
	});

	it('defaults the aria-label to "Content phases"', () => {
		render(KnowledgeNodeBody, { phases: fullPhases() });
		const region = document.querySelector('section[aria-label="Content phases"]');
		expect(region).toBeInTheDocument();
	});
});
