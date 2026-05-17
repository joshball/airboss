<!--
EncodedTextLadderTabs -- the Decode/Understand/Triage hint strip rendered
above an encoded-text family node body (METAR, TAF, PIREP, etc.). The tabs
are visual hints only this WP per OUT-OF-SCOPE.md "Encoded-text per-tab
content" -- they orient the learner to the skill ladder pattern but do not
filter the body. Real per-tab content lands in a follow-on once the
encoded-text family has authored skill-ladder cards / scenarios.
-->
<script lang="ts">
import { ENCODED_TEXT_LADDER_TAB_LABELS, ENCODED_TEXT_LADDER_TABS } from '@ab/constants';
</script>

<aside class="ladder" aria-label="Skill ladder">
	<span class="ladder-eyebrow">Skill ladder</span>
	<ul class="tabs" role="list">
		{#each ENCODED_TEXT_LADDER_TABS as tab, i (i)}
			<li class="tab">{ENCODED_TEXT_LADDER_TAB_LABELS[tab]}</li>
		{/each}
	</ul>
	<p class="ladder-note">
		This product follows the decode -> understand -> triage skill ladder. Authored per-tab content is on the
		roadmap.
	</p>
</aside>

<style>
	.ladder {
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.ladder-eyebrow {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.tabs {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.tab {
		padding: var(--space-2xs) var(--space-md);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		font-size: var(--type-ui-label-size);
		font-weight: 500;
		color: var(--ink-body);
	}

	.ladder-note {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
	}
</style>
