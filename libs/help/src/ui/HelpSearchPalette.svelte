<script lang="ts">
import { APP_SURFACES, type AppSurface, HELP_SEARCH_DEBOUNCE_MS } from '@ab/constants';
import { createFocusTrap, type FocusTrap } from '@ab/ui/lib/focus-trap';
import { tick, untrack } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ParsedFilter } from '../schema/help-registry';
import {
	COLUMN_LABELS,
	COLUMN_ORDER,
	type GroupedResults,
	type PaletteHost,
	type ResultColumn,
	type SearchResult,
	type SynonymRewrite,
} from '../schema/result-types';
import { searchGrouped } from '../search';
import FilterChips from './FilterChips.svelte';

/**
 * Multi-column command palette overlay.
 *
 * Phase 2 of the command-palette WP -- this component is the surface that
 * binds Cmd+K / `/` (and Phase 4/5 Cmd+P / Cmd+Shift+P). It renders a typed
 * `GroupedResults` produced by `searchGrouped()`: a banner-hoist row, FAA
 * Resources / Airboss Content / App Help / My Stuff / External Tools
 * columns, removable filter chips above the input, and an empty Commands
 * column reserved for Phase 4.
 *
 * Keyboard:
 *   - Arrow up/down: move selection within the focused column.
 *   - Tab / Shift+Tab + `[` / `]`: jump selection between non-empty columns.
 *   - Enter: navigate to the selected result (or banner row when present).
 *   - Escape: close.
 *
 * Performance:
 *   - Search debounces by HELP_SEARCH_DEBOUNCE_MS so a fast typist fires at
 *     most one search per window.
 *   - Loaders run in-process; DB-backed loaders are server-side and feed in
 *     via the `injected` argument to `searchGrouped` (Phase 2c wires the
 *     server hand-off; in Phase 2 the in-process loaders cover the most
 *     used queries).
 */

let {
	open,
	onClose,
	surface,
	injectedResults,
}: {
	open: boolean;
	onClose: () => void;
	/**
	 * Host surface for per-app boost. Defaults to `global` if not provided
	 * (used by callers that don't know which app mounted them, e.g. the
	 * legacy HelpSearch.svelte trigger).
	 */
	surface?: AppSurface;
	/**
	 * Server-loaded rows (cards / reps / plans / knowledge nodes / handbook
	 * sections / CFR sections / AIM sections) merged into the columns before
	 * sorting. Empty by default.
	 */
	injectedResults?: readonly SearchResult[];
} = $props();

const host: PaletteHost = $derived<PaletteHost>({
	surface: surface ?? APP_SURFACES.GLOBAL,
	userId: page.data?.user?.id,
});

let input = $state<HTMLInputElement | null>(null);
let rawQuery = $state('');
let debouncedQuery = $state('');

/**
 * DB-backed loader output fetched from the per-app `/api/palette/search`
 * endpoint. The in-process facade composes this with the synchronous
 * loaders so the user sees the synchronous slice immediately and the
 * server slice merges in when the response lands. The fallback is the
 * caller-supplied `injectedResults` prop so SSR-injected rows still work.
 */
let serverInjected = $state<readonly SearchResult[]>([]);
let lastFetchedQuery = $state<string | null>(null);

const mergedInjected = $derived<readonly SearchResult[]>(
	serverInjected.length > 0 ? serverInjected : (injectedResults ?? []),
);
const grouped = $derived<GroupedResults>(searchGrouped(debouncedQuery, host, mergedInjected));

let focusedColumn = $state<ResultColumn>('faa-resources');
let focusedIndex = $state(0);

const nonEmptyColumns = $derived<ResultColumn[]>(COLUMN_ORDER.filter((c) => grouped.columns[c].length > 0));

$effect(() => {
	const next = rawQuery;
	if (next === debouncedQuery) return;
	const handle = window.setTimeout(() => {
		debouncedQuery = next;
	}, HELP_SEARCH_DEBOUNCE_MS);
	return () => window.clearTimeout(handle);
});

// Fetch DB-backed loader output every time the debounced query changes.
// AbortController guards against an in-flight slow response landing AFTER
// a newer query has already fired. The endpoint short-circuits empty
// queries server-side, so calling fetch on an empty needle is cheap.
$effect(() => {
	const q = debouncedQuery.trim();
	if (q.length === 0) {
		serverInjected = [];
		lastFetchedQuery = q;
		return;
	}
	if (q === lastFetchedQuery) return;
	const controller = new AbortController();
	const url = '/api/palette/search';
	(async () => {
		try {
			const res = await fetch(url, {
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
			// Network errors / aborts: leave serverInjected alone. The in-process
			// facade still surfaces aviation refs / help pages / external tools.
		}
	})();
	return () => controller.abort();
});

// Reset selection whenever the debounced query lands. Depend only on
// `debouncedQuery` (not `grouped`) so the effect never reads state it writes.
$effect(() => {
	void debouncedQuery;
	focusedIndex = 0;
	const cols = untrack(() => nonEmptyColumns);
	focusedColumn = cols[0] ?? 'faa-resources';
});

// Focus-trap lifecycle: allocated once per dialog-open, released on close.
let panelEl = $state<HTMLDivElement | null>(null);
let trap: FocusTrap | null = null;
let previousFocus: HTMLElement | null = null;

$effect(() => {
	if (!open) return;
	untrack(() => {
		previousFocus = (document.activeElement as HTMLElement | null) ?? null;
	});
	void tick().then(() => {
		if (panelEl) {
			trap = createFocusTrap(panelEl, { onEscape: onClose });
		}
		input?.focus();
	});
	return () => {
		trap?.release();
		trap = null;
		previousFocus?.focus?.();
		previousFocus = null;
	};
});

function currentList(): readonly SearchResult[] {
	return grouped.columns[focusedColumn] ?? [];
}

function handleKey(event: KeyboardEvent): void {
	trap?.handleKeyDown(event);
	if (event.defaultPrevented) return;
	if (event.key === 'Escape') {
		event.preventDefault();
		onClose();
		return;
	}
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		const list = currentList();
		if (list.length > 0) focusedIndex = (focusedIndex + 1) % list.length;
		return;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		const list = currentList();
		if (list.length > 0) focusedIndex = (focusedIndex - 1 + list.length) % list.length;
		return;
	}
	if (event.key === ']' || (event.key === 'Tab' && !event.shiftKey)) {
		event.preventDefault();
		jumpColumn(1);
		return;
	}
	if (event.key === '[' || (event.key === 'Tab' && event.shiftKey)) {
		event.preventDefault();
		jumpColumn(-1);
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		// Banner takes precedence when present + focus is on the input (no row
		// explicitly selected). Otherwise activate the row at (column, index).
		if (grouped.bannerHit && focusedIndex === 0 && nonEmptyColumns[0] === focusedColumn) {
			activate(grouped.bannerHit);
			return;
		}
		const result = currentList()[focusedIndex];
		if (result) activate(result);
	}
}

function jumpColumn(direction: 1 | -1): void {
	const cols = nonEmptyColumns;
	if (cols.length === 0) return;
	const idx = cols.indexOf(focusedColumn);
	const baseIdx = idx === -1 ? 0 : idx;
	const next = cols[(baseIdx + direction + cols.length) % cols.length] ?? cols[0];
	if (next) {
		focusedColumn = next;
		focusedIndex = 0;
	}
}

function activate(result: SearchResult): void {
	const path = result.href;
	onClose();
	if (path.startsWith('http://') || path.startsWith('https://')) {
		window.open(path, '_blank', 'noopener');
		return;
	}
	void goto(path);
}

function backdropClick(event: MouseEvent): void {
	if (event.target === event.currentTarget) onClose();
}

function backdropKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.preventDefault();
		onClose();
	}
}

function removeFilter(key: string, value: string): void {
	// Naive rewrite: strip the `key:value` token (and any escaped variants)
	// from rawQuery. The query parser is forgiving; if the user typed
	// `tag:weather,ifr` removing just `weather` rewrites to `tag:ifr`.
	rawQuery = rebuildQueryWithoutFilter(rawQuery, key, value);
}

function removeSynonym(from: string): void {
	// Stripping a synonym chip removes the underlying token that triggered
	// the rewrite. Same approach as filter removal.
	rawQuery = stripBareToken(rawQuery, from);
}

function rebuildQueryWithoutFilter(query: string, key: string, value: string): string {
	// Mine sugar: `library:mine` displays as a chip but the original token
	// might have been a bare `mine`. Strip both shapes.
	if (key === 'library' && value === 'mine') {
		return stripBareToken(stripFacetToken(query, 'library', 'mine'), 'mine');
	}
	return stripFacetToken(query, key, value);
}

function stripFacetToken(query: string, key: string, value: string): string {
	const tokens = query.split(/\s+/).filter(Boolean);
	const filtered: string[] = [];
	for (const token of tokens) {
		const lower = token.toLowerCase();
		const prefix = `${key.toLowerCase()}:`;
		if (!lower.startsWith(prefix)) {
			filtered.push(token);
			continue;
		}
		const values = token
			.slice(prefix.length)
			.split(',')
			.filter((v) => v.toLowerCase() !== value.toLowerCase());
		if (values.length > 0) {
			filtered.push(`${key}:${values.join(',')}`);
		}
	}
	return filtered.join(' ').trim();
}

function stripBareToken(query: string, token: string): string {
	return query
		.split(/\s+/)
		.filter(Boolean)
		.filter((t) => t.toLowerCase() !== token.toLowerCase())
		.join(' ')
		.trim();
}

function activateBanner(): void {
	if (grouped.bannerHit) activate(grouped.bannerHit);
}

function activateRow(result: SearchResult): void {
	activate(result);
}

// Bound for the FilterChips child.
const chipFilters = $derived<readonly ParsedFilter[]>(grouped.filters);
const chipSynonyms = $derived<readonly SynonymRewrite[]>(grouped.synonymsApplied);
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="backdrop"
		onclick={backdropClick}
		onkeydown={backdropKeydown}
		role="presentation"
		data-testid="helpsearchpalette-backdrop"
	>
		<div
			bind:this={panelEl}
			id="helpsearch-palette"
			class="palette"
			role="dialog"
			aria-modal="true"
			aria-label="Search palette"
			data-testid="helpsearchpalette-root"
			data-focused-bucket={focusedColumn}
		>
			<div class="input-row">
				<input
					bind:this={input}
					bind:value={rawQuery}
					onkeydown={handleKey}
					type="search"
					placeholder="Search (try `metar`, `Part 91`, `doc:FAA-H-8083-28 turb`, `mine`)"
					autocomplete="off"
					spellcheck="false"
					aria-label="Search query"
					data-testid="helpsearchpalette-input"
				/>
			</div>

			<FilterChips
				filters={chipFilters}
				synonymsApplied={chipSynonyms}
				onRemoveFilter={removeFilter}
				onRemoveSynonym={removeSynonym}
			/>

			{#if grouped.bannerHit}
				<button
					type="button"
					class="banner"
					onclick={activateBanner}
					data-testid="palette-banner"
				>
					<span class="banner-kind">Open</span>
					<span class="banner-title">{grouped.bannerHit.title}</span>
					{#if grouped.bannerHit.subtitle}
						<span class="banner-subtitle">{grouped.bannerHit.subtitle}</span>
					{/if}
					<span class="banner-arrow" aria-hidden="true">→</span>
				</button>
			{/if}

			<div class="columns" data-testid="palette-columns">
				{#each COLUMN_ORDER as col (col)}
					<section
						class="column"
						aria-labelledby="col-heading-{col}"
						data-column={col}
						data-active={focusedColumn === col ? 'true' : 'false'}
					>
						<header>
							<span class="label" id="col-heading-{col}">{COLUMN_LABELS[col]}</span>
							<span class="count">{grouped.columns[col].length}</span>
						</header>
						{#if grouped.columns[col].length === 0}
							<p class="hint">
								{col === 'commands'
									? 'Phase 4'
									: 'No hits'}
							</p>
						{:else}
							<ul>
								{#each grouped.columns[col] as result, index (result.id)}
									<li
										class:focused={focusedColumn === col && focusedIndex === index}
										aria-current={focusedColumn === col && focusedIndex === index ? 'true' : undefined}
									>
										<button
											type="button"
											onclick={() => activateRow(result)}
											data-result-id={result.id}
											data-result-type={result.type}
										>
											{#if result.subtitle}
												<span class="tag">{result.subtitle}</span>
											{:else}
												<span class="tag">{result.type}</span>
											{/if}
											<span class="title">{result.title}</span>
											{#if result.snippet}
												<span class="snippet">{result.snippet}</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</section>
				{/each}
			</div>

			{#if rawQuery.trim().length === 0}
				<p class="empty-hint">
					Start typing. Try a doc code (`FAA-H-8083-28`, `Part 91`, `AIM 7-1`), an alias (`AvWX`, `PHAK`), a term
					(`metar`, `density altitude`), or a filter (`doc:`, `kind:`, `mine`).
				</p>
			{/if}

			<footer class="shortcuts">
				<span><kbd>Tab</kbd> / <kbd>[</kbd> <kbd>]</kbd> jump column</span>
				<span><kbd>Enter</kbd> open</span>
				<span><kbd>Esc</kbd> close</span>
			</footer>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: var(--overlay-scrim);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		/* lint-disable-token-enforcement: viewport offset positions palette in upper third, not on spacing rhythm */
		padding-top: 4rem;
		z-index: var(--z-command-palette);
	}

	.palette {
		width: min(72rem, 96vw);
		max-height: 84vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.input-row {
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--edge-default);
	}

	input {
		width: 100%;
		border: 0;
		outline: none;
		font-size: var(--font-size-base);
		padding: var(--space-sm) 0;
		background: transparent;
		color: inherit;
	}

	input:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border: 0;
		border-bottom: 1px solid var(--edge-default);
		background: var(--action-default-wash);
		font: inherit;
		font-size: var(--font-size-base);
		color: inherit;
		text-align: left;
		cursor: pointer;
	}

	.banner:hover,
	.banner:focus-visible {
		background: var(--action-default);
		color: var(--action-default-ink);
		outline: none;
	}

	.banner-kind {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.banner-title {
		font-weight: var(--font-weight-semibold);
	}

	.banner-subtitle {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.banner-arrow {
		margin-left: auto;
	}

	.columns {
		overflow-y: auto;
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		flex: 1;
	}

	.column {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.column[data-active='true'] header .label {
		color: var(--ink-body);
	}

	.column header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}

	.column .count {
		font-variant-numeric: tabular-nums;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0 var(--space-sm);
		font-size: var(--font-size-xs);
	}

	.column ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.column li.focused button {
		background: var(--action-default-wash);
		border-color: var(--action-default);
	}

	.column button {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3xs);
		width: 100%;
		text-align: left;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.column button:hover {
		background: var(--surface-sunken);
	}

	.column button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.tag {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.title {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.snippet {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint,
	.empty-hint {
		margin: var(--space-sm) 0 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.empty-hint {
		padding: 0 var(--space-lg) var(--space-md);
	}

	.shortcuts {
		display: flex;
		gap: var(--space-lg);
		border-top: 1px solid var(--edge-default);
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
	}

	kbd {
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		background: var(--surface-sunken);
	}

	@media (max-width: 1100px) {
		.columns {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 640px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
</style>
