<script lang="ts">
import {
	AVIATION_TOPIC_LABELS,
	AVIATION_TOPIC_VALUES,
	CERT_APPLICABILITY_LABELS,
	CERT_APPLICABILITY_VALUES,
	FLIGHT_RULES_LABELS,
	FLIGHT_RULES_VALUES,
	KNOWLEDGE_KIND_LABELS,
	KNOWLEDGE_KIND_VALUES,
	REFERENCE_PHASE_OF_FLIGHT_LABELS,
	REFERENCE_PHASE_OF_FLIGHT_VALUES,
	SOURCE_TYPE_LABELS,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';

/**
 * Facet sidebar for /glossary. One section per axis; each row shows the
 * axis value label and its count in the current result set. Rows are
 * `<a>` links wired to query-string params so state is shareable.
 */

let {
	counts,
}: {
	counts: {
		sourceType: Readonly<Record<string, number>>;
		aviationTopic: Readonly<Record<string, number>>;
		flightRules: Readonly<Record<string, number>>;
		knowledgeKind: Readonly<Record<string, number>>;
		phaseOfFlight: Readonly<Record<string, number>>;
		certApplicability: Readonly<Record<string, number>>;
	};
} = $props();
</script>

<aside class="sidebar" aria-label="Filter references">
	<section>
		<h3>Source</h3>
		<ul>
			{#each SOURCE_TYPE_VALUES as value (value)}
				<li>
					<span class="v">{SOURCE_TYPE_LABELS[value]}</span>
					<span class="n">{counts.sourceType[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3>Topic</h3>
		<ul>
			{#each AVIATION_TOPIC_VALUES as value (value)}
				<li>
					<span class="v">{AVIATION_TOPIC_LABELS[value]}</span>
					<span class="n">{counts.aviationTopic[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3>Rules</h3>
		<ul>
			{#each FLIGHT_RULES_VALUES as value (value)}
				<li>
					<span class="v">{FLIGHT_RULES_LABELS[value]}</span>
					<span class="n">{counts.flightRules[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3>Kind</h3>
		<ul>
			{#each KNOWLEDGE_KIND_VALUES as value (value)}
				<li>
					<span class="v">{KNOWLEDGE_KIND_LABELS[value]}</span>
					<span class="n">{counts.knowledgeKind[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3>Phase</h3>
		<ul>
			{#each REFERENCE_PHASE_OF_FLIGHT_VALUES as value (value)}
				<li>
					<span class="v">{REFERENCE_PHASE_OF_FLIGHT_LABELS[value]}</span>
					<span class="n">{counts.phaseOfFlight[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3>Cert</h3>
		<ul>
			{#each CERT_APPLICABILITY_VALUES as value (value)}
				<li>
					<span class="v">{CERT_APPLICABILITY_LABELS[value]}</span>
					<span class="n">{counts.certApplicability[value] ?? 0}</span>
				</li>
			{/each}
		</ul>
	</section>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-xs);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-muted);
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: var(--font-size-sm);
		color: var(--ink-body);
	}

	.n {
		color: var(--ink-subtle);
		font-variant-numeric: tabular-nums;
	}
</style>
