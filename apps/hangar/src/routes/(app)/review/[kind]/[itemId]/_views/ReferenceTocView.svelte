<script lang="ts" module>
import type { TocEntry } from '@ab/bc-hangar';
import type { ReviewOutcome, SessionOutcome } from '@ab/constants';

export interface TocEntryDetail {
	readonly entryRef: string;
	readonly entryIndex: number;
	readonly label: string;
	readonly pageNumber: string | null;
	readonly anchor: string | null;
	readonly bodyHtml: string | null;
}

export interface ReferenceTocViewProps {
	readonly itemId: string;
	readonly itemTitle: string;
	readonly reference: { id: string; displayName: string; paraphrase: string } | null;
	readonly entries: ReadonlyArray<TocEntry>;
	readonly entryDetails: ReadonlyArray<TocEntryDetail>;
	readonly tocErrors: ReadonlyArray<{ message: string; path: string }>;
	readonly session: { id: string; startedAt: string } | null;
	readonly recordedByRef: ReadonlyArray<{ entryRef: string; outcome: ReviewOutcome; note: string }>;
	readonly openSessionStartedAt: string | null;
	readonly bucketName: string;
	readonly sessions: ReadonlyArray<{
		id: string;
		startedAt: string;
		finishedAt: string | null;
		outcome: string | null;
		note: string;
	}>;
}
</script>

<script lang="ts">
import {
	REVIEW_OUTCOME_LABELS,
	REVIEW_OUTCOME_VALUES,
	REVIEW_WP_SPEC_TOAST_DISMISS_MS,
	ROUTES,
	WALKER_KEYBOARD_SHORTCUTS,
} from '@ab/constants';
import Badge from '@ab/ui/components/Badge.svelte';
import Button from '@ab/ui/components/Button.svelte';
import Card from '@ab/ui/components/Card.svelte';
import Toast, { type ToastTone } from '@ab/ui/components/Toast.svelte';
import type { ActionResult } from '@sveltejs/kit';
import { applyAction, deserialize } from '$app/forms';
import { onDestroy, onMount } from 'svelte';

interface ToastState {
	readonly tone: ToastTone;
	readonly message: string;
	readonly sticky: boolean;
}

interface RecordedEntry {
	outcome: ReviewOutcome | null;
	note: string;
}

let {
	itemId: _itemId,
	itemTitle,
	reference,
	entries,
	entryDetails,
	tocErrors,
	session,
	recordedByRef,
	openSessionStartedAt,
	sessions,
	bucketName,
}: ReferenceTocViewProps = $props();

const detailByRef = $derived<ReadonlyMap<string, TocEntryDetail>>(
	new Map(entryDetails.map((d) => [d.entryRef, d] as const)),
);

const recordedMap = $derived<ReadonlyMap<string, RecordedEntry>>(
	new Map(recordedByRef.map((r) => [r.entryRef, { outcome: r.outcome, note: r.note }] as const)),
);

let optimistic = $state<Map<string, RecordedEntry>>(new Map());
let savingByRef = $state<ReadonlyMap<string, boolean>>(new Map());
let errorByRef = $state<ReadonlyMap<string, string>>(new Map());
let toast = $state<ToastState | null>(null);
let toastDismissTimer: ReturnType<typeof setTimeout> | null = null;
let liveAnnounce = $state('');
let activeEntryRef = $state<string | null>(null);
// Two roles split apart so the keyboard / state model stays unambiguous.
// `panelOpen` controls whether the finish panel is visible; the selected
// outcome lives on its own variable and only reads while the panel is
// open.
let panelOpen = $state(false);
let selectedFinishOutcome = $state<SessionOutcome | null>(null);
let finishing = $state(false);

// Sync server truth into the optimistic map without overwriting in-flight
// rows. Same rule the walker uses.
$effect(() => {
	const next = new Map(optimistic);
	for (const [ref, rec] of recordedMap) {
		if (savingByRef.get(ref) === true) continue;
		next.set(ref, { ...rec });
	}
	for (const ref of next.keys()) {
		if (!recordedMap.has(ref) && savingByRef.get(ref) !== true) {
			const existing = next.get(ref);
			if (existing && existing.outcome === null && existing.note === '') next.delete(ref);
		}
	}
	optimistic = next;
});

const totals = $derived.by(() => {
	let pass = 0;
	let fail = 0;
	let blocked = 0;
	for (const v of optimistic.values()) {
		if (v.outcome === 'pass') pass += 1;
		else if (v.outcome === 'fail') fail += 1;
		else if (v.outcome === 'blocked') blocked += 1;
	}
	return { pass, fail, blocked, recorded: pass + fail + blocked };
});

const everyEntryPassed = $derived(
	entries.length > 0 && totals.pass === entries.length && totals.fail === 0 && totals.blocked === 0,
);

const suggestedOutcome = $derived<SessionOutcome>(
	everyEntryPassed ? 'pass' : totals.fail > 0 || totals.blocked > 0 ? 'fail' : 'abandoned',
);

// Resume cue: a session that already has recorded steps when we land on
// the page is one we're picking back up. The banner gives the reviewer a
// closing cue rather than dropping them into an indistinguishable view.
const resumingCount = $derived(recordedByRef.length);
const isResuming = $derived(session !== null && resumingCount > 0);

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

async function postAction(formData: FormData, actionPath: string): Promise<ActionResult> {
	const res = await fetch(actionPath, {
		method: 'POST',
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
		body: formData,
	});
	return deserialize(await res.text()) as ActionResult;
}

function describeFailure(result: ActionResult): string {
	if (result.type === 'failure') {
		const failurePayload = (result.data ?? {}) as {
			recordTocStep?: string;
			finishTocSession?: string;
		};
		return failurePayload.recordTocStep ?? failurePayload.finishTocSession ?? 'Save failed.';
	}
	if (result.type === 'error') {
		return result.error instanceof Error ? result.error.message : 'Save failed.';
	}
	return 'Save failed.';
}

async function recordEntry(entry: TocEntry, outcome: ReviewOutcome): Promise<void> {
	if (session === null) return;
	const prior = optimistic.get(entry.entryRef);
	const next = new Map(optimistic);
	next.set(entry.entryRef, { outcome, note: prior?.note ?? '' });
	optimistic = next;
	const errMap = new Map(errorByRef);
	errMap.delete(entry.entryRef);
	errorByRef = errMap;
	const flagMap = new Map(savingByRef);
	flagMap.set(entry.entryRef, true);
	savingByRef = flagMap;

	const fd = new FormData();
	fd.append('sessionId', session.id);
	fd.append('entryRef', entry.entryRef);
	fd.append('entryIndex', String(entry.entryIndex));
	fd.append('outcome', outcome);
	fd.append('note', prior?.note ?? '');
	let result: ActionResult;
	try {
		result = await postAction(fd, '?/recordTocStep');
	} catch (err) {
		const reason = err instanceof Error ? err.message : 'Network error.';
		revertOptimistic(entry.entryRef, prior);
		setRowError(entry.entryRef, reason);
		liveAnnounce = `Save failed for entry ${entry.entryIndex}: ${reason}`;
		showToast('danger', `Save failed: ${reason}`, true);
		clearSaving(entry.entryRef);
		return;
	}
	if (result.type === 'failure' || result.type === 'error') {
		const reason = describeFailure(result);
		revertOptimistic(entry.entryRef, prior);
		setRowError(entry.entryRef, reason);
		liveAnnounce = `Save failed for entry ${entry.entryIndex}: ${reason}`;
		showToast('danger', `Entry ${entry.entryIndex} save failed: ${reason}`, true);
		clearSaving(entry.entryRef);
		return;
	}
	// `applyAction` already pumps the SvelteKit invalidation pipeline; an
	// extra `invalidateAll()` here would force a redundant load fetch.
	await applyAction(result);
	liveAnnounce = `Entry ${entry.entryIndex} recorded as ${outcome}.`;
	clearSaving(entry.entryRef);
	// Auto-open the finish panel when every entry just landed pass --
	// reduces the keyboard-driven case from "j/k/p ... scroll up ... click ...
	// pick ... click" to "j/k/p ... Confirm".
	if (
		entries.length > 0 &&
		outcome === 'pass' &&
		[...optimistic.values()].filter((v) => v.outcome === 'pass').length === entries.length
	) {
		openFinishPanel('pass', /*announceAuto*/ true);
	}
}

function revertOptimistic(entryRef: string, prior: RecordedEntry | undefined): void {
	const prev = new Map(optimistic);
	if (prior) prev.set(entryRef, prior);
	else prev.delete(entryRef);
	optimistic = prev;
}

function setRowError(entryRef: string, message: string): void {
	const map = new Map(errorByRef);
	map.set(entryRef, message);
	errorByRef = map;
}

function clearSaving(entryRef: string): void {
	const map = new Map(savingByRef);
	map.delete(entryRef);
	savingByRef = map;
}

function openFinishPanel(initial: SessionOutcome, announceAuto = false): void {
	panelOpen = true;
	selectedFinishOutcome = initial;
	if (announceAuto) {
		liveAnnounce = 'Every entry passed. Finish panel opened.';
	}
}

function closeFinishPanel(): void {
	panelOpen = false;
	selectedFinishOutcome = null;
}

async function finishWith(outcome: SessionOutcome): Promise<void> {
	if (session === null) return;
	finishing = true;
	const fd = new FormData();
	fd.append('sessionId', session.id);
	fd.append('outcome', outcome);
	fd.append('note', '');
	let result: ActionResult;
	try {
		result = await postAction(fd, '?/finishTocSession');
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
	finishing = false;
	closeFinishPanel();
	const bucketSide =
		outcome === 'pass'
			? ` Item removed from "${bucketName}" bucket.`
			: ` Item stays in "${bucketName}" bucket -- mark pass to remove.`;
	showToast('success', `TOC review finished as ${outcome}.${bucketSide}`);
	liveAnnounce = `TOC review finished as ${outcome}.${bucketSide}`;
}

function focusOffset(delta: number): void {
	if (entries.length === 0) return;
	const idx = activeEntryRef === null ? -1 : entries.findIndex((e) => e.entryRef === activeEntryRef);
	const nextIdx = idx === -1 ? (delta > 0 ? 0 : entries.length - 1) : (idx + delta + entries.length) % entries.length;
	activeEntryRef = entries[nextIdx].entryRef;
	if (typeof document === 'undefined') return;
	const el = document.querySelector<HTMLElement>(`[data-entry-ref="${cssEscape(entries[nextIdx].entryRef)}"]`);
	el?.focus();
	el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function cssEscape(value: string): string {
	if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
	return value.replace(/["\\]/g, '\\$&');
}

function handlePageKeydown(event: KeyboardEvent): void {
	const target = event.target;
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;
	if (event.metaKey || event.ctrlKey || event.altKey) return;
	if (event.key === WALKER_KEYBOARD_SHORTCUTS.NEXT_STEP) {
		event.preventDefault();
		focusOffset(1);
		return;
	}
	if (event.key === WALKER_KEYBOARD_SHORTCUTS.PREV_STEP) {
		event.preventDefault();
		focusOffset(-1);
		return;
	}
	if (activeEntryRef === null) return;
	const entry = entries.find((e) => e.entryRef === activeEntryRef);
	if (!entry) return;
	if (event.key === WALKER_KEYBOARD_SHORTCUTS.OUTCOME_PASS) {
		event.preventDefault();
		void recordEntry(entry, 'pass');
	} else if (event.key === WALKER_KEYBOARD_SHORTCUTS.OUTCOME_FAIL) {
		event.preventDefault();
		void recordEntry(entry, 'fail');
	} else if (event.key === WALKER_KEYBOARD_SHORTCUTS.OUTCOME_BLOCKED) {
		event.preventDefault();
		void recordEntry(entry, 'blocked');
	}
}

onMount(() => {
	// Cursor at the first un-recorded entry on resume; otherwise at the
	// first entry. Keyboard pickup point matches what the reviewer would do
	// with the mouse anyway.
	if (entries.length > 0 && activeEntryRef === null) {
		const firstUnrecorded = entries.find((e) => !recordedMap.has(e.entryRef));
		activeEntryRef = (firstUnrecorded ?? entries[0]).entryRef;
	}
	if (typeof window === 'undefined') return;
	window.addEventListener('keydown', handlePageKeydown);
	return () => window.removeEventListener('keydown', handlePageKeydown);
});

const activeDetail = $derived<TocEntryDetail | null>(
	activeEntryRef === null ? null : (detailByRef.get(activeEntryRef) ?? null),
);
const activeRecorded = $derived<RecordedEntry | null>(
	activeEntryRef === null ? null : (optimistic.get(activeEntryRef) ?? null),
);
</script>

<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>

<header class="view-hd">
	<h2 class="view-title">{itemTitle}</h2>
	<aside class="shortcuts" aria-label="Keyboard shortcuts">
		<kbd>{WALKER_KEYBOARD_SHORTCUTS.NEXT_STEP}</kbd>/<kbd>{WALKER_KEYBOARD_SHORTCUTS.PREV_STEP}</kbd> navigate ·
		<kbd>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_PASS}</kbd>/<kbd>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_FAIL}</kbd>/<kbd
			>{WALKER_KEYBOARD_SHORTCUTS.OUTCOME_BLOCKED}</kbd
		> outcome
	</aside>
</header>

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

{#if reference === null}
	<section class="missing">
		<h3>This reference no longer exists</h3>
		<p>
			The underlying reference row has been removed. <a href={ROUTES.HANGAR_REVIEW}>Return to the board</a> -- the next
			refresh will clear this item.
		</p>
	</section>
{:else if entries.length === 0}
	<section class="missing">
		<h3>No TOC content for this reference yet</h3>
		<p>
			This reference doesn't have a TOC extraction. Mark this item blocked, or open an ad-hoc task to re-extract the TOC.
		</p>
		<p class="empty-actions">
			<a class="action-link" href={ROUTES.HANGAR_REVIEW_TASK_NEW}>+ New task to re-extract TOC</a>
			<a class="action-link" href={ROUTES.HANGAR_REVIEW}>Back to board</a>
		</p>
		{#if tocErrors.length > 0}
			<h4 class="errors-h">Parser warnings</h4>
			<ul class="errors">
				{#each tocErrors as err (err.path)}
					<li><span class="err-path">{err.path}</span> -- {err.message}</li>
				{/each}
			</ul>
		{/if}
	</section>
{:else}
	{#if isResuming}
		<aside class="resume-banner" role="status">
			<strong>Resuming session</strong> started {openSessionStartedAt ? formatStartedAt(openSessionStartedAt) : ''} --
			{resumingCount} of {entries.length} entries already recorded.
		</aside>
	{/if}
	<section class="summary" aria-label="TOC review progress">
		<dl>
			<div><dt>Total entries</dt><dd>{entries.length}</dd></div>
			<div><dt>Pass</dt><dd class="pass">{totals.pass}</dd></div>
			<div><dt>Fail</dt><dd class="fail">{totals.fail}</dd></div>
			<div><dt>Blocked</dt><dd class="blocked">{totals.blocked}</dd></div>
			<div><dt>Recorded</dt><dd>{totals.recorded}</dd></div>
		</dl>
		<div class="actions">
			{#if !panelOpen}
				<Button
					variant="primary"
					disabled={totals.recorded === 0 || session === null}
					onclick={() => openFinishPanel(suggestedOutcome)}
				>
					Finish TOC review (suggests: {suggestedOutcome})
				</Button>
			{/if}
		</div>
	</section>

	{#if panelOpen}
		<section class="finish-panel" aria-labelledby="finish-h">
			<h3 id="finish-h">Finish session</h3>
			<p class="confirm-text">Pick the outcome that best describes this TOC review.</p>
			<div class="finish-options" role="radiogroup" aria-label="Session outcome">
				<button
					type="button"
					class="finish-option"
					class:active={selectedFinishOutcome === 'pass'}
					data-tone="success"
					aria-pressed={selectedFinishOutcome === 'pass'}
					aria-describedby={suggestedOutcome === 'pass' ? 'finish-suggested' : undefined}
					onclick={() => (selectedFinishOutcome = 'pass')}
				>
					Pass
					{#if suggestedOutcome === 'pass'}<span class="suggested-tag">(suggested)</span>{/if}
				</button>
				<button
					type="button"
					class="finish-option"
					class:active={selectedFinishOutcome === 'fail'}
					data-tone="danger"
					aria-pressed={selectedFinishOutcome === 'fail'}
					aria-describedby={suggestedOutcome === 'fail' ? 'finish-suggested' : undefined}
					onclick={() => (selectedFinishOutcome = 'fail')}
				>
					Fail
					{#if suggestedOutcome === 'fail'}<span class="suggested-tag">(suggested)</span>{/if}
				</button>
				<button
					type="button"
					class="finish-option"
					class:active={selectedFinishOutcome === 'abandoned'}
					data-tone="muted"
					aria-pressed={selectedFinishOutcome === 'abandoned'}
					aria-describedby={suggestedOutcome === 'abandoned' ? 'finish-suggested' : undefined}
					onclick={() => (selectedFinishOutcome = 'abandoned')}
				>
					Abandoned
					{#if suggestedOutcome === 'abandoned'}<span class="suggested-tag">(suggested)</span>{/if}
				</button>
			</div>
			<small id="finish-suggested" class="suggestion-text">
				Suggested based on recorded outcomes ({totals.pass}/{entries.length} pass, {totals.fail} fail, {totals.blocked}
				blocked).
			</small>
			<div class="confirm-row">
				<Button
					variant="primary"
					loading={finishing}
					loadingLabel="Finishing..."
					onclick={() => {
						if (selectedFinishOutcome !== null) void finishWith(selectedFinishOutcome);
					}}
				>
					Confirm finish
				</Button>
				<button type="button" class="action-button" onclick={closeFinishPanel}>Cancel</button>
			</div>
		</section>
	{/if}

	<div class="layout">
		<section class="toc-list" aria-label="Table of contents">
			<ol>
				{#each entries as entry (entry.entryRef)}
					{@const recorded = optimistic.get(entry.entryRef) ?? null}
					<li
						class="entry"
						class:active={activeEntryRef === entry.entryRef}
						data-entry-ref={entry.entryRef}
					>
						<button
							type="button"
							class="entry-row"
							onclick={() => (activeEntryRef = entry.entryRef)}
							aria-current={activeEntryRef === entry.entryRef ? 'true' : undefined}
						>
							<span class="entry-index">{entry.entryIndex}</span>
							<span class="entry-label">{entry.label}</span>
							{#if entry.pageNumber}
								<span class="entry-page">p. {entry.pageNumber}</span>
							{/if}
							{#if recorded?.outcome === 'pass'}
								<Badge tone="success" size="sm">Pass</Badge>
							{:else if recorded?.outcome === 'fail'}
								<Badge tone="danger" size="sm">Fail</Badge>
							{:else if recorded?.outcome === 'blocked'}
								<Badge tone="warning" size="sm">Blocked</Badge>
							{/if}
						</button>
						<div class="outcomes" role="group" aria-label={`Outcome for entry ${entry.entryIndex}`}>
							{#each REVIEW_OUTCOME_VALUES as value (value)}
								<button
									type="button"
									class="outcome"
									class:active={recorded?.outcome === value}
									data-outcome={value}
									disabled={savingByRef.get(entry.entryRef) === true || session === null}
									aria-pressed={recorded?.outcome === value}
									onclick={() => recordEntry(entry, value)}
								>
									{REVIEW_OUTCOME_LABELS[value]}
								</button>
							{/each}
						</div>
						{#if errorByRef.get(entry.entryRef)}
							<p class="row-error" role="alert">Save failed: {errorByRef.get(entry.entryRef)}</p>
						{/if}
					</li>
				{/each}
			</ol>
		</section>

		<aside class="content-pane" aria-label="Entry detail">
			<Card>
				{#snippet header()}
					<h3>{activeDetail ? `Entry ${activeDetail.entryIndex}` : reference.displayName}</h3>
				{/snippet}
				{#if activeDetail}
					<dl class="detail">
						<div><dt>Label</dt><dd>{activeDetail.label}</dd></div>
						{#if activeDetail.pageNumber}
							<div><dt>Page</dt><dd>{activeDetail.pageNumber}</dd></div>
						{/if}
						{#if activeDetail.anchor}
							<div><dt>Anchor</dt><dd><code>{activeDetail.anchor}</code></dd></div>
						{/if}
						<div>
							<dt>Status</dt>
							<dd>
								{#if activeRecorded?.outcome === 'pass'}<Badge tone="success" size="sm">Pass</Badge>
								{:else if activeRecorded?.outcome === 'fail'}<Badge tone="danger" size="sm">Fail</Badge>
								{:else if activeRecorded?.outcome === 'blocked'}<Badge tone="warning" size="sm">Blocked</Badge>
								{:else}<span class="muted">Not recorded</span>{/if}
							</dd>
						</div>
					</dl>
					{#if activeDetail.bodyHtml}
						<!-- bodyHtml is rendered HTML from the BC; safe for {@html}. -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<div class="entry-body">{@html activeDetail.bodyHtml}</div>
					{:else}
						<p class="muted entry-hint">
							Verify the heading and page number against the source. The body for this entry isn't extracted into the
							TOC blob; the source PDF / scan remains the authority.
						</p>
					{/if}
				{:else}
					<p class="paraphrase">{reference.paraphrase}</p>
					<p class="muted">Click a TOC entry on the left to inspect its detail.</p>
				{/if}
				{#if openSessionStartedAt !== null && !isResuming}
					<p class="session-meta">Open session started {formatStartedAt(openSessionStartedAt)}.</p>
				{/if}
			</Card>

			{#if sessions.length > 0}
				<Card>
					{#snippet header()}<h3>Sessions</h3>{/snippet}
					<ul class="session-list">
						{#each sessions as s (s.id)}
							<li class="session">
								<span class="session-when">{formatStartedAt(s.startedAt)}</span>
								<span class="session-state">
									{#if s.finishedAt === null}
										<Badge tone="info" size="sm">Open</Badge>
									{:else if s.outcome === 'pass'}
										<Badge tone="success" size="sm">Pass</Badge>
									{:else if s.outcome === 'fail'}
										<Badge tone="danger" size="sm">Fail</Badge>
									{:else if s.outcome === 'abandoned'}
										<Badge tone="muted" size="sm">Abandoned</Badge>
									{:else}
										<Badge tone="default" size="sm">{s.outcome ?? 'Closed'}</Badge>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</Card>
			{/if}
		</aside>
	</div>
{/if}

<style>
	.view-hd {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
		flex-wrap: wrap;
		margin-top: var(--space-md);
	}

	.view-title {
		margin: 0;
		font-size: var(--type-ui-control-size);
	}

	.shortcuts {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.shortcuts kbd {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		padding: 0 var(--space-3xs);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
	}

	.resume-banner {
		margin: var(--space-md) 0;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-sm);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
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

	.summary div {
		display: flex;
		flex-direction: column;
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
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
		gap: var(--space-lg);
		margin-top: var(--space-md);
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.toc-list ol {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.entry {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.entry.active {
		border-color: var(--focus-ring);
	}

	.entry-row {
		appearance: none;
		background: transparent;
		border: 0;
		font: inherit;
		text-align: left;
		display: grid;
		grid-template-columns: max-content 1fr max-content max-content;
		gap: var(--space-sm);
		align-items: baseline;
		cursor: pointer;
		padding: 0;
		color: var(--ink-body);
	}

	.entry-row:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.entry-index {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		min-width: 2.5rem;
	}

	.entry-label {
		flex: 1;
	}

	.entry-page {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.outcomes {
		display: flex;
		gap: var(--space-2xs);
	}

	.outcome {
		appearance: none;
		font: inherit;
		font-size: var(--type-ui-label-size);
		padding: var(--space-2xs) var(--space-sm);
		min-width: 5rem;
		min-height: 2rem;
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.outcome:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.outcome:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.outcome:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.outcome[data-outcome='pass'].active {
		background: var(--signal-success-wash);
		color: var(--signal-success-ink);
		border-color: var(--signal-success-ink);
	}

	.outcome[data-outcome='fail'].active {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.outcome[data-outcome='blocked'].active {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-ink);
		border-color: var(--signal-warning-ink);
	}

	.row-error {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--signal-danger-ink);
	}

	.content-pane {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.detail {
		margin: 0 0 var(--space-sm);
		display: grid;
		grid-template-columns: max-content 1fr;
		row-gap: var(--space-3xs);
		column-gap: var(--space-md);
		font-size: var(--type-ui-label-size);
	}

	.detail dt {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.detail dd {
		margin: 0;
	}

	.entry-body {
		margin-top: var(--space-sm);
	}

	.entry-hint {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.paraphrase {
		margin: 0;
		color: var(--ink-body);
	}

	.session-meta {
		margin: var(--space-sm) 0 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.session-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.session {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		font-size: var(--type-ui-caption-size);
	}

	.session-when {
		color: var(--ink-body);
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

	.finish-panel h3 {
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
		border-color: var(--edge-strong);
	}

	.suggested-tag {
		font-size: var(--type-ui-caption-size);
		font-style: italic;
		color: var(--ink-muted);
		margin-left: var(--space-3xs);
	}

	.suggestion-text {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.confirm-text {
		margin: 0;
		color: var(--ink-body);
	}

	.confirm-row {
		display: flex;
		gap: var(--space-2xs);
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

	.missing {
		margin-top: var(--space-md);
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.missing h3,
	.missing h4 {
		margin: 0 0 var(--space-2xs);
	}

	.empty-actions {
		display: flex;
		gap: var(--space-md);
		margin: var(--space-sm) 0 0;
	}

	.action-link {
		color: var(--link-default);
	}

	.errors-h {
		margin-top: var(--space-md);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.errors {
		margin: var(--space-2xs) 0 0;
		padding-left: var(--space-md);
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.err-path {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}

	.muted {
		color: var(--ink-muted);
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
