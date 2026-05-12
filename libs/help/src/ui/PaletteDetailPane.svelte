<script lang="ts">
import { urlForReference } from '@ab/sources';
import type { SearchResult } from '../schema/result-types';
import { accentFor } from './palette-accent';
import { airbossRefForResult, isFlightbagHref } from './palette-flightbag';

/**
 * Right-side detail pane for the command palette (Variant C, production).
 *
 * Shows the highlighted result's title, subtitle (citation), FTS snippet
 * when present, plus up to five action buttons:
 *
 *   1. Open in flightbag (when the result has a flightbag-resolvable URI)
 *   2. Open (the default navigation)
 *   3. Search inside (sets `doc:<code>` chip; calls onSearchInside)
 *   4. Cite this (copies `airboss-ref:` URI to clipboard; transient toast)
 *   5. Pin to today (Phase 4-adjacent -- disabled placeholder for now)
 *
 * Visibility is owned by the parent palette: this component renders
 * nothing when `result` is null. Toggling via `Cmd+\` and the narrow-
 * viewport cutoff (< 900px) is also a parent-level decision -- the
 * parent passes `null` for `result` to clear the pane.
 *
 * Layout note: this component fills its container; the palette grid
 * shrinks to leave room when the pane is visible (handled in
 * `CommandPalette.svelte`).
 */

interface Props {
	/** The result currently highlighted in the palette. */
	result: SearchResult | null;
	/** Open the result via the normal navigation flow. */
	onOpen: (result: SearchResult) => void;
	/**
	 * Set a `doc:<code>` filter chip on the palette and return focus to
	 * the input. The parent constructs the chip from the result's
	 * clusterKey (handbook root / CFR Part) or own code (chapter rows
	 * with parentDocCode).
	 */
	onSearchInside: (docCode: string) => void;
}

let { result, onOpen, onSearchInside }: Props = $props();

let copied = $state(false);
let copyTimer = $state<number | null>(null);

const accent = $derived<string>(result ? accentFor(result.type) : 'cmd');
const refUri = $derived(result ? airbossRefForResult(result) : null);
const flightbagPath = $derived<string | null>(
	(() => {
		if (!result) return null;
		// Prefer a built airboss-ref URI -> flightbag URL when we can.
		if (refUri) {
			const url = urlForReference(refUri);
			// urlForReference returns FLIGHTBAG_HOME as a safe fallback when
			// the URI parses but no reader route exists yet. Treat that as
			// "no targeted flightbag deep-link available."
			if (url === '/' || url.length === 0) return null;
			return url;
		}
		// Fallback: the existing href already targets a flightbag-shaped path
		// (DB-backed handbook / CFR section loaders may emit one).
		if (isFlightbagHref(result.href)) return result.href;
		return null;
	})(),
);

/** Search-inside is available only when we have a doc code to bond on. */
const searchInsideCode = $derived<string | null>(
	(() => {
		if (!result) return null;
		// Handbook root / CFR Part -- own clusterKey.
		if (result.type === 'faa.handbook' || result.type === 'faa.cfr.part') {
			return result.clusterKey ?? null;
		}
		// Chapter / section child rows -- bond key on the parent.
		if (result.type === 'faa.handbook.chapter' || result.type === 'faa.cfr.sect') {
			return result.clusterKey ?? null;
		}
		// AIM / AC / ACS -- a doc code is meaningful only when the row is a
		// document-level result; child rows bond similarly through clusterKey
		// if the loader sets one.
		return result.clusterKey ?? null;
	})(),
);

function handleOpen(): void {
	if (!result) return;
	onOpen(result);
}

function handleSearchInside(): void {
	if (!result || !searchInsideCode) return;
	onSearchInside(searchInsideCode);
}

function handleOpenFlightbag(): void {
	if (!result || !flightbagPath) return;
	// Route through the parent's onOpen so the same external-vs-internal
	// discriminator handles both buttons. The flightbag path is a
	// same-origin path within an `apps/flightbag` route group; when the
	// palette runs from a sibling app, the activate() flow at the parent
	// will detect a sibling host via siblingOrigin() upstream. Today the
	// parent treats any path that doesn't start with http(s) as
	// same-origin; cross-app deep-linking is wired by the dispatcher,
	// not by this button.
	onOpen({ ...result, href: flightbagPath });
}

async function handleCite(): Promise<void> {
	if (!result) return;
	const uri = refUri ?? null;
	if (!uri) return;
	try {
		await navigator.clipboard.writeText(uri);
		copied = true;
		if (copyTimer !== null) window.clearTimeout(copyTimer);
		copyTimer = window.setTimeout(() => {
			copied = false;
			copyTimer = null;
		}, 1600);
	} catch {
		// Clipboard rejection (insecure context, denied permission): silent
		// fallback. The button stays clickable; the user can retry.
	}
}
</script>

<aside
	class="detail"
	aria-label="Result details"
	data-testid="palette-detail-pane"
	data-accent={accent}
	data-empty={result === null ? 'true' : 'false'}
>
	{#if result === null}
		<p class="empty">Highlight a result to see details.</p>
	{:else}
		<header>
			<span class="tag" data-accent={accent}>{result.subtitle ?? result.type}</span>
			<h2 class="title">{result.title}</h2>
			{#if result.subtitle && result.subtitle !== result.type}
				<p class="subtitle">{result.subtitle}</p>
			{/if}
		</header>

		{#if result.snippet}
			<p class="snippet" data-testid="palette-detail-snippet">{result.snippet}</p>
		{/if}

		<div class="actions" role="group" aria-label="Result actions">
			{#if flightbagPath}
				<button
					type="button"
					class="action primary"
					onclick={handleOpenFlightbag}
					data-testid="palette-detail-open-flightbag"
				>
					Open in flightbag
				</button>
			{/if}
			<button type="button" class="action" onclick={handleOpen} data-testid="palette-detail-open">
				Open
			</button>
			<button
				type="button"
				class="action"
				disabled={searchInsideCode === null}
				onclick={handleSearchInside}
				data-testid="palette-detail-search-inside"
				title={searchInsideCode === null ? 'No doc code on this result' : `Search inside ${searchInsideCode}`}
			>
				Search inside
			</button>
			<button
				type="button"
				class="action"
				disabled={refUri === null}
				onclick={handleCite}
				data-testid="palette-detail-cite"
				title={refUri === null ? 'No citation URI for this result' : 'Copy airboss-ref: URI'}
			>
				{copied ? 'Copied' : 'Cite this'}
			</button>
			<button
				type="button"
				class="action"
				disabled
				data-testid="palette-detail-pin"
				title="Available in Phase 4"
			>
				Pin to today
			</button>
		</div>
	{/if}
</aside>

<style>
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-sunken);
		border-left: 1px solid var(--edge-default);
		overflow-y: auto;
		min-width: 0;
	}

	.detail[data-empty='true'] .empty {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		margin: var(--space-md) 0;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.tag {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		align-self: flex-start;
		padding: var(--space-3xs) var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--palette-accent-cmd-wash);
		border: 1px solid var(--palette-accent-cmd-edge);
	}

	.tag[data-accent='amber'] {
		background: var(--palette-accent-amber-wash);
		border-color: var(--palette-accent-amber-edge);
		color: var(--palette-accent-amber);
	}

	.tag[data-accent='violet'] {
		background: var(--palette-accent-violet-wash);
		border-color: var(--palette-accent-violet-edge);
		color: var(--palette-accent-violet);
	}

	.tag[data-accent='cyan'] {
		background: var(--palette-accent-cyan-wash);
		border-color: var(--palette-accent-cyan-edge);
		color: var(--palette-accent-cyan);
	}

	.tag[data-accent='green'] {
		background: var(--palette-accent-green-wash);
		border-color: var(--palette-accent-green-edge);
		color: var(--palette-accent-green);
	}

	.tag[data-accent='rose'] {
		background: var(--palette-accent-rose-wash);
		border-color: var(--palette-accent-rose-edge);
		color: var(--palette-accent-rose);
	}

	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		line-height: var(--line-height-tight);
		color: var(--ink-body);
	}

	.subtitle {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}

	.snippet {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed);
		color: var(--ink-strong);
		background: var(--surface-panel);
		border: 1px solid var(--edge-subtle);
		border-radius: var(--radius-sm);
		padding: var(--space-sm) var(--space-md);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin-top: auto;
	}

	.action {
		font: inherit;
		font-size: var(--font-size-sm);
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-panel);
		color: var(--ink-body);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		cursor: pointer;
		text-align: left;
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
	}

	.action:hover:not(:disabled) {
		background: var(--surface-raised);
		border-color: var(--edge-strong);
	}

	.action:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.action.primary {
		background: var(--action-default-wash);
		border-color: var(--action-default);
		color: var(--action-default-ink);
		font-weight: var(--font-weight-semibold);
	}

	.action.primary:hover {
		background: var(--action-default);
	}

	.action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
