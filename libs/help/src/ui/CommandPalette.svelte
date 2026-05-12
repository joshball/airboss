<script lang="ts">
import { APP_SURFACES, type AppSurface, HELP_SEARCH_DEBOUNCE_MS } from '@ab/constants';
import { createFocusTrap, type FocusTrap } from '@ab/ui/lib/focus-trap';
import { tick, untrack } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ParsedFilter } from '../schema/help-registry';
import { PALETTE_MODE_ELIGIBLE, type PaletteMode } from '../schema/palette-mode';
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
import DocCodeAutocomplete, { type DocEntry } from './DocCodeAutocomplete.svelte';
import FilterChips from './FilterChips.svelte';
import PaletteColumn from './PaletteColumn.svelte';
import PaletteDetailPane from './PaletteDetailPane.svelte';
import '@ab/themes/palette-tokens.css';

/**
 * Production command palette -- the Cmd+K / `/` (search), Cmd+P (quick
 * open), Cmd+Shift+P (command) surface. Replaces `HelpSearchPalette` as
 * the default mount for every app's nav-integrated search affordance.
 *
 * Visual variant: C, the "wide 4-column grid + right detail pane"
 * mockup from `docs/work/plans/2026-05-10-palette-mockup.html`. The grid
 * shows up to four columns at full width and shrinks to three when the
 * detail pane is open; below ~900px the detail pane hides entirely and
 * the layout returns to a four-column grid.
 *
 * Phase 3 wires:
 *
 *   - `DocCodeAutocomplete.svelte` under the input (APG combobox).
 *   - `PaletteDetailPane.svelte` on the right (toggle via `Cmd+\`).
 *   - Per-type accent borders + chips via `palette-tokens.css`.
 *   - 120ms open fade / 80ms hover / 160ms detail-pane slide motion,
 *     all collapsing to 0ms under `prefers-reduced-motion: reduce`.
 *
 * Keyboard:
 *   - Arrow up/down       move selection within the focused column
 *   - Tab / Shift+Tab     standard focus traversal (handled by trap)
 *   - `[` / `]`           jump selection between non-empty columns
 *   - `Cmd+\`             toggle detail pane
 *   - Enter               activate (banner > selected row > autocomplete pick)
 *   - Cmd+Enter           autocomplete: set `doc:` filter chip
 *   - Esc                 dismiss autocomplete OR close palette
 */

interface Props {
	open: boolean;
	onClose: () => void;
	/** Host surface for per-app boost. Defaults to GLOBAL when omitted. */
	surface?: AppSurface;
	/** Mode (search / quickopen / command). Defaults to `search`. */
	mode?: PaletteMode;
	/** Server-injected typed rows (cards / reps / plans / sections). */
	injectedResults?: readonly SearchResult[];
}

let { open, onClose, surface, mode = 'search', injectedResults }: Props = $props();

const host: PaletteHost = $derived<PaletteHost>({
	surface: surface ?? APP_SURFACES.GLOBAL,
	userId: page.data?.user?.id,
});

let input = $state<HTMLInputElement | null>(null);
let rawQuery = $state('');
let debouncedQuery = $state('');

let serverInjected = $state<readonly SearchResult[]>([]);
let lastFetchedQuery = $state<string | null>(null);
let pendingFetch = $state(false);

/** Detail pane visibility (toggled via Cmd+\). Hidden by default below 900px. */
let detailPaneOpen = $state(true);
let viewportWide = $state(true);

/** Autocomplete dropdown -- mounted as soon as a doc-code intent fires. */
let docPickerOpen = $state(true);
let docPicker = $state<DocCodeAutocomplete | null>(null);

const mergedInjected = $derived<readonly SearchResult[]>(
	serverInjected.length > 0 ? serverInjected : (injectedResults ?? []),
);

/**
 * Apply the mode's `ELIGIBLE` filter to the grouped output. The same
 * `searchGrouped` facade serves all three modes; the difference is which
 * result types are allowed through. This keeps the ranker, parser, and
 * loaders single-sourced.
 */
const groupedRaw = $derived<GroupedResults>(searchGrouped(debouncedQuery, host, mergedInjected));
const grouped = $derived<GroupedResults>(filterByMode(groupedRaw, mode));

let focusedColumn = $state<ResultColumn>('faa-resources');
let focusedIndex = $state(0);

const nonEmptyColumns = $derived<ResultColumn[]>(COLUMN_ORDER.filter((c) => grouped.columns[c].length > 0));

const chipFilters = $derived<readonly ParsedFilter[]>(grouped.filters);
const chipSynonyms = $derived<readonly SynonymRewrite[]>(grouped.synonymsApplied);

/** Columns whose contents come from the server fetch. */
const SERVER_FED_COLUMNS: ReadonlySet<ResultColumn> = new Set<ResultColumn>([
	'faa-resources',
	'airboss-content',
	'my-stuff',
]);

const placeholder = $derived<string>(placeholderFor(mode));

function placeholderFor(m: PaletteMode): string {
	if (m === 'command') return 'Command palette';
	if (m === 'quickopen') return 'Quick open';
	return 'Search the platform...';
}

function filterByMode(g: GroupedResults, m: PaletteMode): GroupedResults {
	const eligible = PALETTE_MODE_ELIGIBLE[m];
	// search admits everything -- short-circuit.
	if (eligible === undefined) return g;
	if (m === 'search') return g;
	const filtered: Record<ResultColumn, readonly SearchResult[]> = {
		'faa-resources': [],
		'airboss-content': [],
		'app-help': [],
		'my-stuff': [],
		'external-tools': [],
		commands: [],
	};
	for (const col of COLUMN_ORDER) {
		filtered[col] = g.columns[col].filter((r) => eligible.has(r.type));
	}
	const totalCount = COLUMN_ORDER.reduce((sum, c) => sum + filtered[c].length, 0);
	const bannerHit = g.bannerHit && eligible.has(g.bannerHit.type) ? g.bannerHit : null;
	return { ...g, columns: filtered, totalCount, bannerHit };
}

// Debounce raw -> debounced.
$effect(() => {
	const next = rawQuery;
	if (next === debouncedQuery) return;
	const handle = window.setTimeout(() => {
		debouncedQuery = next;
	}, HELP_SEARCH_DEBOUNCE_MS);
	return () => window.clearTimeout(handle);
});

// Server fetch for DB-backed rows.
$effect(() => {
	const q = debouncedQuery.trim();
	if (q.length === 0) {
		serverInjected = [];
		lastFetchedQuery = q;
		pendingFetch = false;
		return;
	}
	if (q === lastFetchedQuery) {
		pendingFetch = false;
		return;
	}
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
			if (controller.signal.aborted) return;
			if (!res.ok) return;
			const data = (await res.json()) as { results?: SearchResult[] };
			if (controller.signal.aborted) return;
			if (Array.isArray(data.results)) {
				serverInjected = data.results;
				lastFetchedQuery = q;
			}
		} catch {
			// Network errors / aborts: leave serverInjected alone.
		} finally {
			if (!controller.signal.aborted) pendingFetch = false;
		}
	})();
	return () => controller.abort();
});

// Reset selection when query lands.
$effect(() => {
	void debouncedQuery;
	focusedIndex = 0;
	const cols = untrack(() => nonEmptyColumns);
	focusedColumn = cols[0] ?? 'faa-resources';
});

// Track viewport width so the detail pane hides on narrow screens.
$effect(() => {
	if (typeof window === 'undefined') return;
	const mq = window.matchMedia('(min-width: 900px)');
	viewportWide = mq.matches;
	const onChange = (ev: MediaQueryListEvent): void => {
		viewportWide = ev.matches;
	};
	// matchMedia change event - addEventListener works on every modern browser.
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
});

// Focus-trap lifecycle.
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

/** Highlighted result for the detail pane. */
const highlightedResult = $derived<SearchResult | null>(
	(() => {
		// Banner takes precedence when present and the user hasn't moved focus
		// into a column with content -- mirrors the Enter-on-banner behavior.
		if (grouped.bannerHit && focusedIndex === 0 && nonEmptyColumns[0] === focusedColumn) {
			return grouped.bannerHit;
		}
		return currentList()[focusedIndex] ?? null;
	})(),
);

function handleKey(event: KeyboardEvent): void {
	// Doc-code autocomplete owns its keys when it has matches and is open.
	if (docPicker && docPickerOpen) {
		const consumed = docPicker.handleKey(event);
		if (consumed) return;
	}
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
	if (event.key === ']') {
		event.preventDefault();
		jumpColumn(1);
		return;
	}
	if (event.key === '[') {
		event.preventDefault();
		jumpColumn(-1);
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
		event.preventDefault();
		detailPaneOpen = !detailPaneOpen;
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
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

function removeFilter(key: string, value: string): void {
	rawQuery = rebuildQueryWithoutFilter(rawQuery, key, value);
}

function removeSynonym(from: string): void {
	rawQuery = stripBareToken(rawQuery, from);
}

function rebuildQueryWithoutFilter(query: string, key: string, value: string): string {
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

function bannerActionLabel(result: SearchResult): string {
	if (result.type === 'web.tool') return 'Open external';
	if (result.type === 'cmd.action' || result.type === 'cmd.goto') return 'Run';
	return 'Open';
}

// Autocomplete callbacks.
function onAutocompletePick(doc: DocEntry): void {
	// Find the registry row's href and navigate. The Reference's id is
	// stable; build the same URL the aviation loader would (the glossary
	// detail route). The full URL resolution lives in `loadAviationRefs`
	// but for the autocomplete shortcut we use the canonical glossary URL.
	void doc;
	// Pull the registry id from the autocomplete result; map to glossary URL.
	void goto(`/reference/glossary/${doc.id}`);
	onClose();
}

function onAutocompleteFilter(doc: DocEntry): void {
	// Replace the input with `doc:<code>` filter chip + clear free text,
	// then refocus so the user can type the inside-doc query.
	rawQuery = `doc:${doc.code} `;
	docPickerOpen = false;
	void tick().then(() => {
		input?.focus();
	});
}

function onAutocompleteDismiss(): void {
	docPickerOpen = false;
	void tick().then(() => {
		input?.focus();
	});
}

/** Search-inside via the detail pane button. Sets a `doc:` chip and refocuses. */
function onDetailSearchInside(docCode: string): void {
	rawQuery = `doc:${docCode} `;
	void tick().then(() => {
		input?.focus();
	});
}

/** Open via the detail pane button. */
function onDetailOpen(result: SearchResult): void {
	activate(result);
}

/** Hover from a column row -- move the highlight. */
function onColumnHover(_result: SearchResult, index: number, col: ResultColumn): void {
	void _result;
	focusedColumn = col;
	focusedIndex = index;
}

// Whenever the user types again, re-open the autocomplete so it has a
// chance to surface for the new fragment.
$effect(() => {
	void rawQuery;
	docPickerOpen = true;
});

// Grid template depends on viewport + pane visibility.
const detailPaneVisible = $derived<boolean>(detailPaneOpen && viewportWide);
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -- backdrop dismissal
		is dialog-overlay convention; ESC closes via the focus trap. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="backdrop"
		onclick={backdropClick}
		role="presentation"
		data-testid="commandpalette-backdrop"
	>
		<div
			bind:this={panelEl}
			id="commandpalette-root"
			class="palette"
			role="dialog"
			aria-modal="true"
			aria-label={placeholder}
			data-palette-tokens
			data-testid="commandpalette-root"
			data-mode={mode}
			data-detail-open={detailPaneVisible ? 'true' : 'false'}
			data-focused-bucket={focusedColumn}
		>
			<div class="main">
				<div class="input-row">
					<input
						bind:this={input}
						bind:value={rawQuery}
						onkeydown={handleKey}
						type="text"
						role="combobox"
						placeholder={placeholder}
						autocomplete="off"
						spellcheck="false"
						aria-label={placeholder}
						aria-autocomplete="list"
						aria-controls="palette-doc-autocomplete"
						aria-expanded={docPickerOpen && docPicker?.hasMatches() ? 'true' : 'false'}
						data-testid="commandpalette-input"
					/>
				</div>

				<DocCodeAutocomplete
					bind:this={docPicker}
					query={rawQuery}
					open={docPickerOpen}
					onPick={onAutocompletePick}
					onFilter={onAutocompleteFilter}
					onDismiss={onAutocompleteDismiss}
				/>

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
						<span class="banner-kind">{bannerActionLabel(grouped.bannerHit)}</span>
						<span class="banner-title">{grouped.bannerHit.title}</span>
						{#if grouped.bannerHit.subtitle}
							<span class="banner-subtitle">{grouped.bannerHit.subtitle}</span>
						{/if}
						<span class="banner-arrow" aria-hidden="true">→</span>
					</button>
				{/if}

				<div class="columns" data-testid="palette-columns" data-detail-open={detailPaneVisible ? 'true' : 'false'}>
					{#each COLUMN_ORDER as col (col)}
						{@const loading = pendingFetch && SERVER_FED_COLUMNS.has(col)}
						{@const reservedHint = col === 'commands' ? 'Phase 4' : undefined}
						<PaletteColumn
							column={col}
							results={grouped.columns[col]}
							focused={focusedColumn === col}
							focusedIndex={focusedColumn === col ? focusedIndex : 0}
							{loading}
							{reservedHint}
							onActivate={activate}
							onHover={(r, i) => onColumnHover(r, i, col)}
						/>
					{/each}
				</div>

				{#if rawQuery.trim().length === 0}
					<p class="empty-hint">
						{COLUMN_LABELS['faa-resources']}, {COLUMN_LABELS['airboss-content']},
						{COLUMN_LABELS['app-help']}, {COLUMN_LABELS['my-stuff']},
						{COLUMN_LABELS['external-tools']}. Try a doc code (`FAA-H-8083-28`, `Part 91`, `AIM 7-1`),
						an alias (`AvWX`, `PHAK`), a term (`metar`, `density altitude`), or a filter
						(`doc:`, `kind:`, `mine`).
					</p>
				{/if}

				<footer class="shortcuts">
					<span><kbd>[</kbd> <kbd>]</kbd> jump column</span>
					<span><kbd>Tab</kbd> move focus</span>
					<span><kbd>↑</kbd> <kbd>↓</kbd> select</span>
					<span><kbd>Enter</kbd> open</span>
					<span><kbd>⌘</kbd>+<kbd>\</kbd> detail pane</span>
					<span><kbd>Esc</kbd> close</span>
				</footer>
			</div>

			{#if detailPaneVisible}
				<PaletteDetailPane
					result={highlightedResult}
					onOpen={onDetailOpen}
					onSearchInside={onDetailSearchInside}
				/>
			{/if}
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
		animation: palette-fade-in var(--palette-motion-duration-sm) var(--palette-motion-ease-out);
	}

	@keyframes palette-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.backdrop {
			animation: none;
		}
	}

	.palette {
		width: min(82rem, 98vw);
		max-height: 84vh;
		display: grid;
		grid-template-columns: 1fr;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.palette[data-detail-open='true'] {
		grid-template-columns: minmax(0, 1fr) 22rem;
	}

	.main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-height: 84vh;
		overflow: hidden;
	}

	.input-row {
		padding: var(--space-md) var(--space-lg) var(--space-sm);
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
		background: var(--palette-accent-amber-wash);
		font: inherit;
		font-size: var(--font-size-base);
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--palette-motion-duration-sm) var(--palette-motion-ease-out);
	}

	.banner:hover,
	.banner:focus-visible {
		background: var(--palette-accent-amber);
		color: var(--palette-accent-amber-ink);
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		flex: 1;
	}

	/* Commands column reserved-empty in Phase 3 -- still part of the grid
		visually so the detail-pane-collapsed layout has its slot ready. */
	.columns :global([data-column='commands']) {
		opacity: 0.85;
	}

	/* When the detail pane is visible, the grid shrinks. Below 1100px we
		drop to 3 columns regardless to keep readability. */
	.columns[data-detail-open='true'] {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.empty-hint {
		margin: var(--space-sm) var(--space-lg) 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.shortcuts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
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
		.columns[data-detail-open='true'] {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 900px) {
		.palette[data-detail-open='true'] {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.columns,
		.columns[data-detail-open='true'] {
			grid-template-columns: 1fr;
		}
	}
</style>
