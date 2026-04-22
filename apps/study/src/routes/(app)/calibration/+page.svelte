<script lang="ts">
import type { CalibrationBucket, DomainCalibration } from '@ab/bc-study';
import {
	CALIBRATION_MIN_BUCKET_COUNT,
	CALIBRATION_TREND_WINDOW_DAYS,
	CONFIDENCE_LEVEL_LABELS,
	type ConfidenceLevel,
	DOMAIN_LABELS,
	QUERY_PARAMS,
	ROUTES,
	SESSION_MODES,
} from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const calibration = $derived(data.calibration);
const trend = $derived(data.trend);
const pointCount = $derived(data.pointCount);
const hasData = $derived(pointCount > 0);

function humanize(slug: string): string {
	return slug
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function domainLabel(slug: string): string {
	return (DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug);
}

function confidenceLabel(level: ConfidenceLevel): string {
	return CONFIDENCE_LEVEL_LABELS[level];
}

function pct(value: number): number {
	return Math.round(value * 100);
}

function signedPct(value: number): string {
	const n = Math.round(value * 100);
	if (n === 0) return '0%';
	return n > 0 ? `+${n}%` : `${n}%`;
}

/**
 * Narrative label for a bucket's gap. Non-moralizing language (the spec is
 * explicit that overconfidence isn't framed as a personal failing) --
 * "expected X, actual Y" is the pattern.
 *
 * A bucket below the data-completeness threshold gets a "need more data"
 * label regardless of its gap so users don't read too much into a handful
 * of ratings.
 */
function gapLabel(bucket: CalibrationBucket): string {
	if (bucket.needsMoreData) return 'Need more data';
	const g = bucket.gap;
	if (Math.abs(g) < 0.05) return 'Well calibrated';
	if (g < 0) return `Overconfident by ${Math.abs(pct(g))}%`;
	return `Underconfident by ${pct(g)}%`;
}

function gapClass(bucket: CalibrationBucket): string {
	if (bucket.needsMoreData) return 'gap-unknown';
	if (Math.abs(bucket.gap) < 0.05) return 'gap-good';
	return bucket.gap < 0 ? 'gap-over' : 'gap-under';
}

/**
 * Build an SVG polyline from the trend points. Null scores are treated as
 * gaps: the path breaks and resumes at the next defined point. Empty trend
 * returns an empty string so the sparkline section still renders the axis
 * with a "no data" label.
 */
function trendPath(): string {
	const defined = trend.map((p, i) => ({ i, score: p.score })).filter((p) => p.score !== null) as Array<{
		i: number;
		score: number;
	}>;
	if (defined.length === 0) return '';
	const width = 600;
	const height = 120;
	const padX = 4;
	const padY = 4;
	const usableW = width - 2 * padX;
	const usableH = height - 2 * padY;
	const maxI = trend.length - 1;
	const coords = defined.map((p) => {
		const x = padX + (maxI === 0 ? usableW / 2 : (p.i / maxI) * usableW);
		const y = padY + (1 - p.score) * usableH;
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	});
	// Collapse consecutive defined points into one polyline segment; a gap
	// between indices (from null score(s)) is rendered as a move-to rather
	// than a line-to so the viewer doesn't read a straight line through
	// missing data.
	const segments: string[] = [];
	let current: string[] = [];
	let prevI = defined[0].i;
	for (let idx = 0; idx < defined.length; idx++) {
		const { i } = defined[idx];
		if (idx > 0 && i !== prevI + 1) {
			if (current.length > 0) segments.push(current.join(' '));
			current = [];
		}
		current.push(coords[idx]);
		prevI = i;
	}
	if (current.length > 0) segments.push(current.join(' '));
	return segments.map((s) => `M ${s.replace(/ /g, ' L ')}`).join(' ');
}

const lastScore = $derived(
	(() => {
		for (let i = trend.length - 1; i >= 0; i--) {
			const s = trend[i].score;
			if (s !== null) return { score: s, date: trend[i].date };
		}
		return null;
	})(),
);

const firstScore = $derived(
	(() => {
		for (const p of trend) {
			if (p.score !== null) return { score: p.score, date: p.date };
		}
		return null;
	})(),
);

const trendDelta = $derived(
	firstScore && lastScore && firstScore.date !== lastScore.date ? lastScore.score - firstScore.score : null,
);

/**
 * Buckets with a gap large enough to meaningfully steer practice. Below the
 * data threshold is excluded (noise) and near-zero gaps are "well calibrated"
 * and don't produce a CTA. Returned in absolute-gap-descending order so the
 * interpretation block talks about the most lopsided bucket first.
 */
const bucketsWithGap = $derived<CalibrationBucket[]>(
	hasData
		? [...calibration.buckets]
				.filter((b: CalibrationBucket) => !b.needsMoreData && Math.abs(b.gap) >= 0.05)
				.sort((a: CalibrationBucket, b: CalibrationBucket) => Math.abs(b.gap) - Math.abs(a.gap))
		: [],
);

/**
 * Confidence-level CTA -- a Strengthen session hits relearning + rated-Again +
 * overdue cards, which is what "recalibrate at this confidence level" actually
 * needs in practice. Cards don't store per-card confidence; feeding the
 * calibration signal more data is what moves the score, and Strengthen is the
 * engine slice tuned for that.
 */
function practiceHrefForBucket(_bucket: CalibrationBucket): string {
	return `${ROUTES.SESSION_START}?${QUERY_PARAMS.SESSION_MODE}=${SESSION_MODES.STRENGTHEN}`;
}

/**
 * Domain CTA -- link to the review queue pre-filtered to this domain. The
 * memory/review server load narrows the due-cards query by `?domain=`, so the
 * learner lands in a scoped review without any extra clicks.
 */
function practiceHrefForDomain(d: DomainCalibration): string {
	return `${ROUTES.MEMORY_REVIEW}?domain=${encodeURIComponent(d.domain)}`;
}

/**
 * Synthesize a 1-2 sentence interpretation from the user's bucket gaps.
 * Generic copy when everything is flat; specific copy (with the worst bucket
 * and its direction) when there's a real pattern to describe. The point isn't
 * to diagnose mood, it's to give the learner a one-glance read on what their
 * calibration data actually says.
 */
const interpretation = $derived(
	(() => {
		if (!hasData) return '';
		const ready: CalibrationBucket[] = calibration.buckets.filter((b: CalibrationBucket) => !b.needsMoreData);
		if (ready.length === 0) return 'Keep rating confidence so the page has enough data to interpret.';

		const wellCalibrated = ready.filter((b: CalibrationBucket) => Math.abs(b.gap) < 0.05);
		const hasGap = ready.some((b: CalibrationBucket) => Math.abs(b.gap) >= 0.05);

		if (!hasGap) {
			return 'Your confidence matches your accuracy across every bucket with enough data -- you read your own gut well.';
		}

		const worst = [...ready].sort((a: CalibrationBucket, b: CalibrationBucket) => Math.abs(b.gap) - Math.abs(a.gap))[0];
		const worstLabel = confidenceLabel(worst.level).toLowerCase();
		const worstLevel = worst.level;
		const worstPct = Math.abs(pct(worst.gap));

		const strong = wellCalibrated.find((b: CalibrationBucket) => b.level >= 4) ?? wellCalibrated[0];
		const strongClause = strong
			? `You're reliable when ${confidenceLabel(strong.level).toLowerCase()} (level ${strong.level} is well-calibrated), but `
			: '';

		if (worst.gap < 0) {
			return `${strongClause}level-${worstLevel} ("${worstLabel}") guesses go wrong ${worstPct}% more often than you expect -- trust your gut less when it's only that sure.`;
		}
		return `${strongClause}level-${worstLevel} ("${worstLabel}") answers come out right ${worstPct}% more often than you predict -- your actual recall is better than your confidence is admitting.`;
	})(),
);
</script>

<svelte:head>
	<title>Calibration -- airboss</title>
</svelte:head>

<section class="page">
	<header class="hd">
		<div>
			<h1>Calibration</h1>
			<p class="sub">Where your confidence matches your accuracy -- and where it doesn't.</p>
		</div>
	</header>

	{#if !hasData}
		<article class="empty" role="status">
			<h2>Not enough data yet</h2>
			<p>
				Calibration builds from the confidence ratings you give during card reviews and rep sessions. Rate your
				confidence when the slider appears, and the page fills in as you go.
			</p>
			<p class="fine">Minimum for useful data: ~25 confidence-rated answers spanning at least 3 of the 5 confidence buckets.</p>
			<div class="actions">
				<a class="btn primary" href={ROUTES.MEMORY_REVIEW}>Start a review</a>
				<a class="btn secondary" href={ROUTES.SESSION_START}>Start a rep session</a>
			</div>
		</article>
	{:else}
		<article class="score-card">
			<div class="score-main">
				<div class="score-label">Calibration score</div>
				<div class="score-value">
					{#if calibration.score === null}
						--
					{:else}
						{calibration.score.toFixed(2)}
					{/if}
				</div>
				<div class="score-sub">
					1.00 = perfect; 0.00 = maximally miscalibrated
				</div>
			</div>
			<dl class="score-meta">
				<div>
					<dt>Data points</dt>
					<dd>{pointCount}</dd>
				</div>
				<div>
					<dt>Domains with data</dt>
					<dd>{calibration.domains.length}</dd>
				</div>
			</dl>
		</article>

		{#if interpretation}
			<article class="interpretation-card" aria-label="Calibration interpretation">
				<p>{interpretation}</p>
				{#if bucketsWithGap.length > 0}
					<a class="btn primary" href={`${ROUTES.SESSION_START}?${QUERY_PARAMS.SESSION_MODE}=${SESSION_MODES.STRENGTHEN}`}>
						Start a Strengthen session
					</a>
				{/if}
			</article>
		{/if}

		<article class="chart-card">
			<h2>By confidence level</h2>
			<p class="hint">How often you were correct, compared to what that confidence level predicts.</p>
			<ul class="buckets">
				{#each calibration.buckets as bucket (bucket.level)}
					{@const hasActionableGap = !bucket.needsMoreData && Math.abs(bucket.gap) >= 0.05}
					<li class="bucket {gapClass(bucket)}">
						<div class="bucket-head">
							<span class="bucket-num">{bucket.level}</span>
							<span class="bucket-label">{confidenceLabel(bucket.level)}</span>
							<span class="bucket-count">{bucket.count} {bucket.count === 1 ? 'rating' : 'ratings'}</span>
						</div>
						<div class="bars">
							<div class="bar-row">
								<span class="bar-label">Actual</span>
								<div class="bar-track">
									{#if bucket.needsMoreData}
										<div class="bar-empty">Need {CALIBRATION_MIN_BUCKET_COUNT - bucket.count} more</div>
									{:else}
										<div class="bar-fill actual" style="width: {pct(bucket.accuracy)}%"></div>
										<span class="bar-pct">{pct(bucket.accuracy)}%</span>
									{/if}
								</div>
							</div>
							<div class="bar-row expected">
								<span class="bar-label">Expected</span>
								<div class="bar-track">
									<div class="bar-fill expected" style="width: {pct(bucket.expectedAccuracy)}%"></div>
									<span class="bar-pct">{pct(bucket.expectedAccuracy)}%</span>
								</div>
							</div>
						</div>
						<div class="bucket-footer">
							<div class="bucket-gap">{gapLabel(bucket)}</div>
							{#if hasActionableGap}
								<a class="bucket-cta" href={practiceHrefForBucket(bucket)}>
									Practice level {bucket.level}
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</article>

		<article class="domains-card">
			<h2>By domain</h2>
			{#if calibration.domains.length === 0}
				<p class="empty-note">No domain has enough data yet. Keep rating confidence across different topics.</p>
			{:else}
				<table class="domain-table">
					<thead>
						<tr>
							<th scope="col">Domain</th>
							<th scope="col" class="num">Score</th>
							<th scope="col" class="num">Data points</th>
							<th scope="col">Largest gap</th>
							<th scope="col" class="action-col"><span class="visually-hidden">Action</span></th>
						</tr>
					</thead>
					<tbody>
						{#each calibration.domains as d (d.domain)}
							<tr>
								<th scope="row">{domainLabel(d.domain)}</th>
								<td class="num">{d.score === null ? '--' : d.score.toFixed(2)}</td>
								<td class="num">{d.count}</td>
								<td>
									{#if d.largestGap === null}
										--
									{:else}
										<span class="gap-pill {d.largestGap.gap < 0 ? 'gap-over' : 'gap-under'}">
											{confidenceLabel(d.largestGap.level)} {signedPct(d.largestGap.gap)}
										</span>
									{/if}
								</td>
								<td class="action-col">
									<a class="domain-cta" href={practiceHrefForDomain(d)}>
										Practice {domainLabel(d.domain)}
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</article>

		<article class="trend-card">
			<h2>Last {CALIBRATION_TREND_WINDOW_DAYS} days</h2>
			{#if lastScore === null}
				<p class="empty-note">No complete day yet. Keep going -- the trend appears once any day has enough data.</p>
			{:else}
				<svg
					class="sparkline"
					viewBox="0 0 600 120"
					role="img"
					aria-label={`Calibration trend over ${CALIBRATION_TREND_WINDOW_DAYS} days: ${
						firstScore === null ? 'start unknown' : firstScore.score.toFixed(2)
					} to ${lastScore.score.toFixed(2)}${
						trendDelta === null ? ' (no change)' : `, change ${signedPct(trendDelta)}`
					}`}
				>
					<line x1="0" y1="4" x2="600" y2="4" class="sparkline-axis" />
					<line x1="0" y1="116" x2="600" y2="116" class="sparkline-axis" />
					<path d={trendPath()} class="sparkline-path" fill="none" />
				</svg>
				<div class="trend-legend">
					<span>Start: {firstScore === null ? '--' : firstScore.score.toFixed(2)}</span>
					<span>Now: {lastScore.score.toFixed(2)}</span>
					{#if trendDelta !== null}
						<span class:up={trendDelta > 0} class:down={trendDelta < 0}>
							Δ {signedPct(trendDelta)}
						</span>
					{/if}
				</div>
			{/if}
		</article>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.hd h1 {
		margin: 0;
		font-size: 1.75rem;
		letter-spacing: -0.02em;
		color: #0f172a;
	}

	.sub {
		margin: 0.125rem 0 0;
		color: #475569;
		font-size: 0.9375rem;
	}

	.empty {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.empty h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #0f172a;
	}

	.empty p {
		margin: 0;
		color: #475569;
		max-width: 36rem;
	}

	.fine {
		font-size: 0.8125rem;
		color: #64748b;
	}

	.score-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1.5rem;
	}

	.score-main {
		flex: 1 1 16rem;
	}

	.score-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.score-value {
		font-size: 3rem;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.1;
	}

	.score-sub {
		font-size: 0.8125rem;
		color: #64748b;
	}

	.score-meta {
		display: flex;
		gap: 1.5rem;
		margin: 0;
	}

	.score-meta div {
		display: flex;
		flex-direction: column;
	}

	.score-meta dt {
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.score-meta dd {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #0f172a;
	}

	.chart-card,
	.domains-card,
	.trend-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.interpretation-card {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 16px;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
	}

	.interpretation-card p {
		margin: 0;
		color: #0f172a;
		font-size: 0.9375rem;
		line-height: 1.5;
		flex: 1 1 24rem;
		min-width: 0;
	}

	.chart-card h2,
	.domains-card h2,
	.trend-card h2 {
		margin: 0;
		font-size: 1.0625rem;
		color: #0f172a;
	}

	.hint {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.buckets {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.bucket {
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.875rem 1rem;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.bucket.gap-good {
		border-color: #86efac;
		background: #f0fdf4;
	}

	.bucket.gap-over {
		border-color: #fecaca;
		background: #fef2f2;
	}

	.bucket.gap-under {
		border-color: #fde68a;
		background: #fefce8;
	}

	.bucket.gap-unknown {
		opacity: 0.75;
	}

	.bucket-head {
		display: flex;
		align-items: baseline;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.bucket-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		font-size: 0.8125rem;
		font-weight: 700;
		color: #1d4ed8;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 999px;
	}

	.bucket-label {
		font-weight: 600;
		color: #0f172a;
	}

	.bucket-count {
		margin-left: auto;
		font-size: 0.8125rem;
		color: #64748b;
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.bar-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.bar-label {
		flex: 0 0 5rem;
		font-size: 0.75rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.bar-track {
		flex: 1;
		height: 1.125rem;
		background: #e2e8f0;
		border-radius: 999px;
		position: relative;
		overflow: hidden;
	}

	.bar-fill {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		border-radius: 999px;
	}

	.bar-fill.actual {
		background: #2563eb;
	}

	.bar-fill.expected {
		background: repeating-linear-gradient(
			45deg,
			#94a3b8,
			#94a3b8 6px,
			#cbd5e1 6px,
			#cbd5e1 12px
		);
	}

	.bar-pct {
		position: absolute;
		right: 0.375rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.75rem;
		font-weight: 600;
		color: #0f172a;
		text-shadow: 0 0 2px white;
	}

	.bar-empty {
		position: absolute;
		left: 0.625rem;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.75rem;
		color: #64748b;
	}

	.bucket-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.bucket-gap {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #334155;
	}

	.bucket-cta {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1d4ed8;
		background: white;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		text-decoration: none;
		transition: background 120ms, border-color 120ms;
	}

	.bucket-cta:hover {
		background: #eff6ff;
		border-color: #93c5fd;
	}

	.gap-over .bucket-cta {
		color: #b91c1c;
		border-color: #fecaca;
	}

	.gap-over .bucket-cta:hover {
		background: #fef2f2;
		border-color: #fca5a5;
	}

	.gap-under .bucket-cta {
		color: #a16207;
		border-color: #fde68a;
	}

	.gap-under .bucket-cta:hover {
		background: #fefce8;
		border-color: #fcd34d;
	}

	.gap-over .bucket-gap {
		color: #b91c1c;
	}

	.gap-under .bucket-gap {
		color: #a16207;
	}

	.gap-good .bucket-gap {
		color: #15803d;
	}

	.domain-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	.domain-table th,
	.domain-table td {
		text-align: left;
		padding: 0.5rem 0.625rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.domain-table thead th {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
	}

	.domain-table tbody th {
		font-weight: 500;
		color: #0f172a;
	}

	.domain-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.gap-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.0625rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		border: 1px solid transparent;
	}

	.gap-pill.gap-over {
		color: #b91c1c;
		background: #fef2f2;
		border-color: #fecaca;
	}

	.gap-pill.gap-under {
		color: #a16207;
		background: #fefce8;
		border-color: #fde68a;
	}

	.domain-table .action-col {
		width: 1%;
		white-space: nowrap;
		text-align: right;
	}

	.domain-cta {
		display: inline-flex;
		align-items: center;
		padding: 0.25rem 0.625rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #1d4ed8;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		text-decoration: none;
		transition: background 120ms, border-color 120ms;
	}

	.domain-cta:hover {
		background: #dbeafe;
		border-color: #93c5fd;
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

	.sparkline {
		width: 100%;
		height: auto;
		max-height: 120px;
	}

	.sparkline-axis {
		stroke: #e2e8f0;
		stroke-width: 1;
	}

	.sparkline-path {
		stroke: #2563eb;
		stroke-width: 2;
		stroke-linejoin: round;
		stroke-linecap: round;
	}

	.trend-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.875rem;
		color: #475569;
	}

	.trend-legend .up {
		color: #15803d;
		font-weight: 600;
	}

	.trend-legend .down {
		color: #b91c1c;
		font-weight: 600;
	}

	.empty-note {
		color: #64748b;
		font-size: 0.9375rem;
		margin: 0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	.btn {
		padding: 0.625rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 10px;
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition:
			background 120ms,
			border-color 120ms;
	}

	.btn.primary {
		background: #2563eb;
		color: white;
	}

	.btn.primary:hover {
		background: #1d4ed8;
	}

	.btn.secondary {
		background: #f1f5f9;
		color: #1a1a2e;
		border-color: #cbd5e1;
	}

	.btn.secondary:hover {
		background: #e2e8f0;
	}

	@media (max-width: 560px) {
		.bar-label {
			flex: 0 0 4rem;
		}

		.score-value {
			font-size: 2.25rem;
		}
	}
</style>
