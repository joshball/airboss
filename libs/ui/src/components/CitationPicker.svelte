<script lang="ts" module>
import {
	CITATION_CONTEXT_MAX_LENGTH,
	CITATION_TARGET_LABELS,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
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
 * Target-id encoding for external refs: `${url}|${title}`. The BC layer
 * splits this apart for rendering; this keeps the schema single-column
 * without a JSON side-table just for URLs.
 */

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

// When the caller reconfigures targetTypes, reset the active tab to a valid one.
$effect(() => {
	if (!activeTypes.includes(activeType)) {
		activeType = activeTypes[0];
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
		results = [];
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
	loading = true;
	fetchError = null;
	try {
		const params = new URLSearchParams({ target: targetType, q });
		const res = await fetch(`${ROUTES.API_CITATIONS_SEARCH}?${params.toString()}`, {
			headers: { accept: 'application/json' },
		});
		if (!res.ok) {
			fetchError = 'Could not load results.';
			results = [];
			return;
		}
		const body: { results?: SearchResult[] } = await res.json();
		// If the user switched tabs before the fetch resolved, drop the result
		// set to avoid flashing stale rows from a different target type.
		if (targetType !== activeType) return;
		results = body.results ?? [];
	} catch (err) {
		fetchError = err instanceof Error ? err.message : 'Could not load results.';
		results = [];
	} finally {
		if (targetType === activeType) loading = false;
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

async function submit(): Promise<void> {
	if (!canSubmit) return;
	submitting = true;
	submitError = null;
	try {
		const targetId =
			activeType === CITATION_TARGET_TYPES.EXTERNAL_REF
				? `${externalUrl.trim()}|${externalTitle.trim()}`
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
		<div class="header-row">
			<span class="title">Cite a reference</span>
			<span class="kbd">Esc to close</span>
		</div>
	{/snippet}

	{#snippet body()}
		{#if activeTypes.length > 1}
			<div class="tabs" role="tablist" aria-label="Reference types">
				{#each activeTypes as t (t)}
					<button
						type="button"
						role="tab"
						aria-selected={activeType === t}
						class="tab"
						class:active={activeType === t}
						onclick={() => handleTabClick(t)}
					>
						{tabLabel(t)}
					</button>
				{/each}
			</div>
		{/if}

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
					<ul class="list">
						{#each results as r (r.id)}
							<li>
								<button
									type="button"
									role="option"
									aria-selected={selectedId === r.id}
									class="row"
									class:selected={selectedId === r.id}
									onclick={() => (selectedId = r.id)}
								>
									<span class="row-label">{r.label}</span>
									<span class="row-detail">{r.detail}</span>
								</button>
							</li>
						{/each}
					</ul>
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
	{/snippet}

	{#snippet footer()}
		<button type="button" class="btn ghost" onclick={cancel} disabled={submitting}>Cancel</button>
		<button type="button" class="btn primary" onclick={submit} disabled={!canSubmit}>
			{submitting ? 'Adding...' : 'Add cite'}
		</button>
	{/snippet}
</Dialog>

<style>
	.header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.title {
		font-weight: var(--font-weight-semibold);
	}

	.kbd {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
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
		background: var(--ink-inverse);
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

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
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

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--type-definition-body-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--action-default-hover);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover:not(:disabled) {
		background: var(--surface-sunken);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
