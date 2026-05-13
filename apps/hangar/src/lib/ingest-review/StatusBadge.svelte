<script lang="ts">
import { INGEST_STATUS_LABELS, type IngestStatus } from '@ab/constants';

interface Props {
	status: IngestStatus;
}

const { status }: Props = $props();
</script>

<span class="badge" data-status={status}>{INGEST_STATUS_LABELS[status]}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-3xs) var(--space-2xs);
		font-size: var(--type-ui-caption-size);
		font-weight: var(--font-weight-medium);
		border-radius: var(--radius-pill, 999px);
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.badge[data-status='unresolved'] {
		background: var(--signal-warning-wash, var(--surface-sunken));
		color: var(--signal-warning-deep-ink, var(--ink-body));
	}

	.badge[data-status='resolved'] {
		background: var(--signal-success-wash, var(--surface-sunken));
		color: var(--signal-success-deep-ink, var(--ink-body));
	}

	.badge[data-status='stale'] {
		background: var(--surface-sunken);
		color: var(--ink-muted);
	}

	.badge[data-status='dismissed'] {
		background: var(--surface-sunken);
		color: var(--ink-muted);
		text-decoration: line-through;
	}
</style>
