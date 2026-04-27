<script lang="ts">
let { edition }: { edition: string } = $props();
</script>

<span class="edition-badge" title="Edition">{edition}</span>

<style>
	.edition-badge {
		display: inline-block;
		padding: 0 var(--space-xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		white-space: nowrap;
	}
</style>
