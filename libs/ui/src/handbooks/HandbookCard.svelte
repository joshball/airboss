<script lang="ts">
import { ROUTES } from '@ab/constants';

interface Progress {
	totalSections: number;
	readSections: number;
	readingSections: number;
	unreadSections: number;
}

let {
	documentSlug,
	edition,
	title,
	progress,
}: {
	documentSlug: string;
	edition: string;
	title: string;
	progress: Progress;
} = $props();

const percentRead = $derived(
	progress.totalSections === 0 ? 0 : Math.round((progress.readSections / progress.totalSections) * 100),
);
</script>

<a class="handbook-card" href={ROUTES.HANDBOOK(documentSlug)}>
	<div class="header">
		<h3>{title}</h3>
		<span class="edition" title="Edition">{edition}</span>
	</div>
	<div class="progress" aria-label="Reading progress">
		<div class="bar">
			<div class="fill" style="width: {percentRead}%" aria-hidden="true"></div>
		</div>
		<div class="counts">
			<span>{progress.readSections} read</span>
			<span class="dot" aria-hidden="true">·</span>
			<span>{progress.readingSections} reading</span>
			<span class="dot" aria-hidden="true">·</span>
			<span>{progress.unreadSections} unread</span>
		</div>
	</div>
</a>

<style>
	.handbook-card {
		display: block;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.handbook-card:hover,
	.handbook-card:focus-visible {
		border-color: var(--action-default-edge);
		outline: none;
	}
	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-sm);
		margin-bottom: var(--space-sm);
	}
	h3 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
	}
	.edition {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.bar {
		height: var(--space-2xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		overflow: hidden;
		margin-bottom: var(--space-xs);
	}
	.fill {
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-normal) ease;
	}
	.counts {
		display: flex;
		gap: var(--space-xs);
		color: var(--ink-muted);
	}
	.dot {
		color: var(--edge-subtle);
	}
</style>
