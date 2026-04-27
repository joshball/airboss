/**
 * Web-mode renderer per ADR 019 §3.1.
 *
 * Tokens substitute; identifier becomes a hyperlink. Annotations attach as
 * `<span class="ab-ref-annotation ab-ref-{kind}">...</span>` after the
 * anchor; the optional ack `note` attaches as the anchor's `title=` attribute
 * for tooltip rendering.
 */

import type { LinkRenderContext } from '../../types.ts';

export function renderWebLink(ctx: LinkRenderContext): string {
	const corpus = ctx.resolved.entry?.corpus ?? '';
	const href = ctx.resolved.liveUrl ?? '#';
	const title = ctx.resolved.annotation.note;
	const titleAttr = title !== undefined ? ` title="${escapeAttr(title)}"` : '';
	const corpusClass = corpus.length > 0 ? ` ab-ref-${corpus}` : '';

	const text = ctx.groupListText !== undefined ? ctx.groupListText : ctx.substituted;

	const anchor = `<a href="${escapeAttr(href)}" class="ab-ref${corpusClass}"${titleAttr}>${escapeHtml(text)}</a>`;

	const annotationKind = ctx.resolved.annotation.kind;
	if (annotationKind === 'none' || ctx.resolved.annotation.text.length === 0) {
		return anchor;
	}
	const annotationSpan = `<span class="ab-ref-annotation ab-ref-${annotationKind}">${escapeHtml(ctx.resolved.annotation.text)}</span>`;
	return `${anchor} ${annotationSpan}`;
}

function escapeAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
