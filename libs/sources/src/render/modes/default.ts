/**
 * Forward-compatible mode renderers per ADR 019 §3.1.
 *
 * Each of these modes ships as a documented surface so the API contract is
 * complete. Downstream consumers (RAG pipeline, RSS feed, share-card image
 * builder, Slack unfurl service, transclusion host, tooltip surface) consume
 * them without re-implementing render logic.
 */

import type { LinkRenderContext, RenderMode } from '../../types.ts';

const SHARE_CARD_LIMIT = 80;
const TOOLTIP_LIMIT = 200;

export function renderDefaultModeLink(ctx: LinkRenderContext): string {
	switch (ctx.mode) {
		case 'screen-reader':
			return renderScreenReader(ctx);
		case 'rss':
			return renderRss(ctx);
		case 'share-card':
			return renderShareCard(ctx);
		case 'rag':
			return renderRag(ctx);
		case 'slack-unfurl':
			return renderSlackUnfurl(ctx);
		case 'transclusion':
			return renderTransclusion(ctx);
		case 'tooltip':
			return renderTooltip(ctx);
		default:
			return assertUnreachable(ctx.mode);
	}
}

function assertUnreachable(_x: RenderMode): string {
	// Compile-time exhaustive check; runtime fallback is the substituted text.
	return '';
}

function renderScreenReader(ctx: LinkRenderContext): string {
	const text = pickText(ctx);
	const annotation = ctx.resolved.annotation;
	const annotationText = annotation.kind !== 'none' ? annotation.text : '';
	const ariaLabel = `${text}${annotationText.length > 0 ? ` ${annotationText}` : ''}`;
	const href = ctx.resolved.liveUrl ?? '#';
	return `<a href="${escapeAttr(href)}" aria-label="${escapeAttr(ariaLabel)}">${escapeHtml(text)}</a>`;
}

function renderRss(ctx: LinkRenderContext): string {
	const text = pickText(ctx);
	const href = ctx.resolved.liveUrl ?? '#';
	return `<a href="${escapeAttr(href)}">${escapeHtml(text)}</a>`;
}

function renderShareCard(ctx: LinkRenderContext): string {
	const text = pickText(ctx);
	if (text.length <= SHARE_CARD_LIMIT) return text;
	return `${text.slice(0, SHARE_CARD_LIMIT - 1)}…`;
}

function renderRag(ctx: LinkRenderContext): string {
	const text = pickText(ctx);
	const url = ctx.resolved.liveUrl;
	const urlSuffix = url !== null ? ` (${url})` : '';
	const machineHint = ` <!-- ${ctx.raw} -->`;
	return `${text}${urlSuffix}${machineHint}`;
}

function renderSlackUnfurl(ctx: LinkRenderContext): string {
	const title = pickText(ctx);
	const annotation = ctx.resolved.annotation;
	const description = annotation.kind !== 'none' ? annotation.text : '';
	return description.length > 0 ? `${title}\n${description}` : title;
}

function renderTransclusion(ctx: LinkRenderContext): string {
	// Same shape as web. The pin is preserved on `ctx.resolved.parsed.pin`;
	// transclusion preserves pins per §3.1 by virtue of the resolved entry
	// carrying its origin pin.
	const text = pickText(ctx);
	const href = ctx.resolved.liveUrl ?? '#';
	return `<a href="${escapeAttr(href)}" class="ab-ref ab-ref-transclusion">${escapeHtml(text)}</a>`;
}

function renderTooltip(ctx: LinkRenderContext): string {
	const text = pickText(ctx);
	const annotation = ctx.resolved.annotation;
	const fullText = annotation.kind !== 'none' ? `${text} ${annotation.text}` : text;
	if (fullText.length <= TOOLTIP_LIMIT) return fullText;
	return `${fullText.slice(0, TOOLTIP_LIMIT - 1)}…`;
}

function pickText(ctx: LinkRenderContext): string {
	return ctx.groupListText !== undefined ? ctx.groupListText : ctx.substituted;
}

function escapeAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
