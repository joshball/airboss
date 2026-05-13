<script lang="ts">
import type { AutocompleteEntry, AutocompleteSource } from '@ab/autocomplete';
import { Autocomplete, DocCodeSource, TitlePrefixSource } from '@ab/autocomplete';
import { APP_SURFACES, type AppSurface, HELP_SEARCH_DEBOUNCE_MS } from '@ab/constants';
import { createFocusTrap, type FocusTrap } from '@ab/ui/lib/focus-trap';
import { tick, untrack } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { ParsedFilter } from '../schema/help-registry';
import { PALETTE_MODE_ELIGIBLE, type PaletteMode } from '../schema/palette-mode';
import type { GroupedResults, PaletteHost, SearchResult, SynonymRewrite } from '../schema/result-types';
import { BUCKET_BY_TYPE, TYPE_BUCKET_ORDER, type TypeBucket } from '../schema/type-buckets';
import { searchGrouped } from '../search';
import FilterChips from './FilterChips.svelte';
import PaletteDetailPane from './PaletteDetailPane.svelte';
import PalettePassageView from './PalettePassageView.svelte';
import PaletteRow from './PaletteRow.svelte';
import PaletteScopedView from './PaletteScopedView.svelte';
import PaletteTopHits from './PaletteTopHits.svelte';
import PaletteTypeNav from './PaletteTypeNav.svelte';
import '@ab/themes/palette-tokens.css';

/**
 * Production command palette -- Phase 3.5 rewrite.
 *
 * Layout (per `design/mockups/search/mockup-02-new-layout.md`):
 *
 *   - Input row with `<Autocomplete>` wrapping the text input
 *     (autocomplete dropdown overlays the input, NOT the result column).
 *   - Filter chips above the input.
 *   - I-2 broad (default): top-hits strip + vertical type-nav (left) +
 *     result column (middle) + detail pane (right).
 *   - I-1 scoped: `<PaletteScopedView>` replaces the top-hits + type-nav
 *     + result column with a doc-headline card + references panel.
 *   - I-3 phrase-FTS: `<PalettePassageView>` replaces the same surface
 *     with passage cards.
 *   - Narrow viewport (<900px): type-nav collapses to a horizontal chip
 *     row; detail pane hides entirely.
 *
 * Keyboard:
 *   - Autocomplete dropdown owns Up/Down/Tab/Enter/Esc while open.
 *   - Dropdown closed: Up/Down moves within result column, [/] cycles
 *     between top-hits / type-nav / result-column foci, Cmd+\ toggles
 *     the detail pane, Esc closes the palette.
 *
 * The component is browser-safe by construction: every value-import is a
 * pure ts/svelte module under `@ab/help`, `@ab/autocomplete`, `@ab/ui`,
 * `@ab/constants`. No `@ab/db/connection`, no `@ab/bc-study/server`, no
 * `@ab/sources/server`, no static `node:*`. Type-only imports from
 * `@ab/autocomplete` are erased at compile time.
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

let panelEl = $state<HTMLDivElement | null>(null);
let autocompleteEl = $state<{ focus: () => void } | null>(null);

let rawQuery = $state('');
let debouncedQuery = $state('');

let serverInjected = $state<readonly SearchResult[]>([]);
let lastFetchedQuery = $state<string | null>(null);
let pendingFetch = $state(false);

/** Detail pane visibility (toggled via Cmd+\). Hidden by default below 900px. */
let detailPaneOpen = $state(true);
let viewportWide = $state(true);

const mergedInjected = $derived<readonly SearchResult[]>(
	serverInjected.length > 0 ? serverInjected : (injectedResults ?? []),
);

const groupedRaw = $derived<GroupedResults>(searchGrouped(debouncedQuery, host, mergedInjected));
const grouped = $derived<GroupedResults>(filterByMode(groupedRaw, mode));

const intent = $derived<GroupedResults['intent']>(grouped.intent);
const docFilterCode = $derived<string | null>(extractDocFilterCode(grouped.filters));

/**
 * Per-bucket counts for the type-nav. We flatten every column into a
 * single bucket-counted map; this drives the left-side counts and the
 * selected-bucket result list.
 */
const bucketCounts = $derived<Record<TypeBucket, number>>(computeBucketCounts(grouped));

/** Currently-selected type bucket (drives the middle column in I-2). */
let selectedBucket = $state<TypeBucket>('handbooks');

// Keep the selected bucket in sync with the result set: pick the first
// non-empty bucket whenever the result-set shape changes. The user can
// still click another bucket; selectedBucket only auto-syncs on query
// change.
$effect(() => {
	void debouncedQuery;
	const counts = untrack(() => bucketCounts);
	const fallback = pickFirstNonEmptyBucket(counts);
	if (fallback) selectedBucket = fallback;
});

/** Rows displayed in the middle column for the currently-selected bucket. */
const bucketRows = $derived<readonly SearchResult[]>(computeBucketRows(grouped, selectedBucket));

const chipFilters = $derived<readonly ParsedFilter[]>(grouped.filters);
const chipSynonyms = $derived<readonly SynonymRewrite[]>(grouped.synonymsApplied);

/**
 * Focus zone: where Up/Down arrow keys advance the selection. Three
 * zones in I-2 mode -- top-hits / column / detail-pane sub-results.
 */
type FocusZone = 'top-hits' | 'column';
let focusZone = $state<FocusZone>('column');
let focusedColumnIndex = $state(0);
let focusedTopHitIndex = $state(0);

// Reset focus indices when the result set or selected bucket changes.
$effect(() => {
	void debouncedQuery;
	void selectedBucket;
	focusedColumnIndex = 0;
	focusedTopHitIndex = 0;
});

const placeholder = $derived<string>(placeholderFor(mode));

function placeholderFor(m: PaletteMode): string {
	if (m === 'command') return 'Command palette';
	if (m === 'quickopen') return 'Quick open';
	return 'Search the platform...';
}

function filterByMode(g: GroupedResults, m: PaletteMode): GroupedResults {
	const eligible = PALETTE_MODE_ELIGIBLE[m];
	if (m === 'search') return g;
	const filtered: GroupedResults['columns'] = {
		'faa-resources': [],
		'airboss-content': [],
		'app-help': [],
		'my-stuff': [],
		'external-tools': [],
		commands: [],
	};
	for (const col of Object.keys(g.columns) as Array<keyof typeof g.columns>) {
		filtered[col] = g.columns[col].filter((r) => eligible.has(r.type));
	}
	const totalCount = (Object.keys(filtered) as Array<keyof typeof filtered>).reduce(
		(sum, c) => sum + filtered[c].length,
		0,
	);
	const bannerHit = g.bannerHit && eligible.has(g.bannerHit.type) ? g.bannerHit : null;
	const topHits = g.topHits.filter((r) => eligible.has(r.type));
	return { ...g, columns: filtered, totalCount, bannerHit, topHits };
}

function computeBucketCounts(g: GroupedResults): Record<TypeBucket, number> {
	const counts: Record<TypeBucket, number> = {
		handbooks: 0,
		cfrs: 0,
		aim: 0,
		ac: 0,
		acs: 0,
		knowledge: 0,
		courses: 0,
		glossary: 0,
		mine: 0,
		tools: 0,
		'app-help': 0,
	};
	for (const col of Object.values(g.columns)) {
		for (const row of col) {
			const bucket = BUCKET_BY_TYPE[row.type];
			counts[bucket] = (counts[bucket] ?? 0) + 1;
		}
	}
	return counts;
}

function computeBucketRows(g: GroupedResults, bucket: TypeBucket): readonly SearchResult[] {
	const rows: SearchResult[] = [];
	for (const col of Object.values(g.columns)) {
		for (const row of col) {
			if (BUCKET_BY_TYPE[row.type] === bucket) rows.push(row);
		}
	}
	rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title));
	return rows;
}

function pickFirstNonEmptyBucket(counts: Record<TypeBucket, number>): TypeBucket | null {
	for (const b of TYPE_BUCKET_ORDER) {
		if ((counts[b] ?? 0) > 0) return b;
	}
	return null;
}

function extractDocFilterCode(filters: readonly ParsedFilter[]): string | null {
	for (const f of filters) {
		if (f.key !== 'doc') continue;
		if (f.values.length > 0 && f.values[0]) return f.values[0];
	}
	return null;
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

// Track viewport width so the detail pane hides on narrow screens.
$effect(() => {
	if (typeof window === 'undefined') return;
	const mq = window.matchMedia('(min-width: 900px)');
	viewportWide = mq.matches;
	const onChange = (ev: MediaQueryListEvent): void => {
		viewportWide = ev.matches;
	};
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
});

// Focus-trap lifecycle.
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
		autocompleteEl?.focus();
	});
	return () => {
		trap?.release();
		trap = null;
		previousFocus?.focus?.();
		previousFocus = null;
	};
});

// Autocomplete sources for the search input. Order matters: DocCode
// claims doc-shaped fragments first; TitlePrefix handles the title path
// for everything else.
const autocompleteSources: readonly AutocompleteSource[] = [DocCodeSource, TitlePrefixSource];

/**
 * Autocomplete commit (Tab / Enter on a dropdown row). The host's job is
 * to replace the input value with the canonical form (the component
 * already did that) and -- crucially -- NOT to run the search. The modal
 * stays in its current state; the user can keep typing or hit Enter
 * (dropdown closed) to actually run the search.
 *
 * Per WP decision R13: "Tab commits the canonical form into the input
 * AND closes the dropdown -- modal stays open in its current state."
 */
function onAutocompleteCommit(_entry: AutocompleteEntry): void {
	// Intentionally a no-op for search flow. Future hosts (e.g. quickopen
	// at Phase 5) override this to navigate on commit.
}

/**
 * Cmd+Enter on a dropdown row -- the meta intent. Sets a `doc:<code>`
 * filter chip, clears the free-text part of the input, and routes the
 * search-on-Enter (already triggered by the meta path) into I-1 scoped
 * intent territory.
 */
function onAutocompleteCommitMeta(entry: AutocompleteEntry): void {
	const code = entry.secondary ?? entry.canonicalForm;
	if (!code) return;
	rawQuery = `doc:${code} `;
	void tick().then(() => autocompleteEl?.focus());
}

function onAutocompleteDismiss(): void {
	void tick().then(() => autocompleteEl?.focus());
}

function onAutocompleteEnter(): void {
	// Dropdown closed; the search debouncer already drove `debouncedQuery`
	// to a fresh value, so the result panels are up-to-date. If the user
	// hit Enter on a tier-1 banner result, activate it; otherwise activate
	// the currently-focused row.
	if (grouped.bannerHit) {
		activate(grouped.bannerHit);
		return;
	}
	if (focusZone === 'top-hits') {
		const hit = grouped.topHits[focusedTopHitIndex];
		if (hit) activate(hit);
		return;
	}
	const row = bucketRows[focusedColumnIndex];
	if (row) activate(row);
}

function handleKey(event: KeyboardEvent): void {
	// Autocomplete handles its own keys when open; the component dispatches
	// `onEnter` on the dropdown-closed Enter case. Outside of those, we
	// own the keymap below.
	trap?.handleKeyDown(event);
	if (event.defaultPrevented) return;
	if (event.key === 'Escape') {
		event.preventDefault();
		onClose();
		return;
	}
	if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
		event.preventDefault();
		detailPaneOpen = !detailPaneOpen;
		return;
	}
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		moveFocus(1);
		return;
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault();
		moveFocus(-1);
		return;
	}
	if (event.key === ']') {
		event.preventDefault();
		jumpFocusZone(1);
		return;
	}
	if (event.key === '[') {
		event.preventDefault();
		jumpFocusZone(-1);
		return;
	}
}

function moveFocus(direction: 1 | -1): void {
	if (focusZone === 'top-hits') {
		const len = grouped.topHits.length;
		if (len === 0) return;
		focusedTopHitIndex = (focusedTopHitIndex + direction + len) % len;
		return;
	}
	const len = bucketRows.length;
	if (len === 0) return;
	focusedColumnIndex = (focusedColumnIndex + direction + len) % len;
}

function jumpFocusZone(direction: 1 | -1): void {
	const zones: FocusZone[] = grouped.topHits.length > 0 && intent === 'broad' ? ['top-hits', 'column'] : ['column'];
	const idx = zones.indexOf(focusZone);
	const base = idx === -1 ? 0 : idx;
	const next = zones[(base + direction + zones.length) % zones.length] ?? zones[0];
	if (next) focusZone = next;
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

/** Search-inside via the detail pane button. Sets a `doc:` chip and refocuses. */
function onDetailSearchInside(docCode: string): void {
	rawQuery = `doc:${docCode} `;
	void tick().then(() => autocompleteEl?.focus());
}

/** Open via the detail pane button. */
function onDetailOpen(result: SearchResult): void {
	activate(result);
}

function selectBucket(bucket: TypeBucket): void {
	selectedBucket = bucket;
	focusZone = 'column';
	focusedColumnIndex = 0;
}

function onTopHitHover(_r: SearchResult, index: number): void {
	focusZone = 'top-hits';
	focusedTopHitIndex = index;
}

function onColumnRowHover(result: SearchResult): void {
	focusZone = 'column';
	const idx = bucketRows.findIndex((r) => r.id === result.id);
	if (idx >= 0) focusedColumnIndex = idx;
}

/** Highlighted result for the detail pane. */
const highlightedResult = $derived<SearchResult | null>(
	(() => {
		if (grouped.bannerHit && focusZone === 'top-hits' && focusedTopHitIndex === 0 && grouped.topHits.length === 0) {
			return grouped.bannerHit;
		}
		if (focusZone === 'top-hits') {
			return grouped.topHits[focusedTopHitIndex] ?? null;
		}
		return bucketRows[focusedColumnIndex] ?? null;
	})(),
);

const detailPaneVisible = $derived<boolean>(detailPaneOpen && viewportWide && intent !== 'phrase-fts');

// In I-1 scoped mode, the headline row is the matching doc; if no row
// matches the doc filter directly, we still render the chip and the
// references panel.
const scopedHeadline = $derived<SearchResult | null>(
	(() => {
		if (intent !== 'scoped') return null;
		if (!docFilterCode) return null;
		// Look for a row whose docCode matches the chip.
		for (const col of Object.values(grouped.columns)) {
			for (const row of col) {
				if (row.docCode === docFilterCode) return row;
			}
		}
		return null;
	})(),
);

const scopedReferences = $derived<readonly SearchResult[]>(
	(() => {
		if (intent !== 'scoped') return [];
		const rows: SearchResult[] = [];
		const headlineId = scopedHeadline?.id;
		for (const col of Object.values(grouped.columns)) {
			for (const row of col) {
				if (row.id === headlineId) continue;
				rows.push(row);
			}
		}
		return rows;
	})(),
);

const passageRows = $derived<readonly SearchResult[]>(
	(() => {
		if (intent !== 'phrase-fts') return [];
		const rows: SearchResult[] = [];
		for (const col of Object.values(grouped.columns)) {
			for (const row of col) rows.push(row);
		}
		rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
		return rows;
	})(),
);

// In I-1, the user is committed to a doc; switch the auto-focus zone to
// the references list (column zone reads from bucketRows; we keep that
// behaviour, the scoped view's row template still routes through the
// same activate handler).
$effect(() => {
	if (intent === 'scoped') focusZone = 'column';
});
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
			tabindex="-1"
			data-palette-tokens
			data-testid="commandpalette-root"
			data-mode={mode}
			data-intent={intent}
			data-detail-open={detailPaneVisible ? 'true' : 'false'}
			data-focused-bucket={selectedBucket}
			onkeydown={handleKey}
		>
			<div class="header">
				<div class="input-row">
					<Autocomplete
						bind:this={autocompleteEl}
						bind:value={rawQuery}
						sources={autocompleteSources}
						onCommit={onAutocompleteCommit}
						onCommitMeta={onAutocompleteCommitMeta}
						onDismiss={onAutocompleteDismiss}
						onEnter={onAutocompleteEnter}
						placeholder={placeholder}
						ariaLabel={placeholder}
						inputId="commandpalette-input"
						testId="commandpalette"
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
						<span class="banner-kind">{bannerActionLabel(grouped.bannerHit)}</span>
						<span class="banner-title">{grouped.bannerHit.title}</span>
						{#if grouped.bannerHit.subtitle}
							<span class="banner-subtitle">{grouped.bannerHit.subtitle}</span>
						{/if}
						<span class="banner-arrow" aria-hidden="true">→</span>
					</button>
				{/if}
			</div>

			<div class="body" data-intent={intent}>
				{#if intent === 'scoped'}
					<PaletteScopedView
						headline={scopedHeadline}
						references={scopedReferences}
						docCode={docFilterCode ?? ''}
						onActivate={activate}
						onHover={onColumnRowHover}
					/>
				{:else if intent === 'phrase-fts'}
					<PalettePassageView
						passages={passageRows}
						focusedIndex={focusedColumnIndex}
						onActivate={activate}
						onHover={(_r, i) => {
							focusZone = 'column';
							focusedColumnIndex = i;
						}}
					/>
				{:else}
					<!-- I-2 broad mode: top-hits + type-nav + result column + detail pane. -->
					<div class="broad">
						{#if grouped.topHits.length > 0}
							<PaletteTopHits
								hits={grouped.topHits}
								focused={focusZone === 'top-hits'}
								focusedIndex={focusedTopHitIndex}
								onActivate={activate}
								onHover={onTopHitHover}
							/>
						{/if}

						<div class="layout" data-detail-open={detailPaneVisible ? 'true' : 'false'}>
							<PaletteTypeNav
								counts={bucketCounts}
								selected={selectedBucket}
								onSelect={selectBucket}
							/>

							<section
								class="column"
								aria-labelledby="palette-column-heading"
								data-testid="palette-column"
								data-focused={focusZone === 'column' ? 'true' : 'false'}
								data-loading={pendingFetch ? 'true' : 'false'}
							>
								<header>
									<h3 id="palette-column-heading">
										{bucketRows.length === 0 ? 'No matches' : `${bucketRows.length} matches`}
									</h3>
								</header>
								{#if bucketRows.length === 0}
									<p class="empty">
										{#if rawQuery.trim().length === 0}
											Try a doc code (<code>FAA-H-8083-28</code>, <code>Part 91</code>),
											an alias (<code>AvWX</code>, <code>PHAK</code>),
											or a filter (<code>doc:</code>, <code>kind:</code>, <code>mine</code>).
										{:else if pendingFetch}
											Loading…
										{:else}
											No results in this group.
										{/if}
									</p>
								{:else}
									<ul>
										{#each bucketRows as row, index (row.id)}
											<li>
												<PaletteRow
													result={row}
													focused={focusZone === 'column' && index === focusedColumnIndex}
													onActivate={activate}
													onHover={onColumnRowHover}
												/>
											</li>
										{/each}
									</ul>
								{/if}
							</section>

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
			</div>

			<footer class="shortcuts">
				<span><kbd>[</kbd> <kbd>]</kbd> jump zone</span>
				<span><kbd>↑</kbd> <kbd>↓</kbd> select</span>
				<span><kbd>Tab</kbd> commit autocomplete</span>
				<span><kbd>Enter</kbd> open</span>
				<span><kbd>⌘</kbd>+<kbd>\</kbd> detail pane</span>
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
		animation: palette-fade-in var(--palette-motion-duration-sm) var(--palette-motion-ease-out);
	}

	@keyframes palette-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (prefers-reduced-motion: reduce) {
		.backdrop { animation: none; }
	}

	.palette {
		width: min(82rem, 98vw);
		max-height: 84vh;
		display: flex;
		flex-direction: column;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		overflow: hidden;
	}

	.header {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--edge-default);
	}

	.input-row {
		padding: var(--space-md) var(--space-lg) var(--space-sm);
	}

	.banner {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		border: 0;
		border-top: 1px solid var(--edge-default);
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

	.banner-title { font-weight: var(--font-weight-semibold); }
	.banner-subtitle { color: var(--ink-muted); font-size: var(--font-size-sm); }
	.banner-arrow { margin-left: auto; }

	.body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.broad {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}

	.layout {
		display: grid;
		grid-template-columns: 12rem minmax(0, 1fr);
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.layout[data-detail-open='true'] {
		grid-template-columns: 12rem minmax(0, 1fr) 22rem;
	}

	.column {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md) var(--space-lg);
		min-width: 0;
		overflow-y: auto;
	}

	.column[data-loading='true'] header h3 {
		animation: palette-column-loading-pulse var(--motion-slow) infinite;
	}

	@keyframes palette-column-loading-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
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

	.column h3 {
		margin: 0;
		font-size: inherit;
		font-weight: var(--font-weight-semibold);
		color: var(--ink-muted);
	}

	.column ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.column li { list-style: none; }

	.column .empty {
		margin: 0;
		padding: var(--space-md);
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
	}

	code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-sunken);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
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

	@media (max-width: 900px) {
		.layout,
		.layout[data-detail-open='true'] {
			grid-template-columns: 1fr;
		}
	}
</style>
