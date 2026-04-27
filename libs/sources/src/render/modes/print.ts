/**
 * Print-mode renderer per ADR 019 §3.1.
 *
 * Tokens substitute; identifier becomes inline text plus a `<sup>n</sup>`
 * footnote marker; the dispatcher's footnote sink accumulates URLs + notes
 * and emits a trailing `<aside class="ab-ref-footnotes">` block.
 */

import type { LinkRenderContext } from '../../types.ts';

export type PrintFootnoteSink = (text: string) => number;

export function renderPrintLink(ctx: LinkRenderContext): string {
	const text = ctx.groupListText !== undefined ? ctx.groupListText : ctx.substituted;
	const url = ctx.resolved.liveUrl;
	const note = ctx.resolved.annotation.note;
	const annotation = ctx.resolved.annotation;
	const sink = ctx.footnoteSink;

	if (sink === undefined || (url === null && note === undefined && annotation.kind === 'none')) {
		return text;
	}

	const footnoteParts: string[] = [];
	if (url !== null) footnoteParts.push(url);
	if (annotation.kind !== 'none' && annotation.text.length > 0) footnoteParts.push(annotation.text);
	if (note !== undefined && note.length > 0) footnoteParts.push(note);

	if (footnoteParts.length === 0) {
		return text;
	}

	const idx = sink(footnoteParts.join(' -- '));
	return `${text}<sup>${idx}</sup>`;
}
