<script lang="ts" module>
export type DialogSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
import { tick, untrack, type Snippet } from 'svelte';
import { createFocusTrap } from '../lib/focus-trap';

/**
 * Accessible, controlled dialog primitive.
 *
 * Snippets for header / body / footer so callers compose the chrome.
 * Controlled `open` via `bind:open={...}`. Focus-trap via the shared
 * helper. ESC and scrim click both close.
 *
 * Colors, radii and shadow come from `--dialog-*` component tokens.
 */

let {
	open = $bindable(false),
	size = 'md',
	ariaLabel,
	ariaLabelledby,
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
	onClose?: () => void;
	header?: Snippet;
	body?: Snippet;
	footer?: Snippet;
	children?: Snippet;
} = $props();

let panelEl = $state<HTMLDivElement | null>(null);
let previousFocus: HTMLElement | null = null;

function close(): void {
	open = false;
	onClose?.();
}

function handleKeyDown(event: KeyboardEvent): void {
	if (!panelEl) return;
	const trap = createFocusTrap(panelEl, { onEscape: close });
	trap.handleKeyDown(event);
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
		const first = panelEl?.querySelector<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		);
		(first ?? panelEl)?.focus();
	});
	return () => {
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
	>
		<div
			bind:this={panelEl}
			class="panel sz-{size}"
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel}
			aria-labelledby={ariaLabelledby}
			tabindex="-1"
		>
			{#if header}
				<div class="header">{@render header()}</div>
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
		z-index: 100;
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
