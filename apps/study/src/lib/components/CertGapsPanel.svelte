<!--
CertGapsPanel -- the "this course leaves N cert leaves uncovered" panel
rendered below the course detail tree when the cert overlay is active.

Consumes a `gaps: CertGap[]` prop emitted by `courseWithCertOverlayLens`.
The lens already sorts by `(ordinal, code)` so the panel renders in
cert-traversal order. Empty arrays render nothing -- the parent route
already gates on `certGaps.length > 0` before mounting.

Per spec.md "Cert overlay surfaces": this panel answers "what does this
course leave uncovered?" The chip strip on the step reader (Phase 4)
answers the complementary question "does this step satisfy a cert leaf?"

Future: each entry should link to the matching ACS area page in the cert
dashboard. Today the dashboard's per-leaf URL is not a stable shape; the
panel renders the code as plain text for now. Linking is a small follow-up
once the cert dashboard exposes a deep-link.
-->
<script lang="ts">
import type { CertGap } from '@ab/bc-study';
import { BLOOM_LEVEL_LABELS, type BloomLevel } from '@ab/constants';

interface Props {
	gaps: CertGap[];
}

let { gaps }: Props = $props();

function bloomLabel(bloom: BloomLevel | null): string {
	if (bloom === null) return '';
	return BLOOM_LEVEL_LABELS[bloom] ?? bloom;
}
</script>

<section class="panel" aria-labelledby="cert-gaps-heading">
	<header class="head">
		<h2 id="cert-gaps-heading" class="title">Cert gaps</h2>
		<p class="subtitle">
			These cert leaves are required by the overlaid syllabus but no step in this course covers them.
		</p>
	</header>
	<ul class="gaps">
		{#each gaps as gap (gap.syllabusNodeId)}
			<li class="gap">
				<span class="gap-code">{gap.code}</span>
				<span class="gap-title">{gap.title}</span>
				{#if gap.requiredBloom !== null}
					<span class="gap-bloom">{bloomLabel(gap.requiredBloom)}</span>
				{/if}
				{#if gap.knowledgeNodeIds.length > 0}
					<span class="gap-count">
						{gap.knowledgeNodeIds.length} linked node{gap.knowledgeNodeIds.length === 1 ? '' : 's'}
					</span>
				{:else}
					<span class="gap-count gap-count-empty">No linked nodes authored</span>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.panel {
		background: var(--ink-inverse);
		border: 1px solid var(--signal-warning-edge);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.title {
		margin: 0;
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
	}

	.subtitle {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-definition-body-size);
		line-height: 1.45;
	}

	.gaps {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.gap {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		font-size: var(--type-definition-body-size);
	}

	.gap-code {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.gap-title {
		color: var(--ink-body);
	}

	.gap-bloom {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-pill);
		background: var(--surface-muted);
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.gap-count {
		font-size: var(--type-ui-caption-size);
		color: var(--ink-subtle);
	}

	.gap-count-empty {
		color: var(--signal-warning);
		font-style: italic;
	}
</style>
