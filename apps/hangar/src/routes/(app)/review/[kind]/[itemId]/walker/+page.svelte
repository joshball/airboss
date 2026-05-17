<script lang="ts">
import {
	REVIEW_KINDS,
	REVIEW_WP_SPEC_FINISH_PARAMS,
	REVIEW_WP_SPEC_TOAST_DISMISS_MS,
	type ReviewOutcome,
	ROUTES,
	SESSION_OUTCOME_LABELS,
	type SessionOutcome,
	WALKER_KEYBOARD_SHORTCUTS,
} from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import WalkerStepRow from '@ab/ui/components/WalkerStepRow.svelte';
import type { ActionResult } from '@sveltejs/kit';
import { onDestroy, onMount, untrack } from 'svelte';
import { applyAction, deserialize } from '$app/forms';
import { goto, invalidateAll } from '$app/navigation';
import type { PageData } from './$types';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

interface RecordedEntry {
	outcome: ReviewOutcome | null;
	note: string;
}

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Spec', href: ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id) },
	{ label: data.item.title },
]);

let savingByStep = $state<ReadonlyMap<string, boolean>>(new Map());
let errorByStep = $state<ReadonlyMap<string, string>>(new Map());
let liveAnnounce = $state('');
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let confirmFinish = $state<SessionOutcome | null>(null);
let finishing = $state(false);
let focusedStepRef = $state<string | null>(null);

// Build a Map<stepRef, recorded> for fast lookup as the user clicks through
// outcomes. Re-derives whenever the server load brings in a fresh
// `recordedByRef` array (e.g. after a `?/recordStep` round-trip).
const recordedByRef = $derived<ReadonlyMap<string, RecordedEntry>>(
	new Map(data.recordedByRef.map((r) => [r.stepRef, { outcome: r.outcome, note: r.note }] as const)),
);

// Local optimistic copy of recordedByRef. Reflects in-flight outcome flips
// and unblurred note typing.
//
// Sync rule (load-bearing for "no clobbered typing"): when the server load
// returns fresh data, MERGE it into the existing optimistic map -- do NOT
// wholesale-overwrite. Skip any ref whose `?/recordStep` is currently in
// flight (its local state is fresher than the server's). Skip any ref the
// user is mid-edit on (note draft; tracked via WalkerStepRow's focus check).
let optimistic = $state<Map<string, RecordedEntry>>(new Map());
// The merge effect reacts to fresh SERVER data (`recordedByRef`) and the
// in-flight set (`savingByStep`). It reads the prior `optimistic` value to
// preserve pending / orphan-note entries, but that read is wrapped in
// `untrack` -- the effect WRITES `optimistic`, so subscribing to it would
// make every write re-trigger the effect, an infinite loop that crashes
// hydration with `effect_update_depth_exceeded`.
$effect(() => {
	const next = untrack(() => new Map(optimistic));
	for (const [ref, rec] of recordedByRef) {
		if (savingByStep.get(ref) === true) continue;
		next.set(ref, { ...rec });
	}
	// Drop optimistic-only entries the server doesn't know about, unless they
	// are still in flight (rare; would only happen if the user reverted an
	// outcome locally).
	for (const ref of next.keys()) {
		if (!recordedByRef.has(ref) && savingByStep.get(ref) !== true) {
			// Entry exists locally but not on server: keep it ONLY if it has
			// an outcome that the user picked (so the optimistic write is
			// pending or just landed) OR a note draft (orphan note). The
			// server's view is authoritative for non-pending refs.
			const existing = next.get(ref);
			if (existing && existing.outcome === null && existing.note === '') {
				next.delete(ref);
			}
		}
	}
	optimistic = next;
});

// Live note drafts captured from WalkerStepRow's `onNoteChange`. Lets the
// page submit the CURRENT textarea content when the user clicks an outcome
// without first blurring -- otherwise the typed words would be dropped.
let noteDrafts = $state<Map<string, string>>(new Map());

const totals = $derived(computeTotals(optimistic, data.steps.length));

function computeTotals(
	state: ReadonlyMap<string, RecordedEntry>,
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

const isCleanPass = $derived(
	data.steps.length > 0 && totals.pass === data.steps.length && totals.fail === 0 && totals.blocked === 0,
);

function suggestedFinish(): SessionOutcome {
	if (isCleanPass) return 'pass';
	if (totals.fail > 0 || totals.blocked > 0) return 'fail';
	if (totals.recorded > 0) return 'abandoned';
	return 'abandoned';
}

// Group steps by their parsed `sectionTitle` so the walker visually mirrors
// the test-plan's H2 structure. Preserves step order; rows without a
// section live under an empty-string heading rendered as "Untitled section".
const groupedSteps = $derived(groupBySection(data.steps));

interface SectionGroup {
	readonly title: string;
	readonly steps: ReadonlyArray<(typeof data.steps)[number]>;
}

function groupBySection(steps: typeof data.steps): readonly SectionGroup[] {
	const groups: SectionGroup[] = [];
	let current: { title: string; steps: (typeof data.steps)[number][] } | null = null;
	for (const s of steps) {
		const sectionTitle = s.sectionTitle ?? '';
		if (current === null || current.title !== sectionTitle) {
			current = { title: sectionTitle, steps: [] };
			groups.push(current);
		}
		current.steps.push(s);
	}
	return groups;
}

async function postAction(formData: FormData, actionPath: string): Promise<ActionResult> {
	const res = await fetch(actionPath, {
		method: 'POST',
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
		body: formData,
	});
	return deserialize(await res.text()) as ActionResult;
}

async function recordStep(stepRef: string, stepIndex: number, outcome: ReviewOutcome, note: string): Promise<void> {
	if (data.session === null) {
		// No active session means there's no plan to walk; the missing-state
		// view is showing and outcome buttons should be unreachable. Bail
		// defensively.
		return;
	}
	// Optimistic update so the row reflects the new outcome immediately.
	const prior = optimistic.get(stepRef);
	const next = new Map(optimistic);
	next.set(stepRef, { outcome, note });
	optimistic = next;
	// Clear any stale per-row error.
	const errMap = new Map(errorByStep);
	errMap.delete(stepRef);
	errorByStep = errMap;
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
		const reason = err instanceof Error ? err.message : 'Network error.';
		revertOptimistic(stepRef, prior);
		setRowError(stepRef, reason);
		liveAnnounce = `Save failed for step ${stepIndex}: ${reason}`;
		showToast('danger', `Save failed: ${reason}`, true);
		clearSaving(stepRef);
		return;
	}
	if (result.type === 'failure' || result.type === 'error') {
		const reason = describeFailure(result);
		revertOptimistic(stepRef, prior);
		setRowError(stepRef, reason);
		liveAnnounce = `Save failed for step ${stepIndex}: ${reason}`;
		showToast('danger', `Step ${stepIndex} save failed: ${reason}`, true);
		clearSaving(stepRef);
		return;
	}
	await applyAction(result);
	await invalidateAll();
	liveAnnounce = `Step ${stepIndex} recorded as ${outcome}.`;
	clearSaving(stepRef);
	// Clear the local note draft now that the server holds the persisted
	// value; the row will re-sync from prop on next paint.
	const draftMap = new Map(noteDrafts);
	draftMap.delete(stepRef);
	noteDrafts = draftMap;
}

function revertOptimistic(stepRef: string, prior: RecordedEntry | undefined): void {
	const prev = new Map(optimistic);
	if (prior) prev.set(stepRef, prior);
	else prev.delete(stepRef);
	optimistic = prev;
}

function setRowError(stepRef: string, message: string): void {
	const map = new Map(errorByStep);
	map.set(stepRef, message);
	errorByStep = map;
}

function clearSaving(stepRef: string): void {
	const map = new Map(savingByStep);
	map.delete(stepRef);
	savingByStep = map;
}

function describeFailure(result: ActionResult): string {
	if (result.type === 'failure') {
		const failurePayload = (result.data ?? {}) as { recordStep?: string; finishSession?: string };
		return failurePayload.recordStep ?? failurePayload.finishSession ?? 'Save failed.';
	}
	if (result.type === 'error') {
		return result.error instanceof Error ? result.error.message : 'Save failed.';
	}
	return 'Save failed.';
}

function showToast(tone: ToastTone, message: string, sticky = false): void {
	toast = { tone, message, sticky };
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
	if (!sticky) {
		toastDismissTimer = setTimeout(() => {
			toast = null;
			toastDismissTimer = null;
		}, REVIEW_WP_SPEC_TOAST_DISMISS_MS);
	}
}

function dismissToast(): void {
	toast = null;
	if (toastDismissTimer !== null) {
		clearTimeout(toastDismissTimer);
		toastDismissTimer = null;
	}
}

onDestroy(() => {
	if (toastDismissTimer !== null) clearTimeout(toastDismissTimer);
});

async function commitNote(stepRef: string, stepIndex: number, note: string): Promise<void> {
	const current = optimistic.get(stepRef);
	if (!current || current.outcome === null) {
		// Note save without an outcome: persist the draft locally so a
		// subsequent outcome click submits both at once. The orphan-note row
		// is held in the optimistic map; if the user navigates away without
		// picking an outcome, the note stays in `noteDrafts` and is lost on
		// reload. Surface a hint about this so the user knows to pick.
		const next = new Map(optimistic);
		next.set(stepRef, { outcome: null, note });
		optimistic = next;
		const drafts = new Map(noteDrafts);
		drafts.set(stepRef, note);
		noteDrafts = drafts;
		return;
	}
	if (current.note === note) return;
	await recordStep(stepRef, stepIndex, current.outcome, note);
}

function trackNoteDraft(stepRef: string, note: string): void {
	const drafts = new Map(noteDrafts);
	drafts.set(stepRef, note);
	noteDrafts = drafts;
}

async function pickOutcome(
	stepRef: string,
	stepIndex: number,
	outcome: ReviewOutcome,
	currentNote: string,
): Promise<void> {
	// Always prefer the user's current textarea content; falls back to the
	// optimistic / server-known note when the textarea hasn't been touched.
	const draft = noteDrafts.get(stepRef);
	const note = draft ?? currentNote ?? optimistic.get(stepRef)?.note ?? '';
	await recordStep(stepRef, stepIndex, outcome, note);
}

async function finishWith(outcome: SessionOutcome): Promise<void> {
	if (data.session === null) return;
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
		showToast('danger', reason, true);
		return;
	}
	if (result.type === 'failure' || result.type === 'error') {
		finishing = false;
		const reason = describeFailure(result);
		liveAnnounce = `Finish failed: ${reason}`;
		showToast('danger', reason, true);
		return;
	}
	await applyAction(result);
	const payload = (result.type === 'success' ? result.data : null) as {
		closedAs?: string;
		frontmatterFlipped?: boolean;
		frontmatterError?: string | null;
	} | null;
	const flipped = payload?.frontmatterFlipped === true;
	const fmError = typeof payload?.frontmatterError === 'string' ? payload.frontmatterError : null;
	liveAnnounce = `Session finished as ${outcome}.${flipped ? ' review_status flipped to done.' : ''}`;
	// Send the user back to the spec view so they can see the session summary
	// in the right rail. Carry the outcome via URL params so the spec view
	// surfaces a closing-handshake toast (the walker's local toast would
	// disappear with the navigation).
	const url = new URL(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id), window.location.origin);
	url.searchParams.set(REVIEW_WP_SPEC_FINISH_PARAMS.FINISHED_AS, outcome);
	url.searchParams.set(REVIEW_WP_SPEC_FINISH_PARAMS.FLIPPED, flipped ? '1' : '0');
	if (fmError !== null) url.searchParams.set(REVIEW_WP_SPEC_FINISH_PARAMS.FM_ERROR, fmError);
	await goto(`${url.pathname}${url.search}`);
}

function pause(): void {
	// Pause is a navigation, not a server write -- the session stays open
	// (`finishedAt = null`); revisiting resumes it. Removed the no-op server
	// fetch entirely so the user doesn't see a spinner for nothing.
	void goto(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id));
}

const startedAtFmt = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
});
function formatStartedAt(iso: string): string {
	try {
		return startedAtFmt.format(new Date(iso));
	} catch {
		return iso;
	}
}

// Page-level keyboard navigation. j/k move between rows; p/f/b pick the
// outcome on the focused row; n jumps focus to the focused row's textarea.
// Disabled when an interactive element (textarea, input, button) owns
// focus -- the row's own keydown handler routes those events.
function handlePageKeydown(event: KeyboardEvent): void {
	const target = event.target;
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;
	if (event.metaKey || event.ctrlKey || event.altKey) return;
	if (event.key === WALKER_KEYBOARD_SHORTCUTS.NEXT_STEP) {
		event.preventDefault();
		focusOffset(1);
	} else if (event.key === WALKER_KEYBOARD_SHORTCUTS.PREV_STEP) {
		event.preventDefault();
		focusOffset(-1);
	}
}

function focusOffset(delta: number): void {
	if (data.steps.length === 0) return;
	const list = data.steps;
	const idx = focusedStepRef === null ? -1 : list.findIndex((s) => s.stepRef === focusedStepRef);
	const nextIdx = idx === -1 ? (delta > 0 ? 0 : list.length - 1) : (idx + delta + list.length) % list.length;
	const nextRef = list[nextIdx].stepRef;
	focusedStepRef = nextRef;
	if (typeof document === 'undefined') return;
	const el = document.querySelector<HTMLElement>(`[data-step-ref="${cssEscape(nextRef)}"]`);
	el?.focus();
	el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function cssEscape(value: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
	return value.replace(/["\\]/g, '\\$&');
}

onMount(() => {
	if (typeof window === 'undefined') return;
	window.addEventListener('keydown', handlePageKeydown);
	return () => window.removeEventListener('keydown', handlePageKeydown);
});

const finishOptions: ReadonlyArray<{ value: SessionOutcome; tone: 'success' | 'danger' | 'muted'; label: string }> = [
	{ value: 'pass', tone: 'success', label: SESSION_OUTCOME_LABELS.pass },
	{ value: 'fail', tone: 'danger', label: SESSION_OUTCOME_LABELS.fail },
	{ value: 'abandoned', tone: 'muted', label: SESSION_OUTCOME_LABELS.abandoned },
];
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>Test-plan walker -- {data.item.title}</h1>
	{#if data.session !== null}
		<p class="meta">
			<span class="kind">Session started {formatStartedAt(data.session.startedAt)}</span>
		</p>
	{/if}
</header>

<!-- Polite live region: action result announcements for AT users. -->
<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>

{#if toast}
	<div class="toast-wrap">
		<Toast tone={toast.tone} shape="card">
			{toast.message}
			{#snippet actions()}
				<button type="button" class="dismiss" aria-label="Dismiss notification" onclick={dismissToast}>
					Dismiss
				</button>
			{/snippet}
		</Toast>
	</div>
{/if}

{#if !data.testPlanPresent}
	<section class="missing" aria-labelledby="missing-h">
		<h2 id="missing-h">No <code>test-plan.md</code> for this work package</h2>
		<p>
			The walker needs a <code>{data.testPlanRel}</code> file. Author one alongside the spec, run the loader, and
			revisit.
		</p>
		<a class="back-link" href={ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id)}>Back to spec</a>
	</section>
{:else if data.steps.length === 0}
	<section class="missing" aria-labelledby="empty-h">
		<h2 id="empty-h">No walker steps detected</h2>
		<p>
			<code>{data.testPlanRel}</code> exists but the parser found no walkable rows. The walker reads markdown tables
			(three-column rows under any H2). Update the test plan to include a walkable table.
		</p>
		<a class="back-link" href={ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id)}>Back to spec</a>
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
		<aside class="shortcuts" aria-label="Keyboard shortcuts">
			<p class="shortcut-line">
				<kbd>{WALKER_KEYBOARD_SHORTCUTS.NEXT_STEP}</kbd>/<kbd>{WALKER_KEYBOARD_SHORTCUTS.PREV_STEP}</kbd> navigate
				steps -- <kbd>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_PASS}</kbd>/<kbd>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_FAIL}</kbd>/<kbd
					>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_BLOCKED}</kbd
				>
				outcome -- <kbd>{WALKER_KEYBOARD_SHORTCUTS.FOCUS_NOTE}</kbd> focus note
			</p>
		</aside>
		<div class="actions">
			<Button variant="secondary" onclick={pause}>Pause</Button>
			{#if confirmFinish === null}
				<Button
					variant="primary"
					disabled={totals.recorded === 0}
					onclick={() => (confirmFinish = suggestedFinish())}
				>
					Finish
				</Button>
			{/if}
		</div>
	</section>

	{#if confirmFinish !== null}
		<section class="finish-panel" aria-labelledby="finish-h">
			<h2 id="finish-h">Finish session</h2>
			<p class="confirm-text">
				Pick the outcome that best describes this walk. The action closes the open session and either flips
				<code>review_status: done</code> on the spec (clean pass) or leaves it untouched.
			</p>
			<div class="finish-options" role="radiogroup" aria-label="Session outcome">
				{#each finishOptions as opt (opt.value)}
					<button
						type="button"
						class="finish-option"
						class:active={confirmFinish === opt.value}
						data-tone={opt.tone}
						aria-pressed={confirmFinish === opt.value}
						onclick={() => (confirmFinish = opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
			{#if isCleanPass && confirmFinish === 'pass'}
				<p class="flip-note">
					All {data.steps.length} steps passed -- this will flip <code>review_status: done</code> on the spec.
				</p>
			{:else if confirmFinish === 'abandoned'}
				<p class="flip-note">
					Closing as abandoned. All step outcomes are kept on the session record but the spec's review_status
					will not flip.
				</p>
			{/if}
			<div class="confirm-row">
				<Button
					variant="primary"
					loading={finishing}
					loadingLabel="Finishing..."
					onclick={() => {
						if (confirmFinish !== null) void finishWith(confirmFinish);
					}}
				>
					Confirm finish
				</Button>
				<button type="button" class="action-button" onclick={() => (confirmFinish = null)}>Cancel</button>
			</div>
		</section>
	{/if}

	<section class="walker" aria-label="Walker steps">
		{#each groupedSteps as group, gi (gi)}
			<div class="section">
				{#if group.title !== ''}
					<h2 class="section-title">{group.title}</h2>
				{/if}
				{#each group.steps as step (step.stepRef)}
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
						saving={savingByStep.get(step.stepRef) === true}
						errorMessage={errorByStep.get(step.stepRef) ?? null}
						onPick={(outcome, currentNote) => pickOutcome(step.stepRef, step.stepIndex, outcome, currentNote)}
						onNoteCommit={(note) => commitNote(step.stepRef, step.stepIndex, note)}
						onNoteChange={(note) => trackNoteDraft(step.stepRef, note)}
					/>
				{/each}
			</div>
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

	.shortcuts {
		flex: 1 0 100%;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.shortcut-line kbd {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		padding: 0 var(--space-3xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
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

	.finish-panel {
		margin: var(--space-md) 0;
		padding: var(--space-md);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.finish-panel h2 {
		margin: 0;
		font-size: var(--type-ui-control-size);
	}

	.finish-options {
		display: flex;
		gap: var(--space-2xs);
		flex-wrap: wrap;
	}

	.finish-option {
		appearance: none;
		font: inherit;
		font-size: var(--type-ui-label-size);
		padding: var(--space-2xs) var(--space-sm);
		min-height: 2rem;
		min-width: 6rem;
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.finish-option:hover {
		background: var(--surface-sunken);
	}

	.finish-option:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.finish-option[data-tone='success'].active {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border-color: var(--signal-success-ink);
	}

	.finish-option[data-tone='danger'].active {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.finish-option[data-tone='muted'].active {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.confirm-text {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.flip-note {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.section-title {
		margin: 0;
		font-size: var(--type-ui-control-size);
		color: var(--ink-body);
		padding-bottom: var(--space-2xs);
		border-bottom: 1px solid var(--edge-default);
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

	.toast-wrap {
		margin: var(--space-md) 0;
	}

	.dismiss {
		appearance: none;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
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
