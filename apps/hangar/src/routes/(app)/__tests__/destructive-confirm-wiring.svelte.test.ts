/**
 * Destructive-action confirmation wiring -- DOM contract.
 *
 * Closes the convergent UX/A11y finding from the chunk-6 hangar review:
 * destructive form-actions on /sources/[id]/files (archive delete),
 * /glossary/[id] + /glossary/sources/[id] (soft-delete), /sources/[id]/diff
 * (commit) and /jobs/[id] (cancel) must be gated by ConfirmDialog rather
 * than submitting on the first click.
 *
 * The tests render a minimal harness mirroring the same dialog wiring each
 * page emits, then verify:
 *   - the trigger button does NOT render a form (so it can't accidentally
 *     post on first click).
 *   - the dialog opens on trigger click and posts to the correct
 *     form-action with the expected hidden fields.
 *   - typed-confirmation gates Confirm where required (archive delete,
 *     glossary source soft-delete, large diff commit).
 *
 * Hangar has no Playwright e2e infrastructure yet (separate convergent
 * gap flagged in the cluster review); these unit-level tests cover the
 * confirm contract until that lands.
 */

import { ROUTES } from '@ab/constants';
import { cleanup, render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import ArchiveDeleteHarness from './harnesses/ArchiveDeleteHarness.svelte';
import CommitDiffHarness from './harnesses/CommitDiffHarness.svelte';
import GlossaryReferenceDeleteHarness from './harnesses/GlossaryReferenceDeleteHarness.svelte';
import GlossarySourceDeleteHarness from './harnesses/GlossarySourceDeleteHarness.svelte';
import JobCancelHarness from './harnesses/JobCancelHarness.svelte';

afterEach(() => {
	cleanup();
});

describe('archive delete on /sources/[id]/files', () => {
	it('renders the trigger as a button -- no auto-submitting form', () => {
		const { container } = render(ArchiveDeleteHarness, { fileName: 'PHAK@2024-12-01.zip' });
		// The trigger is a Button, NOT a <form> with type=submit.
		const trigger = screen.getByRole('button', { name: 'Delete' });
		expect((trigger as HTMLButtonElement).type).not.toBe('submit');
		// The destructive form is mounted inside the dialog footer when the
		// dialog opens, not as the inline trigger.
		const inlineDeleteForms = container.querySelectorAll('form[action="?/delete"]');
		expect(inlineDeleteForms.length).toBe(0);
	});

	it('clicking Delete opens a danger ConfirmDialog gated by typed confirmation', async () => {
		const user = userEvent.setup();
		render(ArchiveDeleteHarness, { fileName: 'PHAK@2024-12-01.zip' });
		await user.click(screen.getByRole('button', { name: 'Delete' }));
		// Dialog body shows the file name (multiple matches: typed-gate label,
		// hidden input value, body prose). Use getAllByText for resilience.
		expect(screen.getAllByText(/PHAK@2024-12-01.zip/).length).toBeGreaterThan(0);
		// Confirm button starts disabled because typed-gate is unmet.
		const confirm = screen.getByRole('button', { name: 'Delete archive' });
		expect((confirm as HTMLButtonElement).disabled).toBe(true);
	});

	it('typing the file name enables Confirm and posts to the file delete action', async () => {
		const user = userEvent.setup();
		const { container } = render(ArchiveDeleteHarness, { fileName: 'PHAK@2024-12-01.zip' });
		await user.click(screen.getByRole('button', { name: 'Delete' }));
		const input = screen.getByLabelText(/Type the file name to confirm/) as HTMLInputElement;
		await user.type(input, 'PHAK@2024-12-01.zip');
		const confirm = screen.getByRole('button', { name: 'Delete archive' });
		expect((confirm as HTMLButtonElement).disabled).toBe(false);
		const form = container.querySelector('form.confirm-form');
		expect(form?.getAttribute('action')).toBe(ROUTES.HANGAR_SOURCE_FILE_DELETE_ACTION);
		const nameField = form?.querySelector('input[type=hidden][name=name]') as HTMLInputElement;
		expect(nameField?.value).toBe('PHAK@2024-12-01.zip');
	});
});

describe('soft-delete on /glossary/[id]', () => {
	it('clicking the trigger opens the ConfirmDialog and does not submit immediately', async () => {
		const user = userEvent.setup();
		const { container } = render(GlossaryReferenceDeleteHarness, { rev: 7, refId: 'far-91-103' });
		// Before click: no confirm form rendered.
		expect(container.querySelector('form.confirm-form')).toBeNull();
		await user.click(screen.getByRole('button', { name: 'Soft-delete this reference' }));
		// After click: confirm form mounted with the soft-delete action.
		const form = container.querySelector('form.confirm-form');
		expect(form?.getAttribute('action')).toBe(ROUTES.HANGAR_GLOSSARY_DELETE_ACTION);
		const revField = form?.querySelector('input[type=hidden][name=rev]') as HTMLInputElement;
		expect(revField?.value).toBe('7');
	});
});

describe('soft-delete on /glossary/sources/[id]', () => {
	it('opens a typed-gate ConfirmDialog requiring the source id', async () => {
		const user = userEvent.setup();
		render(GlossarySourceDeleteHarness, { rev: 12, sourceId: 'source-far-91' });
		await user.click(screen.getByRole('button', { name: 'Soft-delete this source' }));
		const confirm = screen.getByRole('button', { name: 'Soft-delete' });
		// Typed gate: disabled until user types the source id.
		expect((confirm as HTMLButtonElement).disabled).toBe(true);
		const input = screen.getByLabelText(/Type the source id to confirm/) as HTMLInputElement;
		await user.type(input, 'source-far-91');
		expect((confirm as HTMLButtonElement).disabled).toBe(false);
	});
});

describe('Commit diff on /sources/[id]/diff', () => {
	it('small diffs use a caution dialog without typed gate', async () => {
		const user = userEvent.setup();
		render(CommitDiffHarness, { sourceId: 'source-acs-pa', diffLines: 42 });
		await user.click(screen.getByRole('button', { name: 'Commit this diff' }));
		const confirm = screen.getByRole('button', { name: 'Commit' });
		expect((confirm as HTMLButtonElement).disabled).toBe(false);
		// Body mentions the line count. Text is broken across child <strong> /
		// <code> elements, so search the dialog content directly.
		const body = document.querySelector('[data-dialog-body]') ?? document.body;
		expect(body.textContent).toMatch(/42 lines?/);
		expect(body.textContent).toMatch(/staged changes/);
	});

	it('large diffs (>= threshold) escalate to danger + typed gate', async () => {
		const user = userEvent.setup();
		render(CommitDiffHarness, { sourceId: 'source-acs-pa', diffLines: 1500 });
		await user.click(screen.getByRole('button', { name: 'Commit this diff' }));
		const confirm = screen.getByRole('button', { name: 'Commit' });
		// Typed gate is in effect -- disabled until the source id is typed.
		expect((confirm as HTMLButtonElement).disabled).toBe(true);
		const input = screen.getByLabelText(/Type the source id to confirm/) as HTMLInputElement;
		await user.type(input, 'source-acs-pa');
		expect((confirm as HTMLButtonElement).disabled).toBe(false);
	});

	it('posts to the commit form-action route', async () => {
		const user = userEvent.setup();
		const { container } = render(CommitDiffHarness, { sourceId: 'source-acs-pa', diffLines: 42 });
		await user.click(screen.getByRole('button', { name: 'Commit this diff' }));
		const form = container.querySelector('form.confirm-form');
		expect(form?.getAttribute('action')).toBe(ROUTES.HANGAR_SOURCE_DIFF_COMMIT_ACTION);
	});
});

describe('Cancel job on /jobs/[id]', () => {
	it('clicking Cancel job opens a caution ConfirmDialog -- no immediate submit', async () => {
		const user = userEvent.setup();
		const { container } = render(JobCancelHarness, {
			kind: 'source.fetch',
			targetType: 'source',
			targetId: 'source-acs-pa',
			startedAt: new Date(Date.now() - 90_000).toISOString(),
		});
		await user.click(screen.getByRole('button', { name: 'Cancel job' }));
		// Dialog renders a Confirm form posting to the cancel action; the trigger
		// did NOT submit on first click.
		const form = container.querySelector('form.confirm-form');
		expect(form?.getAttribute('action')).toBe(ROUTES.HANGAR_JOB_CANCEL_ACTION);
		// Body surfaces the kind + target so the operator knows what they're killing.
		expect(screen.getByText(/source.fetch/)).toBeInTheDocument();
		expect(screen.getByText(/source:source-acs-pa/)).toBeInTheDocument();
	});

	it('Keep running cancel button closes the dialog without submitting', async () => {
		const user = userEvent.setup();
		const { container } = render(JobCancelHarness, {
			kind: 'sync.diff',
			targetType: 'source',
			targetId: 'source-acs-pa',
			startedAt: null,
		});
		await user.click(screen.getByRole('button', { name: 'Cancel job' }));
		expect(container.querySelector('form.confirm-form')).toBeInTheDocument();
		await user.click(screen.getByRole('button', { name: 'Keep running' }));
		expect(container.querySelector('form.confirm-form')).toBeNull();
	});
});
