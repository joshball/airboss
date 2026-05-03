<script lang="ts" module>
import {
	CITATION_CONTEXT_MAX_LENGTH,
	CITATION_TARGET_LABELS,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	EXTERNAL_REF_TARGET_DELIMITER,
	ROUTES,
} from '@ab/constants';

export interface CitationPickerSelection {
	targetType: CitationTargetType;
	targetId: string;
	note: string;
}

interface SearchResult {
	id: string;
	label: string;
	detail: string;
}
</script>

<script lang="ts">
/**
 * Shared citation picker.
 *
 * One dialog, N target-type tabs. Each tab is either:
 *   - a server-backed search (regulation nodes, AC refs, knowledge nodes),
 *     populated on demand from `/api/citations/search`
 *   - an inline URL+title form (external refs)
 *
 * `targetTypes` constrains which tabs the caller exposes. The picker is
 * controlled via `bind:open`; `onSelect` receives `{ targetType, targetId,
 * note }` and is responsible for submitting to the server (form action,
 * fetch, etc). The picker does not close automatically on submit -- the
 * caller decides, because a successful submit may want to show a toast
 * before closing.
 *
 * Target-id encoding for external refs: `${url}${EXTERNAL_REF_TARGET_DELIMITER}${title}`.
 * The BC layer splits this apart for rendering; this keeps the schema
 * single-column without a JSON side-table just for URLs.
 */

import { untrack } from 'svelte';
import Button from './Button.svelte';
import Dialog from './Dialog.svelte';

let {
	open = $bindable(false),
	targetTypes,
	onSelect,
	onCancel,
}: {
	open?: boolean;
	targetTypes: CitationTargetType[];
	onSelect: (selection: CitationPickerSelection) => void | Promise<void>;
	onCancel?: () => void;
} = $props();

const activeTypes = $derived(targetTypes.length > 0 ? targetTypes : [CITATION_TARGET_TYPES.REGULATION_NODE]);

// svelte-ignore state_referenced_locally -- initial seed from props; onTypesChanged keeps them in lockstep
let activeType = $state<CitationTargetType>(activeTypes[0]);
let query = $state('');
let results = $state<SearchResult[]>([]);
let loading = $state(false);
let fetchError = $state<string | null>(null);
let selectedId = $state<string | null>(null);
let note = $state('');
let externalUrl = $state('');
let externalTitle = $state('');
let submitting = $state(false);
let submitError = $state<string | null>(null);
// Monotonic search-request id. The previous `targetType === activeType`
// guard in `runSearch.finally` left `loading` stuck at `true` whenever the
// user switched tabs (notably to External-Ref) before a fetch resolved,
// because the in-flight resolution then no longer matched the active tab
// and silently skipped the `loading = false` reset. Tracking a token
// makes "is this the latest request?" a straight equality check that does
// not depend on which tab is active when the fetch returns.
let searchToken = 0;

// Per-instance id base for the tablist <-> tabpanel association. Each tab
// gets `${tabsBaseId}-tab-${type}` so multiple CitationPickers on the same
// page (rare but supported) don't collide on aria ids.
const tabsBaseId = $props.id();

// When the caller reconfigures targetTypes, reset the active tab to a valid
// one. The write is wrapped in `untrack` so the self-loop guard in this
// effect can't accidentally tighten into a real loop after a future edit.
$effect(() => {
	if (!activeTypes.includes(activeType)) {
		untrack(() => {
			activeType = activeTypes[0];
		});
	}
});

// When the dialog opens, reset transient state so a stale selection from a
// previous open cannot leak into the next citation.
$effect(() => {
	if (!open) return;
	query = '';
	results = [];
	selectedId = null;
	note = '';
	externalUrl = '';
	externalTitle = '';
	fetchError = null;
	submitError = null;
});

// Search debounce: 200ms after the last keystroke on a non-empty query.
// Empty query shows an empty state rather than firing a fetch for every
// tab switch.
let searchTimer: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	if (!open) return;
	if (activeType === CITATION_TARGET_TYPES.EXTERNAL_REF) {
		// Switching to External-Ref also bumps the token so any in-flight
		// fetch resolves into the "stale" branch and clears `loading`.
		searchToken += 1;
		results = [];
		loading = false;
		fetchError = null;
		return;
	}
	if (searchTimer) clearTimeout(searchTimer);
	const currentType = activeType;
	const currentQuery = query;
	searchTimer = setTimeout(() => {
		void runSearch(currentType, currentQuery);
	}, 200);
	return () => {
		if (searchTimer) clearTimeout(searchTimer);
	};
});

async function runSearch(targetType: CitationTargetType, q: string): Promise<void> {
	searchToken += 1;
	const myToken = searchToken;
	loading = true;
	fetchError = null;
	try {
		const params = new URLSearchParams({ target: targetType, q });
		const res = await fetch(`${ROUTES.API_CITATIONS_SEARCH}?${params.toString()}`, {
			headers: { accept: 'application/json' },
		});
		// Stale resolution: a newer search has been kicked off (or the user
		// switched to External-Ref). Drop the response without touching the
		// current results / loading state -- the newer request owns those.
		if (myToken !== searchToken) return;
		if (!res.ok) {
			fetchError = 'Could not load results.';
			results = [];
			return;
		}
		const body: { results?: SearchResult[] } = await res.json();
		if (myToken !== searchToken) return;
		results = body.results ?? [];
	} catch (err) {
		if (myToken !== searchToken) return;
		fetchError = err instanceof Error ? err.message : 'Could not load results.';
		results = [];
	} finally {
		// Only the latest in-flight request gets to clear the spinner. Stale
		// resolutions never touch `loading`, so they can't undo the spinner
		// the newer request just put up.
		if (myToken === searchToken) loading = false;
	}
}

function tabLabel(type: CitationTargetType): string {
	return CITATION_TARGET_LABELS[type];
}

function handleTabClick(type: CitationTargetType): void {
	activeType = type;
	selectedId = null;
	query = '';
	results = [];
	// Invalidate any in-flight search so its late resolution can't repaint
	// stale rows or leave the spinner up after the tab switch.
	searchToken += 1;
	loading = false;
}

const noteLength = $derived(note.trim().length);
const noteOver = $derived(noteLength > CITATION_CONTEXT_MAX_LENGTH);
const canSubmitExternal = $derived(externalUrl.trim().length > 0 && isHttpUrl(externalUrl.trim()));
const canSubmit = $derived(
	!noteOver &&
		!submitting &&
		(activeType === CITATION_TARGET_TYPES.EXTERNAL_REF ? canSubmitExternal : selectedId !== null),
);

function isHttpUrl(raw: string): boolean {
	try {
		const u = new URL(raw);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Roving-tabindex arrow navigation for the tablist. ArrowLeft/Right cycle
 * through tabs; Home/End jump to first/last. Mirrors the shared
 * `Tabs.svelte` keyboard contract.
 */
function handleTabKeyDown(event: KeyboardEvent, index: number): void {
	const last = activeTypes.length - 1;
	let nextIdx: number | null = null;
	switch (event.key) {
		case 'ArrowRight':
		case 'ArrowDown':
			nextIdx = index === last ? 0 : index + 1;
			break;
		case 'ArrowLeft':
		case 'ArrowUp':
			nextIdx = index === 0 ? last : index - 1;
			break;
		case 'Home':
			nextIdx = 0;
			break;
		case 'End':
			nextIdx = last;
			break;
	}
	if (nextIdx === null) return;
	event.preventDefault();
	const next = activeTypes[nextIdx];
	if (!next) return;
	handleTabClick(next);
	requestAnimationFrame(() => {
		document.getElementById(`${tabsBaseId}-tab-${next}`)?.focus();
	});
}

/**
 * Roving-tabindex arrow navigation for the results listbox. Activation
 * (selecting the option) happens on click; arrow keys move focus and
 * select-as-you-go so SR users hear the option's name.
 */
function handleResultKeyDown(event: KeyboardEvent, index: number): void {
	const last = results.length - 1;
	let nextIdx: number | null = null;
	switch (event.key) {
		case 'ArrowDown':
			nextIdx = index === last ? 0 : index + 1;
			break;
		case 'ArrowUp':
			nextIdx = index === 0 ? last : index - 1;
			break;
		case 'Home':
			nextIdx = 0;
			break;
		case 'End':
			nextIdx = last;
			break;
	}
	if (nextIdx === null) return;
	event.preventDefault();
	const next = results[nextIdx];
	if (!next) return;
	selectedId = next.id;
	requestAnimationFrame(() => {
		const buttons = document.querySelectorAll<HTMLButtonElement>('[role="listbox"] [role="option"]');
		buttons[nextIdx ?? 0]?.focus();
	});
}

async function submit(): Promise<void> {
	if (!canSubmit) return;
	submitting = true;
	submitError = null;
	try {
		const targetId =
			activeType === CITATION_TARGET_TYPES.EXTERNAL_REF
				? `${externalUrl.trim()}${EXTERNAL_REF_TARGET_DELIMITER}${externalTitle.trim()}`
				: (selectedId ?? '');
		await onSelect({
			targetType: activeType,
			targetId,
			note: note.trim(),
		});
	} catch (err) {
		submitError = err instanceof Error ? err.message : 'Could not add citation.';
	} finally {
		submitting = false;
	}
}

function cancel(): void {
	open = false;
	onCancel?.();
}
</script>

<Dialog bind:open ariaLabel="Cite a reference" size="lg" onClose={() => onCancel?.()}>
	{#snippet header()}
		<h2 class="title" data-testid="citationpicker-title">Cite a reference</h2>
	{/snippet}

	{#snippet body()}
		<span data-testid="citationpicker-body" data-active-type={activeType}></span>
		{#if activeTypes.length > 1}
			<div class="tabs" role="tablist" aria-label="Reference types" data-testid="citationpicker-tabs">
				{#each activeTypes as t, i (t)}
					<button
						type="button"
						role="tab"
						id={`${tabsBaseId}-tab-${t}`}
						aria-selected={activeType === t}
						aria-controls={`${tabsBaseId}-panel`}
						class="tab"
						class:active={activeType === t}
						data-testid={`citationpicker-tab-${t}`}
						data-state={activeType === t ? 'active' : 'idle'}
						tabindex={activeType === t ? 0 : -1}
						onclick={() => handleTabClick(t)}
						onkeydown={(e) => handleTabKeyDown(e, i)}
					>
						{tabLabel(t)}
					</button>
				{/each}
			</div>
		{/if}
		<div
			id={`${tabsBaseId}-panel`}
			role={activeTypes.length > 1 ? 'tabpanel' : undefined}
			aria-labelledby={activeTypes.length > 1 ? `${tabsBaseId}-tab-${activeType}` : undefined}
		>

		{#if activeType === CITATION_TARGET_TYPES.EXTERNAL_REF}
			<div class="external">
				<label class="field">
					<span class="label">URL</span>
					<input
						type="url"
						bind:value={externalUrl}
						placeholder="https://..."
						aria-invalid={externalUrl.length > 0 && !canSubmitExternal ? 'true' : undefined}
					/>
					{#if externalUrl.length > 0 && !canSubmitExternal}
						<span class="err">Must be a valid http(s) URL.</span>
					{/if}
				</label>
				<label class="field">
					<span class="label">Title <span class="hint">(optional)</span></span>
					<input type="text" bind:value={externalTitle} placeholder="Readable title for the link" />
				</label>
			</div>
		{:else}
			<label class="field">
				<span class="label">Search</span>
				<input
					type="search"
					bind:value={query}
					placeholder={`Search ${tabLabel(activeType).toLowerCase()}`}
					aria-label={`Search ${tabLabel(activeType)}`}
				/>
			</label>

			<div class="results" role="listbox" aria-label={`${tabLabel(activeType)} results`}>
				{#if loading}
					<div class="state">Loading...</div>
				{:else if fetchError}
					<div class="state error-state">{fetchError}</div>
				{:else if results.length === 0}
					<div class="state">
						{query.trim().length === 0
							? `Start typing to search ${tabLabel(activeType).toLowerCase()}.`
							: `No ${tabLabel(activeType).toLowerCase()} matches "${query}".`}
					</div>
				{:else}
					<!--
						Render `role="option"` buttons directly inside the listbox; the
						previous `<ul><li><button>` shape inserted listitem semantics
						that conflicted with the listbox role. Roving tabindex keeps a
						single tab stop so users can Tab past the result list to reach
						Confirm without traversing every row.
					-->
					{#each results as r, i (r.id)}
						<button
							type="button"
							role="option"
							aria-selected={selectedId === r.id}
							class="row"
							class:selected={selectedId === r.id}
							tabindex={selectedId === r.id || (selectedId === null && i === 0) ? 0 : -1}
							onclick={() => (selectedId = r.id)}
							onkeydown={(e) => handleResultKeyDown(e, i)}
						>
							<span class="row-label">{r.label}</span>
							<span class="row-detail">{r.detail}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}

		<label class="field">
			<span class="label">
				Note <span class="hint">(optional, max {CITATION_CONTEXT_MAX_LENGTH} chars)</span>
			</span>
			<textarea
				rows="2"
				bind:value={note}
				placeholder="Why is this citation relevant?"
				aria-invalid={noteOver ? 'true' : undefined}
			></textarea>
			<span class="counter" class:over={noteOver}>
				{noteLength} / {CITATION_CONTEXT_MAX_LENGTH}
			</span>
		</label>

		{#if submitError}
			<div class="submit-error" role="alert">{submitError}</div>
		{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="ghost" size="md" disabled={submitting} onclick={cancel}>
			<span data-testid="citationpicker-cancel">Cancel</span>
		</Button>
		<Button variant="primary" size="md" disabled={!canSubmit} onclick={submit}>
			<span data-testid="citationpicker-submit">{submitting ? 'Adding...' : 'Add cite'}</span>
		</Button>
	{/snippet}
</Dialog>

<style>
	.title {
		margin: 0;
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-lg);
		color: var(--ink-body);
	}

	.tabs {
		display: flex;
		gap: var(--space-xs);
		border-bottom: 1px solid var(--edge-default);
		margin-bottom: var(--space-md);
		flex-wrap: wrap;
	}

	.tab {
		background: transparent;
		border: none;
		padding: var(--space-sm) var(--space-md);
		color: var(--ink-muted);
		cursor: pointer;
		font: inherit;
		border-bottom: 2px solid transparent;
	}

	.tab:hover {
		color: var(--ink-body);
	}

	.tab.active {
		color: var(--action-default-active);
		border-bottom-color: var(--action-default);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin-bottom: var(--space-md);
	}

	.label {
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		color: var(--ink-strong);
	}

	.hint {
		font-weight: 400;
		color: var(--ink-faint);
	}

	input,
	textarea {
		font: inherit;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-md);
		background: var(--input-default-bg);
		color: var(--ink-body);
	}

	textarea {
		resize: vertical;
		min-height: 3rem;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--action-default);
		box-shadow: var(--focus-ring-shadow);
	}

	.results {
		max-height: 18rem;
		overflow-y: auto;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}

	.state {
		padding: var(--space-lg);
		color: var(--ink-faint);
		text-align: center;
		font-size: var(--type-ui-label-size);
	}

	.error-state {
		color: var(--action-hazard-active);
	}

	.row {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-md);
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--edge-subtle);
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--ink-body);
	}

	.row:hover {
		background: var(--surface-muted);
	}

	.row.selected {
		background: var(--action-default-wash);
		color: var(--action-default-active);
	}

	.row-label {
		font-weight: 500;
	}

	.row-detail {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.counter {
		align-self: flex-end;
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
	}

	.counter.over {
		color: var(--action-hazard-active);
	}

	.err {
		font-size: var(--type-ui-caption-size);
		color: var(--action-hazard-active);
	}

	.submit-error {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--action-hazard-wash);
		border: 1px solid var(--action-hazard-edge);
		color: var(--action-hazard-active);
		font-size: var(--type-ui-label-size);
	}

	.external {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}
</style>
