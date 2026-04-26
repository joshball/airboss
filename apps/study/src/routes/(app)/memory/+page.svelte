<script lang="ts">
import { summarizeDeckSpec } from '@ab/bc-study';
import {
	CARD_STATES,
	DOMAIN_LABELS,
	type Domain,
	MASTERY_STABILITY_DAYS,
	QUERY_PARAMS,
	REVIEW_SESSION_STATUSES,
	ROUTES,
	SAVED_DECK_COPY,
	SAVED_DECK_LABEL_MAX_LENGTH,
} from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import ConfirmAction from '@ab/ui/components/ConfirmAction.svelte';
import InfoTip from '@ab/ui/components/InfoTip.svelte';
import StatTile from '@ab/ui/components/StatTile.svelte';
import { humanize } from '@ab/utils';
import type { ActionData, PageData } from './$types';

const STATE_TIPS: Record<'new' | 'learning' | 'review' | 'relearning', { label: string; definition: string }> = {
	new: {
		label: 'New',
		definition: 'Cards you have not reviewed yet. They enter the rotation the first time you see them.',
	},
	learning: {
		label: 'Learning',
		definition: 'New cards still being introduced. Short intervals until the first successful review.',
	},
	review: { label: 'Review', definition: 'Cards in long-term rotation. Intervals grow as stability grows.' },
	relearning: {
		label: 'Relearning',
		definition: 'Cards you recently forgot. Back to short intervals until they stabilize.',
	},
};

let { data, form }: { data: PageData; form: ActionData } = $props();

const stats = $derived(data.stats);
const totalActive = $derived(Object.values(stats.stateCounts).reduce((a, b) => a + b, 0));
const resumable = $derived(data.resumableSession);
const savedDecks = $derived(data.savedDecks);

/**
 * Per-row open state for the inline rename popover. Keyed by `deckHash` so
 * opening one row's editor closes the others (one rename in flight at a
 * time keeps the focus model unambiguous). Undefined => closed.
 */
let renamingHash = $state<string | null>(null);

function openRename(hash: string): void {
	renamingHash = hash;
}

function cancelRename(): void {
	renamingHash = null;
}

/**
 * Svelte action: focus the bound element on mount. Replaces `autofocus`
 * (banned by `a11y_autofocus`) for the rename input, which only mounts in
 * response to a deliberate Rename click -- the same user gesture that
 * `autofocus` would have honored, just without the global lint warning.
 */
function focusOnMount(node: HTMLElement): void {
	node.focus();
}

/**
 * Pull a friendly display name out of the (label override, deck spec)
 * pair. Lives next to the renderer so the SR text and the visible label
 * stay in lockstep.
 */
function deckName(deck: { label: string | null; deckSpec: Parameters<typeof summarizeDeckSpec>[0] }): string {
	return deck.label?.length ? deck.label : summarizeDeckSpec(deck.deckSpec);
}

/**
 * SvelteKit derives `ActionData` from the intersection of every `fail()`
 * branch (and the redirect path narrows to `null`). We read it through
 * a permissive shape because (a) the BC is the source of truth for which
 * fields are valid, and (b) the per-branch narrowing makes "is there a
 * label error?" awkward across action variants. The runtime semantics
 * ("surface whichever error is present") are preserved.
 */
type SavedDeckFormShape = {
	intent?: string;
	deckHash?: string;
	fieldErrors?: { label?: string; _?: string };
};

const renameForm = $derived(
	form && (form as SavedDeckFormShape).intent === 'renameDeck' ? (form as SavedDeckFormShape) : null,
);
const renameError = $derived(renameForm?.fieldErrors?.label ?? renameForm?.fieldErrors?._ ?? null);
const renameErrorHash = $derived(renameForm?.deckHash ?? null);

const deleteForm = $derived(
	form && (form as SavedDeckFormShape).intent === 'deleteDeck' ? (form as SavedDeckFormShape) : null,
);
const deleteError = $derived(deleteForm?.fieldErrors?._ ?? null);

function formatResumeSub(sub: { status: string; currentIndex: number; totalCards: number }): string {
	const remaining = Math.max(0, sub.totalCards - sub.currentIndex);
	const label = sub.status === REVIEW_SESSION_STATUSES.ABANDONED ? 'Stale run' : 'In progress';
	if (sub.totalCards === 0) return `${label} -- empty deck`;
	return `${label} -- ${sub.currentIndex} of ${sub.totalCards} reviewed${remaining > 0 ? `, ${remaining} to go` : ''}`;
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<Domain, string>)[slug as Domain] ?? humanize(slug);
}

/**
 * Build the deck-review URL from an encoded `?deck=` value. Inline-built
 * because `ROUTES.MEMORY_REVIEW` is a static string and the encoder lives
 * in the BC; routing the construction through a route helper would just
 * shuffle the string concatenation one layer up.
 */
function deckHref(deckParam: string): string {
	return `${ROUTES.MEMORY_REVIEW}?${QUERY_PARAMS.DECK}=${deckParam}`;
}

function formatLastVisited(iso: string): string {
	const d = new Date(iso);
	const today = new Date();
	const sameDay = d.toDateString() === today.toDateString();
	if (sameDay) {
		return `today ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
	}
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatResumeBadge(r: { currentIndex: number; totalCards: number }): string {
	if (r.totalCards === 0) return 'empty';
	return `${r.currentIndex} of ${r.totalCards}`;
}

function percent(n: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((n / total) * 100);
}
</script>

<svelte:head>
	<title>Memory -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<div class="title-row">
				<h1>Memory</h1>
				<PageHelp pageId="memory-dashboard" />
			</div>
			<p class="sub">Cards you've written; the algorithm schedules reviews.</p>
		</div>
		<nav class="quick" aria-label="Quick actions">
			<a class="btn ghost" href={ROUTES.MEMORY_BROWSE}>Browse</a>
			<a class="btn secondary" href={ROUTES.MEMORY_NEW}>New card</a>
			<a class="btn primary" href={ROUTES.MEMORY_REVIEW}>Start review</a>
		</nav>
	</header>

	{#if resumable}
		<a class="resume-tile" href={ROUTES.MEMORY_REVIEW_SESSION(resumable.id)}>
			<div class="resume-label">Resume your last run</div>
			<div class="resume-sub">{formatResumeSub(resumable)}</div>
			<div class="resume-cta">Continue -&gt;</div>
		</a>
	{/if}

	{#if savedDecks.length > 0}
		<article class="saved-decks">
			<h2>Saved decks</h2>
			<p class="hint">Bookmarkable filters from your past runs. Each entry rebuilds the same deck.</p>
			{#if deleteError}
				<p class="form-error" role="alert">{deleteError}</p>
			{/if}
			<ul class="deck-list">
				{#each savedDecks as deck (deck.deckHash)}
					<li class="deck-item">
						{#if renamingHash === deck.deckHash}
							<form
								method="POST"
								action="?/renameDeck"
								class="deck-rename"
								aria-label="Rename {deckName(deck)}"
							>
								<input type="hidden" name="deckHash" value={deck.deckHash} />
								<label class="rename-label">
									<span class="visually-hidden">{SAVED_DECK_COPY.RENAME_LABEL_INPUT}</span>
									<input
										type="text"
										name="label"
										class="rename-input"
										value={deck.label ?? ''}
										maxlength={SAVED_DECK_LABEL_MAX_LENGTH}
										placeholder={SAVED_DECK_COPY.RENAME_PLACEHOLDER}
										autocomplete="off"
										aria-invalid={renameErrorHash === deck.deckHash ? 'true' : undefined}
										aria-describedby={renameErrorHash === deck.deckHash
											? `rename-error-${deck.deckHash}`
											: undefined}
										use:focusOnMount
									/>
								</label>
								<div class="rename-actions">
									<button type="submit" class="btn primary sm">{SAVED_DECK_COPY.RENAME_SAVE}</button>
									<button type="button" class="btn ghost sm" onclick={cancelRename}>
										{SAVED_DECK_COPY.RENAME_CANCEL}
									</button>
								</div>
								{#if renameErrorHash === deck.deckHash && renameError}
									<p class="form-error" id="rename-error-{deck.deckHash}" role="alert">{renameError}</p>
								{/if}
								<p class="rename-hint">{SAVED_DECK_COPY.RENAME_CLEAR}: leave blank and Save.</p>
							</form>
						{:else}
							<div class="deck-row">
								<a class="deck-link" href={deckHref(deck.deckParam)}>
									<div class="deck-head">
										<span class="deck-label">{deckName(deck)}</span>
										{#if deck.resumable}
											<span class="deck-badge">Resume {formatResumeBadge(deck.resumable)}</span>
										{/if}
									</div>
									<div class="deck-meta">
										<span>Last run {formatLastVisited(deck.lastVisitedAt)}</span>
										<span>{deck.sessionCount} {deck.sessionCount === 1 ? 'run' : 'runs'}</span>
									</div>
								</a>
								<div class="deck-actions">
									<button
										type="button"
										class="btn ghost sm"
										onclick={() => openRename(deck.deckHash)}
										aria-label="{SAVED_DECK_COPY.RENAME_TRIGGER} {deckName(deck)}"
									>
										{SAVED_DECK_COPY.RENAME_TRIGGER}
									</button>
									<ConfirmAction
										formAction="?/deleteDeck"
										triggerVariant="ghost"
										confirmVariant="danger"
										size="sm"
										label={SAVED_DECK_COPY.DELETE_TRIGGER}
										confirmLabel={SAVED_DECK_COPY.DELETE_CONFIRM}
										hiddenFields={{ deckHash: deck.deckHash }}
									/>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</article>
	{/if}

	<div class="grid">
		<div class="tile-wrap">
			<StatTile
				label="Due now"
				value={stats.dueNow}
				sub="{stats.dueNow === 1 ? 'card' : 'cards'} to review"
				href={stats.dueNow > 0 ? ROUTES.MEMORY_REVIEW : undefined}
				tone="featured"
				ariaLabel="Due now: {stats.dueNow} cards to review"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Due now"
					definition="Cards the scheduler says are ready to review right now. The queue grows as stability clocks elapse."
					helpId="memory-review"
					helpSection="how-scheduling-works"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Reviewed today"
				value={stats.reviewedToday}
				sub={stats.reviewedToday === 1 ? 'review' : 'reviews'}
				href={`${ROUTES.MEMORY_BROWSE}?${QUERY_PARAMS.STATUS}=active`}
				ariaLabel="Reviewed today: {stats.reviewedToday}, browse active cards"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Reviewed today"
					definition="Reviews you have rated since local midnight. Includes repeat reviews of the same card."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Streak"
				value={stats.streakDays}
				sub={stats.streakDays === 1 ? 'day' : 'days'}
				href={ROUTES.CALIBRATION}
				ariaLabel="Streak: {stats.streakDays} days, open calibration"
			/>
			<span class="tile-tip">
				<InfoTip
					term="Streak"
					definition="Consecutive days you reviewed at least one due card. Resets if a day passes with zero reviews."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
		<div class="tile-wrap">
			<StatTile
				label="Active cards"
				value={totalActive}
				sub="across {stats.domains.length} {stats.domains.length === 1 ? 'domain' : 'domains'}"
				href={ROUTES.MEMORY_BROWSE}
			/>
			<span class="tile-tip">
				<InfoTip
					term="Active cards"
					definition="Cards currently in rotation. Excludes suspended and archived items."
					helpId="memory-dashboard"
				/>
			</span>
		</div>
	</div>

	<article class="card-list">
		<h2>By state</h2>
		<ul class="states">
			<li>
				<span class="state-cell">
					<span class="state-label">New</span>
					<InfoTip
						term={STATE_TIPS.new.label}
						definition={STATE_TIPS.new.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.NEW]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Learning</span>
					<InfoTip
						term={STATE_TIPS.learning.label}
						definition={STATE_TIPS.learning.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.LEARNING]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Review</span>
					<InfoTip
						term={STATE_TIPS.review.label}
						definition={STATE_TIPS.review.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.REVIEW]}</span>
			</li>
			<li>
				<span class="state-cell">
					<span class="state-label">Relearning</span>
					<InfoTip
						term={STATE_TIPS.relearning.label}
						definition={STATE_TIPS.relearning.definition}
						helpId="concept-fsrs"
						helpSection="states"
					/>
				</span>
				<span class="state-count">{stats.stateCounts[CARD_STATES.RELEARNING]}</span>
			</li>
		</ul>
	</article>

	<article class="card-list">
		<div class="domain-hd">
			<h2>By domain</h2>
			<InfoTip
				term="Domain breakdown"
				definition="Per-domain totals, due count, and the percent of cards with stability above the mastery threshold."
				helpId="concept-fsrs"
				helpSection="stability-and-mastery"
			/>
		</div>
		{#if stats.domains.length === 0}
			<p class="empty-note">No active cards yet. <a href={ROUTES.MEMORY_NEW}>Create your first</a>.</p>
		{:else}
			<ul class="domains">
				{#each stats.domains as d (d.domain)}
					<li>
						<div class="dm-head">
							<a class="dm-name" href={`${ROUTES.MEMORY_BROWSE}?domain=${encodeURIComponent(d.domain)}`}>
								{domainLabel(d.domain)}
							</a>
							<span class="dm-counts">
								<span class="dm-total">{d.total}</span>
								{#if d.due > 0}<span class="dm-due">{d.due} due</span>{/if}
							</span>
						</div>
						<div class="bar" aria-hidden="true">
							<span class="bar-fill" style="width: {percent(d.mastered, d.total)}%"></span>
						</div>
						<div class="dm-sub">{percent(d.mastered, d.total)}% mastered (stability &gt; {MASTERY_STABILITY_DAYS}d)</div>
					</li>
				{/each}
			</ul>
		{/if}
	</article>
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.sub {
		margin: var(--space-2xs) 0 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-body);
	}

	.quick {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--space-md);
	}

	.resume-tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-md) var(--space-lg);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-lg);
		text-decoration: none;
		color: var(--action-default-hover);
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.resume-tile:hover {
		background: var(--action-default-wash);
		border-color: var(--action-default-hover);
	}

	.resume-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.resume-sub {
		color: var(--ink-muted);
		font-size: var(--font-size-body);
	}

	.resume-cta {
		color: var(--action-default-hover);
		font-weight: 600;
		font-size: var(--font-size-sm);
	}

	.saved-decks {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-xl);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}

	.saved-decks h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.hint {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--font-size-sm);
	}

	.deck-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.deck-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: stretch;
		gap: var(--space-xs);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-2xs) var(--space-2xs) var(--space-2xs) 0;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.deck-row:hover {
		background: var(--surface-sunken);
		border-color: var(--action-default-hover);
	}

	.deck-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		text-decoration: none;
		color: inherit;
		min-width: 0;
	}

	.deck-actions {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding-right: var(--space-2xs);
	}

	.deck-rename {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-sunken);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
	}

	.rename-label {
		display: block;
	}

	.rename-input {
		width: 100%;
		font-family: inherit;
		font-size: var(--font-size-body);
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.rename-input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.rename-actions {
		display: inline-flex;
		gap: var(--space-xs);
	}

	.rename-hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.btn.sm {
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.form-error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--button-hazard-bg);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.deck-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-md);
	}

	.deck-label {
		color: var(--ink-body);
		font-weight: 500;
	}

	.deck-badge {
		color: var(--action-default-hover);
		font-size: var(--font-size-sm);
		font-weight: 600;
	}

	.deck-meta {
		display: flex;
		justify-content: space-between;
		gap: var(--space-md);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	/* StatTile provides its own styling; the grid just lays them out. */

	.tile-wrap {
		position: relative;
		display: flex;
	}

	.tile-wrap > :global(.tile) {
		flex: 1;
	}

	.tile-tip {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
	}

	.card-list {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-xl) var(--space-xl);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.card-list h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.states {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: var(--space-sm);
	}

	.states li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
	}

	.state-cell {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
	}

	.state-label {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	.domain-hd {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.domain-hd h2 {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: 600;
	}

	.state-count {
		color: var(--ink-body);
		font-weight: 600;
	}

	.domains {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.domains li {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.dm-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.dm-name {
		color: var(--ink-body);
		text-decoration: none;
		font-weight: 500;
	}

	.dm-name:hover {
		color: var(--action-default-hover);
	}

	.dm-counts {
		display: flex;
		gap: var(--space-sm);
		font-size: var(--font-size-sm);
	}

	.dm-total {
		color: var(--ink-subtle);
	}

	.dm-due {
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.bar {
		background: var(--edge-default);
		height: 0.375rem;
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	.bar-fill {
		display: block;
		height: 100%;
		background: var(--action-default);
		transition: width var(--motion-normal);
	}

	.dm-sub {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
	}

	.empty-note {
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		margin: 0;
	}

	.empty-note a {
		color: var(--action-default-hover);
		font-weight: 500;
	}

	.btn {
		padding: var(--space-sm) var(--space-lg);
		font-size: var(--font-size-body);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.btn.primary {
		background: var(--action-default);
		color: var(--ink-inverse);
	}

	.btn.primary:hover {
		background: var(--action-default-hover);
	}

	.btn.secondary {
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-color: var(--edge-strong);
	}

	.btn.secondary:hover {
		background: var(--edge-default);
	}

	.btn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}

	.btn.ghost:hover {
		background: var(--surface-sunken);
	}
</style>
