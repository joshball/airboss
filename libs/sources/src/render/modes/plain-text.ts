/**
 * Plain-text-mode renderer per ADR 019 §3.1.
 *
 * Tokens substitute; identifier removed; per-corpus live URL appended as
 * `(<URL>)` after substituted text. Annotations append inline-parenthetical.
 */

import type { LinkRenderContext } from '../../types.ts';

export function renderPlainTextLink(ctx: LinkRenderContext): string {
	const text = ctx.groupListText !== undefined ? ctx.groupListText : ctx.substituted;
	const url = ctx.resolved.liveUrl;
	const urlSuffix = url !== null && url.length > 0 ? ` (${url})` : '';
	const annotation = ctx.resolved.annotation;
	const annotationSuffix = annotation.kind !== 'none' && annotation.text.length > 0 ? ` ${annotation.text}` : '';
	return `${text}${urlSuffix}${annotationSuffix}`;
}
