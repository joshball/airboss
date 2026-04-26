<script lang="ts">
import PanelShell, { type PanelVariant } from '../../src/components/PanelShell.svelte';

let {
	title,
	subtitle,
	variant = 'live',
	error,
	errorMessage,
	body = 'panel body',
	withAction = false,
	actionLabel = 'Action',
}: {
	title: string;
	subtitle?: string;
	variant?: PanelVariant;
	error?: string;
	errorMessage?: string;
	body?: string;
	withAction?: boolean;
	actionLabel?: string;
} = $props();
</script>

{#if withAction}
	<PanelShell {title} {subtitle} {variant} {error} {errorMessage}>
		{#snippet action()}<button type="button" data-testid="harness-action">{actionLabel}</button>{/snippet}
		<span data-testid="harness-body-content">{body}</span>
	</PanelShell>
{:else}
	<PanelShell {title} {subtitle} {variant} {error} {errorMessage}>
		<span data-testid="harness-body-content">{body}</span>
	</PanelShell>
{/if}
