<script lang="ts" module>
export type DrawerSide = 'start' | 'end';
export type DrawerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
import { tick, untrack, type Snippet } from 'svelte';
import { createFocusTrap } from '../lib/focus-trap';

/**
 * Accessible slide-over drawer primitive.
 *
 * Controlled via `bind:open`. A scrim covers the viewport; the panel slides
 * in from `side` (default: `end`, matching LTR convention for secondary
 * content). Focus moves to the first focusable descendant on open and
 * returns to the previously focused element on close. Tab/Shift+Tab cycle
 * inside the panel via the shared `createFocusTrap` helper. Escape and
 * scrim-click both close.
 *
 * Colors, radii, and motion come from role / component tokens:
 *   - `--dialog-scrim` / `--dialog-bg` / `--dialog-edge` / `--dialog-shadow`
 *   - `--motion-normal` (honoured by the token for `prefers-reduced-motion`)
 *   - `--z-modal` for stacking above page chrome but below the command palette
 *
 * Snippets for `header`, `body` / `children`, and `footer` mirror the
 * Dialog primitive so callers compose the chrome. When `body` is omitted
 * and `children` is provided, `children` renders in the body slot.
 */

let {
	open = $bindable(false),
	side = 'end',
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
	side?: DrawerSide;
	size?: DrawerSize;
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
		class="scrim side-{side}"
		onpointerdown={handleScrimPointerDown}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<div
			bind:this={panelEl}
			class="panel sz-{size} side-{side}"
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
		z-index: var(--z-modal);
	}

	.scrim.side-end {
		justify-content: flex-end;
	}

	.scrim.side-start {
		justify-content: flex-start;
	}

	.panel {
		background: var(--dialog-bg);
		border: 1px solid var(--dialog-edge);
		box-shadow: var(--dialog-shadow);
		color: var(--ink-body);
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		overflow: hidden;
		animation: drawer-slide var(--motion-normal);
	}

	.panel.side-end {
		border-top-left-radius: var(--dialog-radius);
		border-bottom-left-radius: var(--dialog-radius);
		border-right: none;
	}

	.panel.side-start {
		border-top-right-radius: var(--dialog-radius);
		border-bottom-right-radius: var(--dialog-radius);
		border-left: none;
		animation-name: drawer-slide-reverse;
	}

	.sz-sm { max-width: 20rem; }
	.sz-md { max-width: 32rem; }
	.sz-lg { max-width: 48rem; }

	.panel:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
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

	@keyframes drawer-slide {
		from { transform: translateX(100%); }
		to { transform: translateX(0); }
	}

	@keyframes drawer-slide-reverse {
		from { transform: translateX(-100%); }
		to { transform: translateX(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.panel {
			animation: none;
		}
	}
</style>
