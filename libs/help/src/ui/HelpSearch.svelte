<script lang="ts">
import type { AppId, AppSurface } from '@ab/constants';
import type { PaletteMode } from '../schema/palette-mode';
import CommandPalette from './CommandPalette.svelte';

/**
 * Nav-integrated search affordance. Renders a visible button ("Search / ")
 * that opens the production `CommandPalette`, and installs global key
 * listeners that open the same palette in three modes:
 *
 *   - `/` or `Cmd+K`         -> `search` mode (default)
 *   - `Cmd+P`                -> `quickopen` mode (Phase 5)
 *   - `Cmd+Shift+P`          -> `command` mode (Phase 4)
 *
 * Both entry points lead to the same component -- the top-nav button
 * teaches the feature exists; the keyboard shortcuts are the power-user
 * surface.
 *
 * Global key listeners respect input-focus: pressing `/` while the user
 * is typing in a form field does NOT open the palette (lets users type
 * slashes in content). Cmd-modified shortcuts ignore the editable check
 * because the user's `Cmd+K` / `Cmd+P` / `Cmd+Shift+P` always means the
 * palette, even from within an input.
 */

interface Props {
	/** Page-level surface tag (drives loader scoping inside the palette). */
	surface?: AppSurface;
	/**
	 * Host app id (`study`, `sim`, `hangar`, `flightbag`, `avionics`).
	 * Drives the Phase 4 per-app command boost: this app's commands sort
	 * above commands registered by sibling apps.
	 */
	app?: AppId;
}

let { surface, app }: Props = $props();

let open = $state(false);
let mode = $state<PaletteMode>('search');

function close(): void {
	open = false;
}

function openInMode(next: PaletteMode): void {
	mode = next;
	open = true;
}

function toggleFromButton(): void {
	if (!open) mode = 'search';
	open = !open;
}

function isEditable(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
	if (target.isContentEditable) return true;
	return false;
}

function handleWindowKey(event: KeyboardEvent): void {
	if (event.defaultPrevented) return;
	if (event.repeat) return;
	const meta = event.metaKey || event.ctrlKey;
	const key = event.key.toLowerCase();
	// Cmd+Shift+P (or Ctrl+Shift+P) -- command-mode palette.
	if (meta && event.shiftKey && key === 'p') {
		event.preventDefault();
		openInMode('command');
		return;
	}
	// Cmd+P (or Ctrl+P) -- quickopen-mode palette. Hijacks the
	// browser print shortcut intentionally; pilots will hit Cmd+P far
	// more often to jump to a known doc/plan than to print a page.
	if (meta && !event.shiftKey && key === 'p') {
		event.preventDefault();
		openInMode('quickopen');
		return;
	}
	// Cmd+K -- search-mode palette.
	if (meta && !event.shiftKey && key === 'k') {
		event.preventDefault();
		openInMode('search');
		return;
	}
	// `/` -- search-mode palette, but only when the user isn't typing
	// into a form field (so authors can write slashes in content without
	// the palette eating the keystroke).
	if (event.key === '/' && !open && !isEditable(event.target)) {
		event.preventDefault();
		openInMode('search');
	}
}
</script>

<svelte:window onkeydown={handleWindowKey} />

<button
	type="button"
	class="trigger"
	onclick={toggleFromButton}
	aria-label="Open search"
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls="commandpalette-root"
	data-testid="helpsearch-trigger"
	data-state={open ? 'open' : 'closed'}
>
	<span class="glyph" aria-hidden="true">⌕</span>
	<span class="label">Search</span>
	<kbd class="hint" aria-hidden="true">/</kbd>
</button>

<CommandPalette {open} onClose={close} {surface} {app} {mode} />

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-2xs) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-muted);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.trigger:hover {
		color: var(--ink-body);
		background: var(--surface-sunken);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.glyph {
		font-size: var(--font-size-base);
	}

	.hint {
		margin-left: var(--space-2xs);
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		background: var(--surface-sunken);
	}

	@media (max-width: 640px) { /* --ab-breakpoint-md */
		.label {
			display: none;
		}
	}
</style>
