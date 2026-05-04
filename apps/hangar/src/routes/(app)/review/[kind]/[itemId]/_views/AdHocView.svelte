<script lang="ts" module>
export interface AdHocViewProps {
	readonly itemId: string;
	readonly itemTitle: string;
	readonly itemRef: string;
}
</script>

<script lang="ts">
import { ROUTES } from '@ab/constants';
import Card from '@ab/ui/components/Card.svelte';

let { itemId: _itemId, itemTitle: _itemTitle, itemRef }: AdHocViewProps = $props();
</script>

<div class="layout">
	<Card>
		{#snippet header()}<h2>Task details</h2>{/snippet}
		<p class="hint">This is an ad-hoc task on the review board. Edit it below.</p>
		<p class="actions">
			<a class="action-link" href={ROUTES.HANGAR_REVIEW_TASK_EDIT(itemRef)}>Open task editor</a>
			<a class="action-link" href={ROUTES.HANGAR_REVIEW}>Back to the board</a>
		</p>
	</Card>
</div>

<style>
	.layout {
		display: grid;
		grid-template-columns: minmax(0, 36rem);
		gap: var(--space-lg);
		margin-top: var(--space-md);
	}

	.hint {
		margin: 0;
		color: var(--ink-body);
	}

	.actions {
		display: flex;
		gap: var(--space-md);
		margin: var(--space-sm) 0 0;
	}

	.action-link {
		color: var(--link-default);
	}

	.action-link:hover {
		color: var(--link-hover);
	}
</style>
