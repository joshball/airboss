<script lang="ts">
import { REVIEW_KINDS, type ReviewOutcome, ROUTES, type SessionOutcome } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import WalkerStepRow from '@ab/ui/components/WalkerStepRow.svelte';
import type { ActionResult } from '@sveltejs/kit';
import { applyAction, deserialize } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Test Plan', href: ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id) },
	{ label: data.item.title },
]);

let savingByStep = $state<ReadonlyMap<string, boolean>>(new Map());
let liveAnnounce = $state('');
let toast = $state<{ kind: 'success' | 'error'; message: string } | null>(null);
let confirmFinish = $state<SessionOutcome | null>(null);
let finishing = $state(false);
let pausing = $state(false);

// Build a Map<stepRef, recorded> for fast lookup as the user clicks through
// outcomes. Re-derives whenever the server load brings in a fresh
// `recordedByRef` array (e.g. after a `?/recordStep` round-trip).
const recordedByRef = $derived(
	new Map(data.recordedByRef.map((r) => [r.stepRef, { outcome: r.outcome, note: r.note }] as const)),
);

// Local optimistic copy of recordedByRef; reflects the in-flight state of
// outcome flips before the server round-trip completes. A successful
// `?/recordStep` triggers `invalidateAll()` which refreshes
// `data.recordedByRef` and the page state collapses back into the server
// truth via the $effect below.
let optimistic = $state<Map<string, { outcome: ReviewOutcome | null; note: string }>>(new Map());
$effect(() => {
	const next = new Map<string, { outcome: ReviewOutcome | null; note: string }>();
	for (const [ref, rec] of recordedByRef) next.set(ref, rec);
	optimistic = next;
});

const totals = $derived(computeTotals(optimistic, data.steps.length));

function computeTotals(
	state: ReadonlyMap<string, { outcome: ReviewOutcome | null; note: string }>,
	stepTotal: number,
): { pass: number; fail: number; blocked: number; recorded: number; remaining: number } {
	let pass = 0;
	let fail = 0;
	let blocked = 0;
	let recorded = 0;
	for (const v of state.values()) {
		if (v.outcome === null) continue;
		recorded += 1;
		if (v.outcome === 'pass') pass += 1;
		else if (v.outcome === 'fail') fail += 1;
		else if (v.outcome === 'blocked') blocked += 1;
	}
	return { pass, fail, blocked, recorded, remaining: Math.max(0, stepTotal - recorded) };
}

const everyStepPassed = $derived(
	data.steps.length > 0 && totals.pass === data.steps.length && totals.fail === 0 && totals.blocked === 0,
);

async function postAction(formData: FormData, actionPath: string): Promise<ActionResult> {
	const res = await fetch(actionPath, {
		method: 'POST',
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
		body: formData,
	});
	return deserialize(await res.text()) as ActionResult;
}

async function recordStep(stepRef: string, stepIndex: number, outcome: ReviewOutcome, note: string): Promise<void> {
	// Optimistic update so the row reflects the new outcome immediately.
	const prior = optimistic.get(stepRef);
	const next = new Map(optimistic);
	next.set(stepRef, { outcome, note: prior?.note ?? note });
	optimistic = next;
	const flagMap = new Map(savingByStep);
	flagMap.set(stepRef, true);
	savingByStep = flagMap;

	const fd = new FormData();
	fd.append('sessionId', data.session.id);
	fd.append('stepRef', stepRef);
	fd.append('stepIndex', String(stepIndex));
	fd.append('outcome', outcome);
	fd.append('note', note);
	let result: ActionResult;
	try {
		result = await postAction(fd, '?/recordStep');
	} catch (err) {
		// Revert on transport failure.
		const prev = new Map(optimistic);
		if (prior) prev.set(stepRef, prior);
		else prev.delete(stepRef);
		optimistic = prev;
		const reason = err instanceof Error ? err.message : 'Network error.';
		liveAnnounce = `Save failed: ${reason}`;
		toast = { kind: 'error', message: reason };
		clearSaving(stepRef);
		return;
	}
	if (result.type === 'failure' || result.type === 'error') {
		const prev = new Map(optimistic);
		if (prior) prev.set(stepRef, prior);
		else prev.delete(stepRef);
		optimistic = prev;
		const reason = describeActionFailure(result);
		liveAnnounce = `Save failed: ${reason}`;
		toast = { kind: 'error', message: reason };
		clearSaving(stepRef);
		return;
	}
	await applyAction(result);
	await invalidateAll();
	liveAnnounce = `Step ${stepIndex} recorded as ${outcome}.`;
	clearSaving(stepRef);
}

function clearSaving(stepRef: string) {
	const map = new Map(savingByStep);
	map.delete(stepRef);
	savingByStep = map;
}

function describeActionFailure(result: ActionResult): string {
	if (result.type === 'failure') {
		const data = (result.data ?? {}) as { recordStep?: string; finishSession?: string };
		return data.recordStep ?? data.finishSession ?? 'Save failed.';
	}
	if (result.type === 'error') {
		return result.error instanceof Error ? result.error.message : 'Save failed.';
	}
	return 'Save failed.';
}

async function commitNote(stepRef: string, stepIndex: number, note: string) {
	const current = optimistic.get(stepRef);
	if (!current || current.outcome === null) {
		// Note save without an outcome is a no-op for the BC (`recordStep`
		// requires an outcome). Save a local-only optimistic note so the
		// textarea persists until the user picks an outcome -- the next
		// outcome click submits both at once.
		const next = new Map(optimistic);
		next.set(stepRef, { outcome: null, note });
		optimistic = next;
		return;
	}
	if (current.note === note) return;
	await recordStep(stepRef, stepIndex, current.outcome, note);
}

async function finishWith(outcome: SessionOutcome) {
	finishing = true;
	const fd = new FormData();
	fd.append('sessionId', data.session.id);
	fd.append('outcome', outcome);
	fd.append('note', '');
	let result: ActionResult;
	try {
		result = await postAction(fd, '?/finishSession');
	} catch (err) {
		finishing = false;
		const reason = err instanceof Error ? err.message : 'Network error.';
		liveAnnounce = `Finish failed: ${reason}`;
		toast = { kind: 'error', message: reason };
		return;
	}
	if (result.type === 'failure' || result.type === 'error') {
		finishing = false;
		const reason = describeActionFailure(result);
		liveAnnounce = `Finish failed: ${reason}`;
		toast = { kind: 'error', message: reason };
		return;
	}
	await applyAction(result);
	const payload = (result.type === 'success' ? result.data : null) as {
		closedAs?: string;
		frontmatterFlipped?: boolean;
		frontmatterError?: string | null;
	} | null;
	const flipMessage =
		payload?.frontmatterFlipped === true
			? ' review_status flipped to done.'
			: payload?.frontmatterError
				? ` Frontmatter flip failed: ${payload.frontmatterError}.`
				: '';
	liveAnnounce = `Session finished as ${outcome}.${flipMessage}`;
	toast = { kind: 'success', message: `Session finished as ${outcome}.${flipMessage}` };
	await invalidateAll();
	confirmFinish = null;
	finishing = false;
	// On finish, send the user back to the spec view so they can see the
	// session summary in the right rail.
	await goto(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id));
}

async function pause() {
	pausing = true;
	const fd = new FormData();
	try {
		await postAction(fd, '?/pauseSession');
	} catch {
		// Pause is informational; even if the round-trip failed, we still
		// route back to the spec view -- the session stays open server-side.
	}
	pausing = false;
	await goto(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id));
}

function dismissToast() {
	toast = null;
}
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>Test-plan walker -- {data.item.title}</h1>
	<p class="meta">
		<span class="kind">Session started {new Date(data.session.startedAt).toLocaleString()}</span>
	</p>
</header>

<!-- Polite live region: action result announcements for AT users. -->
<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>

{#if toast}
	<div class="toast" class:toast-error={toast.kind === 'error'} role="status">
		<span>{toast.message}</span>
		<button type="button" class="dismiss" aria-label="Dismiss" onclick={dismissToast}>×</button>
	</div>
{/if}

{#if !data.testPlanPresent}
	<section class="missing" aria-labelledby="missing-h">
		<h2 id="missing-h">No <code>test-plan.md</code> for this work package</h2>
		<p>
			The walker needs a <code>{data.testPlanRel}</code> file. Author one alongside the spec, run the loader, and
			revisit.
		</p>
		<a class="back-link" href={ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id)}>← Back to spec</a>
	</section>
{:else if data.steps.length === 0}
	<section class="missing" aria-labelledby="empty-h">
		<h2 id="empty-h">No walker steps detected</h2>
		<p>
			<code>{data.testPlanRel}</code> exists but the parser found no walkable rows. The walker reads markdown tables
			(three-column rows under any H2). Update the test plan to include a walkable table.
		</p>
		<a class="back-link" href={ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id)}>← Back to spec</a>
	</section>
{:else}
	<section class="summary" aria-label="Walker progress">
		<dl>
			<div class="summary-row">
				<dt>Total steps</dt>
				<dd>{data.steps.length}</dd>
			</div>
			<div class="summary-row">
				<dt>Recorded</dt>
				<dd>{totals.recorded}</dd>
			</div>
			<div class="summary-row">
				<dt>Pass</dt>
				<dd class="pass">{totals.pass}</dd>
			</div>
			<div class="summary-row">
				<dt>Fail</dt>
				<dd class="fail">{totals.fail}</dd>
			</div>
			<div class="summary-row">
				<dt>Blocked</dt>
				<dd class="blocked">{totals.blocked}</dd>
			</div>
			<div class="summary-row">
				<dt>Remaining</dt>
				<dd>{totals.remaining}</dd>
			</div>
		</dl>
		<div class="actions">
			<Button variant="secondary" loading={pausing} loadingLabel="Pausing..." onclick={pause}>Pause</Button>
			{#if confirmFinish === null}
				<Button
					variant="primary"
					disabled={totals.recorded === 0}
					onclick={() => (confirmFinish = everyStepPassed ? 'pass' : totals.fail > 0 ? 'fail' : 'pass')}
				>
					Finish
				</Button>
			{:else}
				<form
					class="finish-form"
					onsubmit={(e) => {
						e.preventDefault();
						const target = confirmFinish;
						if (target !== null) {
							void finishWith(target);
						}
					}}
				>
					<p class="confirm-text">
						Finish session as <strong>{confirmFinish}</strong>?
						{#if everyStepPassed && confirmFinish === 'pass'}
							<span class="flip-note">
								All {data.steps.length} steps passed -- this will flip <code>review_status: done</code>
								on the spec.
							</span>
						{/if}
					</p>
					<div class="confirm-row">
						<Button type="submit" variant="primary" loading={finishing} loadingLabel="Finishing...">
							Confirm finish
						</Button>
						<button type="button" class="action-button" onclick={() => (confirmFinish = null)}>Cancel</button>
					</div>
				</form>
			{/if}
		</div>
	</section>

	<section class="walker" aria-label="Walker steps">
		{#each data.steps as step (step.stepRef)}
			{@const recorded = optimistic.get(step.stepRef) ?? null}
			<WalkerStepRow
				stepIndex={step.stepIndex}
				stepRef={step.stepRef}
				title={step.title}
				action={step.action}
				expected={step.expected}
				recordedOutcome={recorded?.outcome ?? null}
				recordedNote={recorded?.note ?? ''}
				disabled={savingByStep.get(step.stepRef) === true}
				onPick={(outcome) => recordStep(step.stepRef, step.stepIndex, outcome, recorded?.note ?? '')}
				onNoteCommit={(note) => commitNote(step.stepRef, step.stepIndex, note)}
			/>
		{/each}
	</section>
{/if}

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.meta {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
		margin: 0;
	}

	.kind {
		font-family: var(--font-family-mono);
	}

	.summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		margin: var(--space-md) 0;
		flex-wrap: wrap;
	}

	.summary dl {
		display: flex;
		gap: var(--space-md);
		margin: 0;
		flex-wrap: wrap;
	}

	.summary-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		min-width: 5rem;
	}

	.summary dt {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.summary dd {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-control-size);
		color: var(--ink-body);
	}

	.summary dd.pass {
		color: var(--signal-success-ink);
	}

	.summary dd.fail {
		color: var(--signal-danger-ink);
	}

	.summary dd.blocked {
		color: var(--signal-warning-ink);
	}

	.actions {
		display: flex;
		gap: var(--space-2xs);
		align-items: center;
	}

	.action-button {
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-body);
		font: inherit;
		cursor: pointer;
	}

	.action-button:hover {
		background: var(--surface-sunken);
	}

	.action-button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.finish-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		max-width: 24rem;
	}

	.confirm-text {
		margin: 0;
		font-size: var(--type-ui-label-size);
	}

	.flip-note {
		display: block;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
	}

	.walker {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-top: var(--space-md);
	}

	.missing {
		margin-top: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.missing h2 {
		margin: 0 0 var(--space-sm);
	}

	.missing p {
		margin: 0 0 var(--space-sm);
		color: var(--ink-body);
	}

	.back-link {
		color: var(--link-default);
	}

	.back-link:hover {
		color: var(--link-hover);
	}

	.toast {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border: 1px solid var(--signal-success-ink);
		border-radius: var(--radius-sm);
		margin: var(--space-md) 0;
		font-size: var(--type-ui-label-size);
	}

	.toast.toast-error {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.toast .dismiss {
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font-size: var(--type-ui-control-size);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
