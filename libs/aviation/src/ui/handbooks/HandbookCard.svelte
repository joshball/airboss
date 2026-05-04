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

<a class="handbook-card" href={ROUTES.LIBRARY_HANDBOOK(documentSlug)}>
	<div class="header">
		<h3>{title}</h3>
		<span class="edition" title="Edition">{edition}</span>
	</div>
	<div class="progress">
		<!--
			role="progressbar" + aria-valuenow gives AT a structured reading
			of progress without needing to aggregate the visible counts. The
			aria-valuetext also carries the friendly "N of M sections read"
			form for screen-reader users.
		-->
		<div
			class="bar"
			role="progressbar"
			aria-valuenow={percentRead}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuetext={`${progress.readSections} of ${progress.totalSections} sections read`}
		>
			<div class="fill" style="width: {percentRead}%" aria-hidden="true"></div>
		</div>
		<div class="counts">
			<span>{progress.readSections} read</span>
			<span>{progress.readingSections} reading</span>
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
	.handbook-card:hover {
		border-color: var(--action-default-edge);
	}
	.handbook-card:focus-visible {
		border-color: var(--action-default-edge);
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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
	/*
	 * Visual mid-dot separators are rendered via CSS instead of inline
	 * `<span class="dot">·</span>` text content. Cleaner DOM, AT-friendly
	 * (no decorative content to skip), and the separator color tracks the
	 * theme via tokens.
	 */
	.counts > span + span {
		border-left: 1px solid var(--edge-subtle);
		padding-left: var(--space-xs);
	}
</style>
