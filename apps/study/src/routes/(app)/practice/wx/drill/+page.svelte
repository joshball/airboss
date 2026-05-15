<script lang="ts">
import type { MasteryTransition } from '@ab/bc-wx-practice';
import {
	ROUTES,
	WX_PRACTICE_QUESTION_FORMS,
	type WxPracticeMasteryState,
	type WxPracticeQuestionForm,
	type WxProduct,
} from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

interface SessionItem {
	index: number;
	mode: 'quiz' | 'visible';
	masteryState: WxPracticeMasteryState;
	product: WxProduct;
	rawExample: string;
	token: string;
	family: string;
	subFamily: string | null;
	decode: string;
	why: string | null;
	questionForm: WxPracticeQuestionForm;
}

interface AttemptOutcome {
	correct: boolean;
	rationale: string;
	transition: MasteryTransition;
}

interface SessionSummary {
	sessionId: string;
	totalAttempts: number;
	correct: number;
	incorrect: number;
	perFamily: Array<{ product: string; family: string; subFamily: string | null; attempts: number; correct: number }>;
	responseMsMin: number | null;
	responseMsMax: number | null;
	responseMsAvg: number | null;
}

type Phase = 'setup' | 'in-session' | 'done';

let phase = $state<Phase>('setup');

// ---- setup form state ----
let selectedProducts = $state<WxProduct[]>(['metar']);
let tier = $state(3);
let itemCount = $state<5 | 10 | 20 | 50>(10);
let focusFamilies = $state<string[]>([]);
let startError = $state<string | null>(null);
let starting = $state(false);

// ---- in-session state ----
let sessionId = $state<string | null>(null);
let items = $state<SessionItem[]>([]);
let cursor = $state(0);
let answer = $state('');
let promptShownAt = $state(0);
let outcome = $state<AttemptOutcome | null>(null);
let submitting = $state(false);
const seenFamiliesThisSession = $state(new Set<string>());
const transitions = $state<MasteryTransition[]>([]);

// ---- end-of-session state ----
let summary = $state<SessionSummary | null>(null);

const currentItem = $derived<SessionItem | null>(items[cursor] ?? null);

function toggleProduct(p: WxProduct) {
	if (selectedProducts.includes(p)) {
		selectedProducts = selectedProducts.filter((x) => x !== p);
	} else {
		selectedProducts = [...selectedProducts, p];
	}
}

function toggleFamily(family: string) {
	if (focusFamilies.includes(family)) {
		focusFamilies = focusFamilies.filter((x) => x !== family);
	} else {
		focusFamilies = [...focusFamilies, family];
	}
}

async function startDrill() {
	startError = null;
	if (selectedProducts.length === 0) {
		startError = 'Pick at least one product.';
		return;
	}
	starting = true;
	try {
		const resp = await fetch(ROUTES.PRACTICE_WX_DRILL_START, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				products: selectedProducts,
				tier,
				focusFamilies: focusFamilies.length > 0 ? focusFamilies : null,
				itemCount,
			}),
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(text || `Start failed: ${resp.status}`);
		}
		const json = (await resp.json()) as { sessionId: string; items: SessionItem[] };
		sessionId = json.sessionId;
		items = json.items;
		cursor = 0;
		outcome = null;
		answer = '';
		promptShownAt = Date.now();
		phase = 'in-session';
		seenFamiliesThisSession.clear();
		transitions.length = 0;
		// If the very first item is a passive (visible-only), surface it but
		// also auto-advance after a short pause is handled by the user click.
	} catch (err) {
		startError = err instanceof Error ? err.message : String(err);
	} finally {
		starting = false;
	}
}

async function submitAnswer() {
	if (!sessionId || !currentItem) return;
	if (currentItem.mode === 'visible') {
		advance();
		return;
	}
	submitting = true;
	try {
		const item = currentItem;
		const familyKey = `${item.product}::${item.family}::${item.subFamily ?? ''}`;
		const acrossSession = !seenFamiliesThisSession.has(familyKey);
		seenFamiliesThisSession.add(familyKey);
		const resp = await fetch(ROUTES.PRACTICE_WX_DRILL_SUBMIT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				product: item.product,
				rawExample: item.rawExample,
				family: item.family,
				subFamily: item.subFamily,
				tokenShown: item.token,
				questionForm: item.questionForm,
				answer,
				responseMs: Date.now() - promptShownAt,
				acrossSession,
				decode: item.decode,
				why: item.why,
			}),
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(text || `Submit failed: ${resp.status}`);
		}
		const json = (await resp.json()) as AttemptOutcome;
		outcome = json;
		if (json.transition.kind !== 'none') {
			transitions.push(json.transition);
		}
	} catch (err) {
		startError = err instanceof Error ? err.message : String(err);
	} finally {
		submitting = false;
	}
}

function advance() {
	answer = '';
	outcome = null;
	cursor += 1;
	promptShownAt = Date.now();
	if (cursor >= items.length) {
		void endSession();
	}
}

async function endSession() {
	if (!sessionId) return;
	try {
		const resp = await fetch(ROUTES.PRACTICE_WX_DRILL_END, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sessionId }),
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(text || `End failed: ${resp.status}`);
		}
		const json = (await resp.json()) as { summary: SessionSummary };
		summary = json.summary;
		phase = 'done';
	} catch (err) {
		startError = err instanceof Error ? err.message : String(err);
	}
}

function resetForAnotherRound() {
	phase = 'setup';
	sessionId = null;
	items = [];
	cursor = 0;
	outcome = null;
	summary = null;
	answer = '';
	startError = null;
	transitions.length = 0;
}

function tierLabel(t: number): string {
	if (t <= 2) return 'tier 1-2: single fields';
	if (t === 3) return 'tier 3: full decode (no time pressure)';
	if (t === 4) return 'tier 4: full decode (timed)';
	if (t === 5) return 'tier 5: triage drills';
	if (t === 6) return 'tier 6: synoptic interpretation';
	if (t === 7) return 'tier 7: cross-station reasoning';
	if (t === 8) return 'tier 8: English-to-METAR encoding';
	if (t === 9) return 'tier 9: tricky / gotcha-heavy';
	return 'tier 10: TAF change-group reasoning';
}

function transitionMessage(family: string, t: MasteryTransition): string {
	if (t.kind === 'promoted') return `Promoted ${family} to passive -- you've nailed it across sessions.`;
	if (t.kind === 'demoted') return `Bumped ${family} back into the rotation -- you'll see it again.`;
	if (t.kind === 'recovered') return `Recovered ${family} -- nice run.`;
	return '';
}

function questionPrompt(item: SessionItem): string {
	switch (item.questionForm) {
		case WX_PRACTICE_QUESTION_FORMS.DECODE_GROUP:
			return `Decode the ${item.family} group: ${item.token}`;
		case WX_PRACTICE_QUESTION_FORMS.SINGLE_CHOICE:
			return `Pick the right interpretation of ${item.token}`;
		case WX_PRACTICE_QUESTION_FORMS.MULTI_CHOICE:
			return `Select all that apply for ${item.token}`;
		case WX_PRACTICE_QUESTION_FORMS.STRUCTURED:
			return `Fill in the fields for ${item.token}`;
		default:
			return `What does ${item.token} mean?`;
	}
}
</script>

<svelte:head>
	<title>Weather drill -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<h1 data-testid="page-anchor">Weather drill</h1>
		<p class="lead">
			Token-by-token fluency drills on METAR / TAF / PIREP / FB / AIRMET. Tokens you've mastered are shown but not
			quizzed; misses are oversampled in the next session.
		</p>
	</header>

	{#if phase === 'setup'}
		<div class="setup">
			<fieldset class="block">
				<legend>Products</legend>
				<div class="chips">
					{#each data.products as p (p.slug)}
						<button
							type="button"
							class="chip"
							class:on={selectedProducts.includes(p.slug)}
							onclick={() => toggleProduct(p.slug)}
							data-testid={`product-chip-${p.slug}`}
						>
							{p.label}
						</button>
					{/each}
				</div>
			</fieldset>

			<fieldset class="block">
				<legend>Tier ({tier})</legend>
				<input
					type="range"
					min={data.tierRange.min}
					max={data.tierRange.max}
					bind:value={tier}
					data-testid="tier-range"
				/>
				<div class="tier-label">{tierLabel(tier)}</div>
			</fieldset>

			<fieldset class="block">
				<legend>How many items?</legend>
				<div class="chips">
					{#each data.itemCounts as n (n)}
						<button
							type="button"
							class="chip"
							class:on={itemCount === n}
							onclick={() => (itemCount = n as 5 | 10 | 20 | 50)}
							data-testid={`item-count-${n}`}
						>
							{n}
						</button>
					{/each}
				</div>
			</fieldset>

			<fieldset class="block">
				<legend>Focus on these token families (optional)</legend>
				<div class="chips families">
					{#each data.products.filter((p) => selectedProducts.includes(p.slug)) as p (p.slug)}
						<div class="family-group">
							<h4>{p.label}</h4>
							<div class="chips">
								{#each p.families as fam (fam)}
									<button
										type="button"
										class="chip small"
										class:on={focusFamilies.includes(fam)}
										onclick={() => toggleFamily(fam)}
									>
										{fam}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</fieldset>

			<div class="actions">
				<button
					type="button"
					class="primary"
					disabled={starting || selectedProducts.length === 0}
					onclick={startDrill}
					data-testid="start-drill"
				>
					{starting ? 'Starting…' : 'Start drill'}
				</button>
				{#if startError}
					<p class="error" data-testid="start-error">{startError}</p>
				{/if}
			</div>

			<section class="mastery-snapshot">
				<h3>Your fluency snapshot</h3>
				<table>
					<thead>
						<tr>
							<th>Product</th>
							<th>Active</th>
							<th>Passive</th>
							<th>Demoted</th>
							<th>Never seen</th>
						</tr>
					</thead>
					<tbody>
						{#each data.products as p (p.slug)}
							<tr>
								<td>{p.label}</td>
								<td>{data.masterySummary[p.slug].active}</td>
								<td>{data.masterySummary[p.slug].passive}</td>
								<td>{data.masterySummary[p.slug].demoted}</td>
								<td>{data.masterySummary[p.slug].neverSeen}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		</div>
	{:else if phase === 'in-session' && currentItem}
		<div class="session" data-testid="drill-session">
			<div class="meta">
				<span>Item {cursor + 1} of {items.length}</span>
				<button type="button" class="text" onclick={endSession} data-testid="end-early">End now</button>
			</div>

			<div class="product-display">
				<div class="product-label">{currentItem.product.toUpperCase()}</div>
				<pre class="raw">{currentItem.rawExample}</pre>
				<div class="token-callout">
					<strong>Token in focus:</strong> <code>{currentItem.token}</code>
				</div>
			</div>

			{#if currentItem.mode === 'visible'}
				<div class="visible-card" data-testid="visible-card">
					<p class="passive-note">
						You've already mastered the <strong>{currentItem.family}</strong> family. Here's the decode for reference:
					</p>
					<p class="decode"><strong>{currentItem.token}</strong> = {currentItem.decode}</p>
					{#if currentItem.why}
						<p class="why">{currentItem.why}</p>
					{/if}
					<button type="button" class="primary" onclick={advance} data-testid="visible-next">Got it -- next</button>
				</div>
			{:else if outcome}
				<div class="rationale" class:correct={outcome.correct} class:incorrect={!outcome.correct} data-testid="rationale">
					<p class="verdict">{outcome.correct ? 'Correct' : 'Not quite'}</p>
					<p class="rationale-text">{outcome.rationale}</p>
					{#if outcome.transition.kind !== 'none'}
						<p class="transition" data-testid="transition">
							{transitionMessage(currentItem.family, outcome.transition)}
						</p>
					{/if}
					<button type="button" class="primary" onclick={advance} data-testid="rationale-next">
						{cursor + 1 >= items.length ? 'Finish drill' : 'Next token'}
					</button>
				</div>
			{:else}
				<form
					class="quiz"
					onsubmit={(e) => {
						e.preventDefault();
						void submitAnswer();
					}}
				>
					<p class="question">{questionPrompt(currentItem)}</p>
					<!-- svelte-ignore a11y_autofocus -- this is the primary input the user is expected to fill on a drill question; auto-focus mirrors the per-token flashcard pattern in the reps page -->
					<input
						type="text"
						class="answer-input"
						bind:value={answer}
						placeholder="Type your decode…"
						autofocus
						data-testid="answer-input"
					/>
					<button type="submit" class="primary" disabled={submitting || answer.trim().length === 0} data-testid="submit-answer">
						{submitting ? 'Submitting…' : 'Submit answer'}
					</button>
				</form>
			{/if}
		</div>
	{:else if phase === 'done' && summary}
		<div class="summary" data-testid="drill-summary">
			<h2>Session summary</h2>
			<dl class="totals">
				<dt>Total attempts</dt>
				<dd>{summary.totalAttempts}</dd>
				<dt>Correct</dt>
				<dd>{summary.correct}</dd>
				<dt>Incorrect</dt>
				<dd>{summary.incorrect}</dd>
				{#if summary.responseMsAvg !== null}
					<dt>Avg time / item</dt>
					<dd>{Math.round(summary.responseMsAvg)} ms</dd>
				{/if}
				{#if summary.responseMsMax !== null}
					<dt>Slowest item</dt>
					<dd>{summary.responseMsMax} ms</dd>
				{/if}
			</dl>

			{#if transitions.length > 0}
				<section class="transitions">
					<h3>State transitions</h3>
					<ul>
						{#each transitions as t, i (i)}
							<li>{transitionMessage('family', t)}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="per-family">
				<h3>Per-family breakdown</h3>
				<table>
					<thead>
						<tr>
							<th>Product</th>
							<th>Family</th>
							<th>Sub-family</th>
							<th>Attempts</th>
							<th>Correct</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.perFamily as row, i (i)}
							<tr>
								<td>{row.product}</td>
								<td>{row.family}</td>
								<td>{row.subFamily ?? '-'}</td>
								<td>{row.attempts}</td>
								<td>{row.correct}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

			<div class="actions">
				<button type="button" class="primary" onclick={resetForAnotherRound} data-testid="drill-again">
					Drill again
				</button>
			</div>
		</div>
	{/if}
</section>


<style>
.page {
	max-width: 64rem;
	margin: 0 auto;
	padding: var(--space-lg);
}
.hd {
	margin-bottom: var(--space-xl);
}
.lead {
	color: var(--ink-muted);
	margin-top: var(--space-xs);
}
.block {
	border: none;
	padding: 0;
	margin-bottom: var(--space-lg);
}
.block legend {
	font-weight: 600;
	margin-bottom: var(--space-xs);
}
.chips {
	display: flex;
	gap: var(--space-xs);
	flex-wrap: wrap;
}
.chip {
	padding: var(--space-xs) var(--space-sm);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-pill);
	background: var(--surface-panel);
	cursor: pointer;
	font-size: var(--type-ui-body-size, 0.9rem);
}
.chip.on {
	background: var(--action-link);
	color: var(--ink-inverse);
	border-color: var(--action-link);
}
.chip.small {
	padding: var(--space-3xs) var(--space-xs);
}
.family-group {
	margin-top: var(--space-sm);
	width: 100%;
}
.family-group h4 {
	margin: 0 0 var(--space-3xs) 0;
	color: var(--ink-muted);
}
.tier-label {
	color: var(--ink-muted);
	margin-top: var(--space-3xs);
}
.actions {
	display: flex;
	gap: var(--space-md);
	align-items: center;
	margin: var(--space-lg) 0;
}
button.primary {
	padding: var(--space-sm) var(--space-md);
	background: var(--action-link);
	color: var(--ink-inverse);
	border: none;
	border-radius: var(--radius-sm);
	font-weight: 600;
	cursor: pointer;
}
button.primary:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}
button.text {
	background: none;
	border: none;
	color: var(--action-link);
	cursor: pointer;
	text-decoration: underline;
}
.error {
	color: var(--signal-danger);
}
.mastery-snapshot table,
.per-family table {
	width: 100%;
	border-collapse: collapse;
	margin-top: var(--space-sm);
}
.mastery-snapshot th,
.mastery-snapshot td,
.per-family th,
.per-family td {
	padding: var(--space-xs) var(--space-sm);
	border-bottom: 1px solid var(--edge-subtle);
	text-align: left;
}

.session .meta {
	display: flex;
	justify-content: space-between;
	margin-bottom: var(--space-md);
	color: var(--ink-muted);
}
.product-display {
	padding: var(--space-md);
	background: var(--surface-sunken);
	border-radius: var(--radius-md);
	margin-bottom: var(--space-md);
}
.product-label {
	font-weight: 600;
	color: var(--ink-muted);
	letter-spacing: var(--letter-spacing-wide, 0.05em);
	margin-bottom: var(--space-xs);
}
.raw {
	font-family: var(--font-family-mono);
	background: var(--surface-panel);
	padding: var(--space-sm);
	border-radius: var(--radius-sm);
	overflow-x: auto;
	margin: 0 0 var(--space-sm) 0;
	white-space: pre-wrap;
	word-break: break-word;
}
.token-callout code {
	background: var(--surface-panel);
	padding: var(--space-3xs) var(--space-xs);
	border-radius: var(--radius-sm);
	font-family: var(--font-family-mono);
}
.quiz {
	display: flex;
	flex-direction: column;
	gap: var(--space-sm);
}
.question {
	font-weight: 500;
}
.answer-input {
	padding: var(--space-sm);
	border: 1px solid var(--edge-default);
	border-radius: var(--radius-sm);
}
.rationale {
	padding: var(--space-md);
	border-radius: var(--radius-md);
	border-left: 4px solid var(--edge-default);
}
.rationale.correct {
	background: var(--signal-success-wash);
	border-left-color: var(--signal-success-edge);
}
.rationale.incorrect {
	background: var(--signal-danger-wash);
	border-left-color: var(--signal-danger-edge);
}
.verdict {
	font-weight: 600;
	margin: 0 0 var(--space-xs) 0;
}
.rationale-text {
	margin: 0 0 var(--space-xs) 0;
}
.transition {
	margin: var(--space-xs) 0;
	font-style: italic;
	color: var(--ink-muted);
}
.visible-card {
	padding: var(--space-md);
	background: var(--surface-sunken);
	border-radius: var(--radius-md);
}
.passive-note {
	color: var(--ink-muted);
	margin-bottom: var(--space-xs);
}
.summary {
	padding: var(--space-md) 0;
}
.totals {
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: var(--space-xs) var(--space-md);
	margin: var(--space-md) 0;
}
.totals dt {
	color: var(--ink-muted);
}
.totals dd {
	margin: 0;
	font-weight: 600;
}
.transitions ul {
	list-style: disc;
	margin: var(--space-xs) 0 var(--space-md) var(--space-lg);
}
</style>
