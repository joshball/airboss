<script lang="ts">
import BadgeStatus, { type BadgeStatusState } from '../../src/components/BadgeStatus.svelte';

let {
	state = 'idle',
	ariaLabel,
	body = 'Active',
}: {
	state?: BadgeStatusState;
	ariaLabel?: string;
	body?: string;
} = $props();
</script>

<BadgeStatus {state} {ariaLabel}>
	<span data-testid="harness-badge-body">{body}</span>
</BadgeStatus>
