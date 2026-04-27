/**
 * TTS-mode renderer per ADR 019 §3.1.
 *
 * Tokens substitute; identifier omitted from spoken output; URL omitted.
 * Per-token spoken-form aliases (R2 deferral) ship with `apps/audio/`; for
 * Phase 4 the substitution text is what the downstream TTS engine speaks.
 */

import type { LinkRenderContext } from '../../types.ts';

export function renderTtsLink(ctx: LinkRenderContext): string {
	return ctx.groupListText !== undefined ? ctx.groupListText : ctx.substituted;
}
