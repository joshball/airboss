<script lang="ts" module>
export type DialogSize = 'sm' | 'md' | 'lg';

/**
 * Canonical close glyph for every Dialog/Drawer header. U+00D7 multiplication
 * sign reads better at small sizes than the ASCII `x` and stays a single
 * visual unit. Centralised here so the five legacy popovers don't drift.
 */
export const DIALOG_CLOSE_GLYPH = '×';
</script>

<script lang="ts">
import { tick, untrack, type Snippet } from 'svelte';
import { createFocusTrap, type FocusTrap } from '../lib/focus-trap';

/**
 * Accessible, controlled dialog primitive.
 *
 * Snippets for header / body / footer so callers compose the chrome.
 * Controlled `open` via `bind:open={...}`. Focus-trap via the shared
 * helper. ESC and scrim click both close.
 *
 * Header layout: when both `header` snippet and the built-in close button
 * are rendered, the close button sits to the right of whatever the header
 * snippet renders (typically the title). Pass `showClose={false}` to
 * suppress the built-in close button (rare -- e.g. a confirm dialog that
 * forces a button choice).
 *
 * Colors, radii and shadow come from `--dialog-*` component tokens.
 */

let {
	open = $bindable(false),
	size = 'md',
	ariaLabel,
	ariaLabelledby,
	showClose = true,
	closeLabel = 'Close',
	onClose,
	header,
	body,
	footer,
	children,
}: {
	open?: boolean;
	size?: DialogSize;
	ariaLabel?: string;
	ariaLabelledby?: string;
	/**
	 * Render the built-in close button in the header row. Defaults to true.
	 * The button uses the canonical `DIALOG_CLOSE_GLYPH` and an
	 * `aria-label` of `closeLabel`. Suppress only when the dialog must
	 * force the user through a footer button.
	 */
	showClose?: boolean;
	/** Accessible label for the built-in close button. */
	closeLabel?: string;
	onClose?: () => void;
	header?: Snippet;
	body?: Snippet;
	footer?: Snippet;
	children?: Snippet;
} = $props();

let panelEl = $state<HTMLDivElement | null>(null);
let previousFocus: HTMLElement | null = null;
// Cache one focus-trap per modal-open instead of allocating per keystroke.
// Re-built when the panel mounts or the user re-opens the dialog.
let trap: FocusTrap | null = null;

function close(): void {
	open = false;
	onClose?.();
}

function handleKeyDown(event: KeyboardEvent): void {
	trap?.handleKeyDown(event);
}

function handleScrimPointerDown(event: PointerEvent): void {
	if (event.target === event.currentTarget) close();
}

$effect(() => {
	if (!open) return;
	untrack(() => {
		previousFocus = (document.activeElement as HTMLElement | null) ?? null;
	});
	void tick().then(() => {
		if (panelEl) {
			trap = createFocusTrap(panelEl, { onEscape: close });
		}
		const first = panelEl?.querySelector<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		);
		(first ?? panelEl)?.focus();
	});
	return () => {
		trap?.release();
		trap = null;
		previousFocus?.focus?.();
		previousFocus = null;
	};
});
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="scrim"
		onpointerdown={handleScrimPointerDown}
		onkeydown={handleKeyDown}
		role="presentation"
		data-testid="dialog-scrim"
	>
		<div
			bind:this={panelEl}
			class="panel sz-{size}"
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledby}
			tabindex="-1"
			data-testid="dialog-panel"
		>
			{#if header || showClose}
				<div class="header">
					<div class="header-content">
						{#if header}{@render header()}{/if}
					</div>
					{#if showClose}
						<button
							type="button"
							class="close"
							aria-label={closeLabel}
							data-testid="dialog-close"
							onclick={close}
						>
							<span aria-hidden="true">{DIALOG_CLOSE_GLYPH}</span>
						</button>
					{/if}
				</div>
			{/if}
			<div class="body">
				{#if body}{@render body()}{:else if children}{@render children()}{/if}
			</div>
			{#if footer}
				<div class="footer">{@render footer()}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.scrim {
		position: fixed;
		inset: 0;
		background: var(--dialog-scrim);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-lg);
		z-index: var(--z-modal);
	}

	.panel {
		background: var(--dialog-bg);
		border: 1px solid var(--dialog-edge);
		border-radius: var(--dialog-radius);
		box-shadow: var(--dialog-shadow);
		color: var(--ink-body);
		display: flex;
		flex-direction: column;
		max-height: 90vh;
		width: 100%;
		overflow: hidden;
	}

	.sz-sm { max-width: 24rem; }
	.sz-md { max-width: 36rem; }
	.sz-lg { max-width: 54rem; }

	.panel:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.header,
	.footer {
		padding: var(--space-md) var(--space-lg);
		flex: 0 0 auto;
	}

	.header {
		border-bottom: 1px solid var(--edge-subtle);
		font-weight: var(--font-weight-semibold);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.header-content {
		flex: 1 1 auto;
		min-width: 0;
	}

	.close {
		flex: 0 0 auto;
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-size: var(--font-size-xl);
		line-height: 1;
		cursor: pointer;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-sm);
	}

	.close:hover {
		color: var(--ink-body);
	}

	.close:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.body {
		padding: var(--space-md) var(--space-lg);
		overflow: auto;
		flex: 1 1 auto;
	}

	.footer {
		border-top: 1px solid var(--edge-subtle);
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
	}
</style>
