<script lang="ts">
import HelpSearchPalette from './HelpSearchPalette.svelte';

/**
 * Nav-integrated search affordance. Renders a visible button ("Search / ")
 * that opens the palette, and installs global key listeners for `/`
 * and `Cmd+K` that open the same palette component. Both entry points
 * lead to the same search UI -- the top-nav button teaches the feature
 * exists; Cmd+K is the power-user shortcut.
 *
 * Global key listeners respect input-focus: pressing `/` while the user
 * is typing in a form field does NOT open the palette (lets users type
 * slashes in content).
 */

let open = $state(false);

function close(): void {
	open = false;
}

function toggleFromButton(): void {
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
	const meta = event.metaKey || event.ctrlKey;
	if (meta && event.key.toLowerCase() === 'k') {
		event.preventDefault();
		open = true;
		return;
	}
	if (event.key === '/' && !open && !isEditable(event.target)) {
		event.preventDefault();
		open = true;
	}
}
</script>

<svelte:window onkeydown={handleWindowKey} />

<button type="button" class="trigger" onclick={toggleFromButton} aria-label="Open search">
	<span class="glyph" aria-hidden="true">⌕</span>
	<span class="label">Search</span>
	<kbd class="hint" aria-hidden="true">/</kbd>
</button>

<HelpSearchPalette {open} onClose={close} />

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-radius: var(--ab-radius-sm, 4px);
		background: var(--ab-color-surface, #ffffff);
		color: var(--ab-color-fg-muted, #64748b);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.trigger:hover {
		color: var(--ab-color-fg, #0f172a);
		background: var(--ab-color-surface-sunken, #f1f5f9);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--ab-color-focus-ring, #60a5fa);
		outline-offset: 2px;
	}

	.glyph {
		font-size: 0.9375rem;
	}

	.hint {
		margin-left: 0.25rem;
		font-size: 0.6875rem;
		font-family: var(--ab-font-mono, ui-monospace, monospace);
		border: 1px solid var(--ab-color-border, #e2e8f0);
		border-bottom-width: 2px;
		border-radius: 3px;
		padding: 0 0.25rem;
		background: var(--ab-color-surface-sunken, #f1f5f9);
	}

	@media (max-width: 640px) {
		.label {
			display: none;
		}
	}
</style>
