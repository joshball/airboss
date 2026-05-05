<script lang="ts">
import { HELP_SEARCH_DEBOUNCE_MS, ROUTES } from '@ab/constants';
import { createFocusTrap, type FocusTrap } from '@ab/ui/lib/focus-trap';
import { tick, untrack } from 'svelte';
import { goto } from '$app/navigation';
import type { SearchResult, SearchResultSet } from '../schema/help-registry';
import { search } from '../search';

/**
 * Centered command-palette overlay for cross-library search. Opened by
 * the top-nav button, by `/`, or by Cmd+K (see HelpSearch.svelte for the
 * key listeners). Closed by Escape or by clicking the backdrop.
 *
 * Keyboard:
 *   - Arrow up/down: move selection within the focused bucket.
 *   - `[` / `]`:     jump selection between buckets.
 *   - Enter:         navigate to the selected result.
 *   - Escape:        close.
 *
 * Results are grouped into aviation and help buckets. No cross-bucket
 * implicit ranking.
 *
 * Performance:
 *   - Search runs against precomputed lowercased haystacks on each
 *     `HelpPageIndex` -- per-keystroke `String.toLowerCase` allocations
 *     are amortised at registration time.
 *   - Keystrokes debounce by `HELP_SEARCH_DEBOUNCE_MS` so a fast typist
 *     fires at most one search per debounce window instead of per char.
 */

let {
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
} = $props();

let input = $state<HTMLInputElement | null>(null);
let rawQuery = $state('');
/**
 * Debounced view of `rawQuery`. The search runs only when this lands;
 * the input box updates `rawQuery` on every keystroke so the field still
 * feels live.
 */
let debouncedQuery = $state('');
const results = $derived<SearchResultSet>(search(debouncedQuery));
let focusedBucket = $state<'aviation' | 'help'>('aviation');
let focusedIndex = $state(0);

$effect(() => {
	const next = rawQuery;
	if (next === debouncedQuery) return;
	const handle = window.setTimeout(() => {
		debouncedQuery = next;
	}, HELP_SEARCH_DEBOUNCE_MS);
	return () => window.clearTimeout(handle);
});

// Reset focus whenever the debounced query lands. We depend on
// `debouncedQuery` (not `results`) so the effect never reads state it
// writes, which would loop.
$effect(() => {
	void debouncedQuery;
	focusedIndex = 0;
	focusedBucket = results.aviation.length > 0 ? 'aviation' : results.help.length > 0 ? 'help' : 'aviation';
});

// Focus-trap lifecycle: allocated once per dialog-open, released on close.
// Without this Tab/Shift+Tab can leak out of the role="dialog" + aria-modal
// container into the underlying page chrome behind the scrim, breaking the
// modal contract.
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
	return focusedBucket === 'aviation' ? results.aviation : results.help;
}

function handleKey(event: KeyboardEvent): void {
	// Route Tab/Shift+Tab through the focus trap so focus can't leak past
	// the dialog. The trap's Escape handler is wired via createFocusTrap
	// below, but keep the explicit check here for the input field as well.
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
		jumpBucket(1);
		return;
	}
	if (event.key === '[') {
		event.preventDefault();
		jumpBucket(-1);
		return;
	}
	if (event.key === 'Enter') {
		event.preventDefault();
		const list = currentList();
		const result = list[focusedIndex];
		if (result) activate(result);
	}
}

function jumpBucket(direction: 1 | -1): void {
	const target: 'aviation' | 'help' = focusedBucket === 'aviation' ? 'help' : 'aviation';
	void direction; // only two buckets; direction is symbolic.
	const list = target === 'aviation' ? results.aviation : results.help;
	if (list.length === 0) return;
	focusedBucket = target;
	focusedIndex = 0;
}

function activate(result: SearchResult): void {
	const path = result.library === 'aviation' ? ROUTES.REFERENCE_GLOSSARY_ID(result.id) : ROUTES.HELP_ID(result.id);
	onClose();
	void goto(path);
}

function backdropClick(event: MouseEvent): void {
	if (event.target === event.currentTarget) onClose();
}

function backdropKeydown(event: KeyboardEvent): void {
	// Allow closing the palette via Escape from anywhere in the overlay.
	if (event.key === 'Escape') {
		event.preventDefault();
		onClose();
	}
}
</script>

{#if open}
	<!-- Backdrop receives click-outside + Escape-from-anywhere events. The
		 palette is a dialog-role child that traps focus. -->
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
			aria-label="Search help and aviation references"
			data-testid="helpsearchpalette-root"
			data-focused-bucket={focusedBucket}
		>
			<div class="input-row">
				<input
					bind:this={input}
					bind:value={rawQuery}
					onkeydown={handleKey}
					type="search"
					placeholder="Search (try `tag:weather rules:ifr` or `metar`)"
					autocomplete="off"
					spellcheck="false"
					aria-label="Search query"
					data-testid="helpsearchpalette-input"
				/>
			</div>

			<div class="buckets">
				<section class="bucket" aria-label="Aviation results">
					<header>
						<span class="label">Aviation</span>
						<span class="count">{results.aviation.length}</span>
					</header>
					{#if results.aviation.length === 0}
						<p class="hint">No aviation hits.</p>
					{:else}
						<ul>
							{#each results.aviation as result, index (result.id)}
								<li
									class:focused={focusedBucket === 'aviation' && focusedIndex === index}
									aria-current={focusedBucket === 'aviation' && focusedIndex === index ? 'true' : undefined}
								>
									<button type="button" onclick={() => activate(result)}>
										<span class="tag">aviation - {result.sourceType}</span>
										<span class="title">{result.title}</span>
										<span class="snippet">{result.snippet}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="bucket" aria-label="Help results">
					<header>
						<span class="label">Help</span>
						<span class="count">{results.help.length}</span>
					</header>
					{#if results.help.length === 0}
						<p class="hint">No help hits.</p>
					{:else}
						<ul>
							{#each results.help as result, index (result.id)}
								<li
									class:focused={focusedBucket === 'help' && focusedIndex === index}
									aria-current={focusedBucket === 'help' && focusedIndex === index ? 'true' : undefined}
								>
									<button type="button" onclick={() => activate(result)}>
										<span class="tag">help - {result.sourceType}</span>
										<span class="title">{result.title}</span>
										<span class="snippet">{result.snippet}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>

			{#if rawQuery.trim().length === 0}
				<p class="empty-hint">Start typing. Use `tag:`, `surface:`, `kind:`, `source:`, `rules:`, `lib:` to filter.</p>
			{/if}

			<footer class="shortcuts">
				<span><kbd>[</kbd> <kbd>]</kbd> jump bucket</span>
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
		padding-top: 6rem;
		z-index: var(--z-command-palette);
	}

	.palette {
		width: min(44rem, 92vw);
		max-height: 72vh;
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

	/*
	 * Visible keyboard focus indicator on the search field. Previously
	 * suppressed with `outline: none` which left re-focused users with no
	 * cue. The box-shadow doesn't reflow surrounding content the way
	 * outline would inside the inset container.
	 */
	input:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--focus-ring);
		border-radius: var(--radius-sm);
	}

	.buckets {
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
		padding: var(--space-md) var(--space-lg);
		flex: 1;
	}

	.bucket {
		min-width: 0;
	}

	.bucket header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}

	.bucket .count {
		font-variant-numeric: tabular-nums;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0 var(--space-sm);
		font-size: var(--font-size-xs);
	}

	.bucket ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.bucket li.focused button {
		background: var(--action-default-wash);
		border-color: var(--action-default);
	}

	.bucket button {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3xs);
		width: 100%;
		text-align: left;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-sm) var(--space-md);
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.bucket button:hover {
		background: var(--surface-sunken);
	}

	.bucket button:focus-visible {
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
		font-size: var(--font-size-base);
	}

	.snippet {
		font-size: var(--font-size-sm);
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

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.buckets {
			grid-template-columns: 1fr;
		}
	}
</style>
