<script lang="ts">
import Card from '../../src/components/Card.svelte';

let {
	variant = 'raised',
	withHeader = false,
	withFooter = false,
	body = 'body content',
	headerText = 'header',
	footerText = 'footer',
	ariaLabelledby,
}: {
	variant?: 'raised' | 'muted';
	withHeader?: boolean;
	withFooter?: boolean;
	body?: string;
	headerText?: string;
	footerText?: string;
	ariaLabelledby?: string;
} = $props();
</script>

{#if withHeader && withFooter}
	<Card {variant} {ariaLabelledby}>
		{#snippet header()}<span data-testid="harness-header-content">{headerText}</span>{/snippet}
		<span data-testid="harness-body-content">{body}</span>
		{#snippet footer()}<span data-testid="harness-footer-content">{footerText}</span>{/snippet}
	</Card>
{:else if withHeader}
	<Card {variant} {ariaLabelledby}>
		{#snippet header()}<span data-testid="harness-header-content">{headerText}</span>{/snippet}
		<span data-testid="harness-body-content">{body}</span>
	</Card>
{:else if withFooter}
	<Card {variant} {ariaLabelledby}>
		<span data-testid="harness-body-content">{body}</span>
		{#snippet footer()}<span data-testid="harness-footer-content">{footerText}</span>{/snippet}
	</Card>
{:else}
	<Card {variant} {ariaLabelledby}>
		<span data-testid="harness-body-content">{body}</span>
	</Card>
{/if}
