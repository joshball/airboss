<script lang="ts">
import { ROUTES } from '@ab/constants';
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
const results = $derived<SearchResultSet>(search(rawQuery));
let focusedBucket = $state<'aviation' | 'help'>('aviation');
let focusedIndex = $state(0);

// Reset focus whenever the query changes. We depend on `rawQuery` (not
// `results`) so the effect never reads state it writes, which would loop.
$effect(() => {
	void rawQuery;
	focusedIndex = 0;
	focusedBucket = results.aviation.length > 0 ? 'aviation' : results.help.length > 0 ? 'help' : 'aviation';
});

$effect(() => {
	if (open && input) {
		input.focus();
	}
});

function currentList(): readonly SearchResult[] {
	return focusedBucket === 'aviation' ? results.aviation : results.help;
}

function handleKey(event: KeyboardEvent): void {
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
	const path = result.library === 'aviation' ? ROUTES.GLOSSARY_ID(result.id) : ROUTES.HELP_ID(result.id);
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
	<div class="backdrop" onclick={backdropClick} onkeydown={backdropKeydown} role="presentation">
		<div class="palette" role="dialog" aria-modal="true" aria-label="Search help and aviation references">
			<div class="input-row">
				<input
					bind:this={input}
					bind:value={rawQuery}
					onkeydown={handleKey}
					type="search"
					placeholder="Search -- try `tag:weather rules:ifr` or `metar`"
					autocomplete="off"
					spellcheck="false"
					aria-label="Search query"
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
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 6rem;
		z-index: 200;
	}

	.palette {
		width: min(44rem, 92vw);
		max-height: 72vh;
		display: flex;
		flex-direction: column;
		background: var(--ab-color-surface, #ffffff);
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-radius: var(--ab-radius-lg, 10px);
		box-shadow: var(--ab-shadow-xl, 0 20px 40px rgba(15, 23, 42, 0.25));
		overflow: hidden;
	}

	.input-row {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--ab-color-border, #e2e8f0);
	}

	input {
		width: 100%;
		border: 0;
		outline: none;
		font-size: 1rem;
		padding: 0.5rem 0;
		background: transparent;
		color: inherit;
	}

	input:focus-visible {
		outline: none;
	}

	.buckets {
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding: 0.75rem 1rem;
		flex: 1;
	}

	.bucket {
		min-width: 0;
	}

	.bucket header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ab-color-fg-muted, #64748b);
		margin-bottom: 0.375rem;
	}

	.bucket .count {
		font-variant-numeric: tabular-nums;
		background: var(--ab-color-surface-sunken, #f1f5f9);
		border-radius: 999px;
		padding: 0 0.5rem;
		font-size: 0.6875rem;
	}

	.bucket ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bucket li.focused button {
		background: var(--ab-color-primary-subtle, #dbeafe);
		border-color: var(--ab-color-primary, #3b82f6);
	}

	.bucket button {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.125rem;
		width: 100%;
		text-align: left;
		background: var(--ab-color-surface, #ffffff);
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-radius: var(--ab-radius-sm, 4px);
		padding: 0.5rem 0.625rem;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.bucket button:hover {
		background: var(--ab-color-surface-sunken, #f1f5f9);
	}

	.bucket button:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring, #60a5fa);
		outline-offset: 2px;
	}

	.tag {
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ab-color-fg-muted, #64748b);
	}

	.title {
		font-weight: var(--ab-font-weight-semibold, 600);
		font-size: 0.9375rem;
	}

	.snippet {
		font-size: 0.8125rem;
		color: var(--ab-color-fg-muted, #64748b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint,
	.empty-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8125rem;
		color: var(--ab-color-fg-subtle, #94a3b8);
	}

	.empty-hint {
		padding: 0 1rem 0.75rem;
	}

	.shortcuts {
		display: flex;
		gap: 1rem;
		border-top: 1px solid var(--ab-color-border, #e2e8f0);
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: var(--ab-color-fg-muted, #64748b);
	}

	kbd {
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-bottom-width: 2px;
		border-radius: 3px;
		padding: 0 0.25rem;
		font-size: 0.6875rem;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		background: var(--ab-color-surface-sunken, #f1f5f9);
	}

	@media (max-width: 640px) {
		.buckets {
			grid-template-columns: 1fr;
		}
	}
</style>
