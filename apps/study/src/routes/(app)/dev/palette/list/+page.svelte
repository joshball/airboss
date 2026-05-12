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
import { goto } from '$app/navigation';
import { page } from '$app/state';
import '@ab/help/ui/palette-tokens.css';

/**
 * Variant A — Linear-style sectioned list.
 *
 * Single column, category dividers, no detail pane. Same data fetching as
 * Variant C; only the render tree differs. The query input + debounced
 * server fetch + ranker are identical -- this prototype intentionally
 * uses the shared `searchGrouped` facade so a future merge between the
 * variants stays mechanical.
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

let highlightedId = $state<string | null>(null);

const flatResults = $derived<readonly { col: ResultColumn; result: SearchResult }[]>(
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

const focusedIndex = $derived<number>(
	(() => {
		if (highlightedId === null) return 0;
		const idx = flatResults.findIndex((r) => r.result.id === highlightedId);
		return idx === -1 ? 0 : idx;
	})(),
);

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
		const next = flatResults[(focusedIndex + 1) % flatResults.length];
		highlightedId = next?.result.id ?? null;
		return;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		const len = flatResults.length;
		if (len === 0) return;
		const prev = flatResults[(focusedIndex - 1 + len) % len];
		highlightedId = prev?.result.id ?? null;
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		const focused = flatResults[focusedIndex];
		if (focused) activate(focused.result);
	}
}
</script>

<svelte:head>
	<title>Palette · Variant A (list) — airboss</title>
</svelte:head>

<div class="wrap" data-palette-tokens>
	<header class="page-header">
		<p class="back"><a href="/dev/palette">← back to variants</a></p>
		<h1>Variant A — Linear-style sectioned list</h1>
		<p class="lede">
			Single column, category dividers, no detail pane. {pendingFetch ? 'Loading…' : `${grouped.totalCount} results`}
		</p>
	</header>

	<input
		bind:value={rawQuery}
		onkeydown={handleKey}
		type="search"
		class="input"
		placeholder="Search the platform..."
		autocomplete="off"
		spellcheck="false"
		aria-label="Search query"
		data-testid="palette-list-input"
	/>

	{#if grouped.bannerHit}
		<button
			type="button"
			class="banner"
			data-accent={accentFor(grouped.bannerHit.type)}
			onclick={() => activate(grouped.bannerHit!)}
			data-testid="palette-list-banner"
		>
			<span class="banner-kind">{grouped.bannerHit.type}</span>
			<span class="banner-title">{grouped.bannerHit.title}</span>
			{#if grouped.bannerHit.subtitle}
				<span class="banner-subtitle">{grouped.bannerHit.subtitle}</span>
			{/if}
		</button>
	{/if}

	<ul class="results" role="listbox" aria-label="Search results">
		{#each COLUMN_ORDER as col (col)}
			{#if grouped.columns[col].length > 0}
				<li class="section-header" aria-hidden="true">{COLUMN_LABELS[col]}</li>
				{#each grouped.columns[col] as result (result.id)}
					{@const accent = accentFor(result.type)}
					<li role="option" aria-selected={highlightedId === result.id}>
						<button
							type="button"
							class="row"
							data-accent={accent}
							class:highlighted={highlightedId === result.id}
							onmouseenter={() => (highlightedId = result.id)}
							onclick={() => activate(result)}
						>
							<span class="tag" data-accent={accent}>{result.subtitle ?? result.type}</span>
							<span class="title">{result.title}</span>
							{#if result.snippet}
								<span class="snippet">{result.snippet}</span>
							{/if}
						</button>
					</li>
				{/each}
			{/if}
		{/each}
		{#if flatResults.length === 0 && debouncedQuery.trim().length > 0}
			<li class="empty">No matches.</li>
		{/if}
	</ul>
</div>

<style>
	.wrap {
		max-width: 48rem;
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

	.input {
		display: block;
		width: 100%;
		padding: var(--space-md);
		font-size: var(--font-size-base);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
		color: inherit;
		outline: none;
	}

	.input:focus-visible {
		box-shadow: 0 0 0 2px var(--focus-ring);
	}

	.banner {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin: var(--space-md) 0 0;
		padding: var(--space-md);
		border: 0;
		border-radius: var(--radius-md);
		background: var(--palette-accent-amber-wash);
		text-align: left;
		font: inherit;
		cursor: pointer;
	}

	.results {
		list-style: none;
		margin: var(--space-md) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	.section-header {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		padding: var(--space-sm) var(--space-2xs) var(--space-xs);
		border-bottom: 1px solid var(--edge-subtle);
		margin-top: var(--space-sm);
	}

	.row {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		row-gap: var(--space-3xs);
		column-gap: var(--space-sm);
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

	.tag {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		grid-column: 1;
		grid-row: 1 / span 2;
		align-self: center;
		color: var(--ink-muted);
	}

	.tag[data-accent='amber'] { color: var(--palette-accent-amber); }
	.tag[data-accent='violet'] { color: var(--palette-accent-violet); }
	.tag[data-accent='cyan']  { color: var(--palette-accent-cyan); }
	.tag[data-accent='green']  { color: var(--palette-accent-green); }
	.tag[data-accent='rose']   { color: var(--palette-accent-rose); }

	.title {
		font-weight: var(--font-weight-semibold);
		grid-column: 2;
		grid-row: 1;
	}

	.snippet {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		grid-column: 2;
		grid-row: 2;
	}

	.empty {
		color: var(--ink-subtle);
		padding: var(--space-md);
	}
</style>
