<script lang="ts">
import { APP_SURFACES, HELP_SEARCH_DEBOUNCE_MS } from '@ab/constants';
import {
	COLUMN_LABELS,
	COLUMN_ORDER,
	type GroupedResults,
	type PaletteHost,
	type ResultColumn,
	searchGrouped,
	type TypedSearchResult as SearchResult,
} from '@ab/help';
import { accentFor } from '@ab/help/ui/palette-accent';
import PaletteDetailPane from '@ab/help/ui/PaletteDetailPane.svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import '@ab/help/ui/palette-tokens.css';

/**
 * Variant B — narrow column + always-on detail pane.
 *
 * Two-pane shape: narrow result list on the left, permanent right-side
 * detail pane. Closest to Raycast / Spotlight. The detail pane is the
 * same `PaletteDetailPane` the production palette uses, so any Variant
 * B refinement (e.g. wider snippet, action-button changes) flows
 * straight to the production palette.
 */

let rawQuery = $state('');
let debouncedQuery = $state('');
let serverInjected = $state<readonly SearchResult[]>([]);
let pendingFetch = $state(false);
let lastFetchedQuery = $state<string | null>(null);

const host: PaletteHost = $derived<PaletteHost>({
	surface: APP_SURFACES.DASHBOARD,
	userId: page.data?.user?.id,
});
const grouped = $derived<GroupedResults>(searchGrouped(debouncedQuery, host, serverInjected));

const flat = $derived<readonly { col: ResultColumn; result: SearchResult }[]>(
	(() => {
		const out: { col: ResultColumn; result: SearchResult }[] = [];
		for (const col of COLUMN_ORDER) {
			for (const result of grouped.columns[col]) {
				out.push({ col, result });
			}
		}
		return out;
	})(),
);

let highlightedIndex = $state(0);
const highlighted = $derived<SearchResult | null>(flat[highlightedIndex]?.result ?? null);

$effect(() => {
	void debouncedQuery;
	highlightedIndex = 0;
});

$effect(() => {
	const next = rawQuery;
	if (next === debouncedQuery) return;
	const handle = window.setTimeout(() => {
		debouncedQuery = next;
	}, HELP_SEARCH_DEBOUNCE_MS);
	return () => window.clearTimeout(handle);
});

$effect(() => {
	const q = debouncedQuery.trim();
	if (q.length === 0) {
		serverInjected = [];
		lastFetchedQuery = q;
		pendingFetch = false;
		return;
	}
	if (q === lastFetchedQuery) return;
	if (!host.userId) {
		pendingFetch = false;
		return;
	}
	const controller = new AbortController();
	pendingFetch = true;
	(async () => {
		try {
			const res = await fetch('/api/palette/search', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ q }),
				signal: controller.signal,
			});
			if (!res.ok) return;
			const data = (await res.json()) as { results?: SearchResult[] };
			if (Array.isArray(data.results)) {
				serverInjected = data.results;
				lastFetchedQuery = q;
			}
		} catch {
			// quiet
		} finally {
			if (!controller.signal.aborted) pendingFetch = false;
		}
	})();
	return () => controller.abort();
});

function activate(result: SearchResult): void {
	const path = result.href;
	if (path.startsWith('http://') || path.startsWith('https://')) {
		window.open(path, '_blank', 'noopener');
		return;
	}
	void goto(path);
}

function handleKey(event: KeyboardEvent): void {
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		if (flat.length > 0) highlightedIndex = (highlightedIndex + 1) % flat.length;
		return;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		if (flat.length > 0) highlightedIndex = (highlightedIndex - 1 + flat.length) % flat.length;
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		const focused = flat[highlightedIndex];
		if (focused) activate(focused.result);
	}
}

function onSearchInside(_docCode: string): void {
	// Variant B mirrors the production behavior: set a doc: chip and
	// refocus. The input element is right here so we just rewrite + reset.
	rawQuery = `doc:${_docCode} `;
}
</script>

<svelte:head>
	<title>Palette · Variant B (raycast) — airboss</title>
</svelte:head>

<div class="wrap" data-palette-tokens>
	<header class="page-header">
		<p class="back"><a href="/dev/palette">← back to variants</a></p>
		<h1>Variant B — narrow column + always-on detail pane</h1>
		<p class="lede">
			Two panes, Raycast-style. {pendingFetch ? 'Loading…' : `${grouped.totalCount} results`}
		</p>
	</header>

	<div class="panel">
		<div class="list">
			<input
				bind:value={rawQuery}
				onkeydown={handleKey}
				type="search"
				class="input"
				placeholder="Search the platform..."
				autocomplete="off"
				spellcheck="false"
				aria-label="Search query"
				data-testid="palette-raycast-input"
			/>

			<ul role="listbox" aria-label="Search results">
				{#each COLUMN_ORDER as col (col)}
					{#if grouped.columns[col].length > 0}
						<li class="section-header" aria-hidden="true">{COLUMN_LABELS[col]}</li>
						{#each grouped.columns[col] as result (result.id)}
							{@const flatIdx = flat.findIndex((r) => r.result.id === result.id)}
							{@const accent = accentFor(result.type)}
							<li role="option" aria-selected={flatIdx === highlightedIndex}>
								<button
									type="button"
									class="row"
									data-accent={accent}
									class:highlighted={flatIdx === highlightedIndex}
									onmouseenter={() => (highlightedIndex = flatIdx)}
									onclick={() => activate(result)}
								>
									<span class="title">{result.title}</span>
									{#if result.subtitle}
										<span class="subtitle">{result.subtitle}</span>
									{/if}
								</button>
							</li>
						{/each}
					{/if}
				{/each}
				{#if flat.length === 0 && debouncedQuery.trim().length > 0}
					<li class="empty">No matches.</li>
				{/if}
			</ul>
		</div>

		<PaletteDetailPane
			result={highlighted}
			onOpen={activate}
			onSearchInside={onSearchInside}
		/>
	</div>
</div>

<style>
	.wrap {
		max-width: 64rem;
		margin: 0 auto;
		padding: var(--space-lg) var(--space-xl);
	}

	.page-header h1 {
		font-size: var(--font-size-xl);
		margin: var(--space-sm) 0;
	}

	.back a {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.lede {
		color: var(--ink-muted);
	}

	.panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		gap: 0;
		min-height: 28rem;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-panel);
		margin-top: var(--space-md);
	}

	.list {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.input {
		padding: var(--space-md);
		font-size: var(--font-size-base);
		border: 0;
		border-bottom: 1px solid var(--edge-default);
		background: transparent;
		color: inherit;
		outline: none;
	}

	.input:focus-visible {
		box-shadow: 0 0 0 2px var(--focus-ring) inset;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: var(--space-xs);
		overflow-y: auto;
		flex: 1;
	}

	.section-header {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		padding: var(--space-sm) var(--space-2xs) var(--space-xs);
	}

	.row {
		display: grid;
		gap: var(--space-3xs);
		width: 100%;
		text-align: left;
		font: inherit;
		padding: var(--space-sm);
		background: transparent;
		border: 0;
		border-left: 3px solid transparent;
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		cursor: pointer;
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
	}

	.row[data-accent='amber'] { border-left-color: var(--palette-accent-amber-edge); }
	.row[data-accent='violet'] { border-left-color: var(--palette-accent-violet-edge); }
	.row[data-accent='cyan']  { border-left-color: var(--palette-accent-cyan-edge); }
	.row[data-accent='green']  { border-left-color: var(--palette-accent-green-edge); }
	.row[data-accent='rose']   { border-left-color: var(--palette-accent-rose-edge); }
	.row[data-accent='cmd']    { border-left-color: var(--palette-accent-cmd-edge); }

	.row.highlighted[data-accent='amber'] { background: var(--palette-accent-amber-wash); }
	.row.highlighted[data-accent='violet'] { background: var(--palette-accent-violet-wash); }
	.row.highlighted[data-accent='cyan']  { background: var(--palette-accent-cyan-wash); }
	.row.highlighted[data-accent='green']  { background: var(--palette-accent-green-wash); }
	.row.highlighted[data-accent='rose']   { background: var(--palette-accent-rose-wash); }

	.title {
		font-weight: var(--font-weight-semibold);
	}

	.subtitle {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}

	.empty {
		padding: var(--space-md);
		color: var(--ink-subtle);
	}
</style>
