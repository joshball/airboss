<script lang="ts">
import {
	CARD_STATUS_LABELS,
	CARD_TYPE_LABELS,
	type CardStatus,
	type CardType,
	CONTENT_SOURCE_LABELS,
	type ContentSource,
	domainLabel,
	ROUTES,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import { humanize } from '@ab/utils';

/**
 * Header for the card detail page: back link, title with PageHelp, and the
 * domain/type/status/source badge row. Pure presentation; the parent owns
 * the card data model.
 */

interface CardSummary {
	id: string;
	domain: string;
	cardType: string;
	status: string;
	sourceType: string;
	sourceRef: string | null;
}

let { card }: { card: CardSummary } = $props();

function cardTypeLabel(slug: string): string {
	return (CARD_TYPE_LABELS as Record<CardType, string>)[slug as CardType] ?? humanize(slug);
}

function statusLabel(slug: string): string {
	return (CARD_STATUS_LABELS as Record<CardStatus, string>)[slug as CardStatus] ?? humanize(slug);
}

function sourceLabel(slug: string): string {
	return (CONTENT_SOURCE_LABELS as Record<ContentSource, string>)[slug as ContentSource] ?? humanize(slug);
}
</script>

<header class="hd">
	<div>
		<a class="back" href={ROUTES.MEMORY_BROWSE}><span aria-hidden="true">←</span> Browse</a>
		<div class="title-row">
			<h1 data-testid="page-anchor">Card detail</h1>
			<PageHelp pageId="memory-card" />
		</div>
	</div>
	<div class="badges">
		<span class="badge-wrap">
			<span class="badge domain">{domainLabel(card.domain)}</span>
			<InfoTip
				term="Domain"
				definition="The topic bucket this card belongs to. Drives browse filters and session mix."
				helpId="memory-card"
				helpSection="domain"
			/>
		</span>
		<span class="badge-wrap">
			<span class="badge type">{cardTypeLabel(card.cardType)}</span>
			<InfoTip
				term="Type"
				definition="Card format. Basic is a single front/back question-and-answer."
				helpId="memory-card"
				helpSection="type"
			/>
		</span>
		<span class="badge-wrap">
			<span class="badge status-{card.status}">{statusLabel(card.status)}</span>
			<InfoTip
				term={`Status: ${statusLabel(card.status)}`}
				definition="Whether this card is active, suspended, or archived. See the full lifecycle."
				helpId="memory-card"
				helpSection="lifecycle"
			/>
		</span>
		<span class="badge-wrap">
			<span class="badge source" title={card.sourceRef ?? ''}>{sourceLabel(card.sourceType)}</span>
			<InfoTip
				term={`Source: ${sourceLabel(card.sourceType)}`}
				definition="Personal cards you authored are editable. Course cards ported from curriculum material are read-only."
				helpId="memory-card"
				helpSection="source"
			/>
		</span>
	</div>
</header>

<style>
	.hd {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.back {
		color: var(--ink-muted);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.back:hover {
		color: var(--ink-body);
	}

	h1 {
		margin: var(--space-2xs) 0 0;
		font-size: var(--type-heading-2-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.badges {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.badge-wrap {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.domain {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.status-suspended {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.status-archived {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-default);
	}

	.badge.source {
		color: var(--accent-code);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}
</style>
