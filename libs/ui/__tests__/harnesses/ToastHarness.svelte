<script lang="ts">
import Toast, { type ToastShape, type ToastTone } from '../../src/components/Toast.svelte';

let {
	tone = 'success',
	shape = 'pill',
	live,
	ariaLabel,
	body = 'Saved.',
	withActions = false,
	actionLabel = 'Undo',
}: {
	tone?: ToastTone;
	shape?: ToastShape;
	live?: 'polite' | 'assertive';
	ariaLabel?: string;
	body?: string;
	withActions?: boolean;
	actionLabel?: string;
} = $props();
</script>

{#if withActions}
	<Toast {tone} {shape} {live} {ariaLabel}>
		<span data-testid="harness-toast-body">{body}</span>
		{#snippet actions()}
			<button type="button" data-testid="harness-toast-action">{actionLabel}</button>
		{/snippet}
	</Toast>
{:else}
	<Toast {tone} {shape} {live} {ariaLabel}>
		<span data-testid="harness-toast-body">{body}</span>
	</Toast>
{/if}
