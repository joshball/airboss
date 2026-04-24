/**
 * Decision reps session help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MAJOR "Skip 'permanent' has no confirmation in /sessions/[id]" --
 *     explains skip-today vs skip-permanently semantics and how to
 *     reactivate from Plan detail.
 *   - MINOR "Confidence prompt is invisible when not shown" -- same
 *     djb2 explainer as memory-review, cross-referenced.
 *   - MINOR "Reps session '/' '[' ']' shortcuts undocumented" -- full
 *     keyboard shortcuts section, pointed at [Keyboard shortcuts].
 *   - Shuffle seed (?s=...) and why reload preserves option order.
 *   - IME composition guard on keyboard handler.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const repsSession: HelpPage = {
	id: 'reps-session',
	title: 'Decision reps session',
	summary: 'How a rep session flows, how the shuffle seed works, and how skip-permanently behaves.',
	documents: ROUTES.SESSION_START,
	tags: {
		appSurface: [APP_SURFACES.REPS, APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['reps', 'session', 'decision', 'shuffle', 'skip', 'confidence', 'scenario'],
	},
	related: ['memory-review', 'calibration', 'keyboard-shortcuts', 'getting-started'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'flow',
			title: 'How a rep works',
			body: `A decision rep is a one-screen scenario with a short prompt and 2-5 answer options. The flow per rep:

1. The prompt loads. The options are listed A-E (or A-D) in a deterministic, seeded-random order.
2. If today is a confidence-sampling day for this rep, a 1-5 confidence slider appears above the options (same djb2 mechanic as memory reviews; see [Memory review](/help/memory-review#confidence-sampling)).
3. Pick an option. The screen reveals the scored outcome, any explanation text, and references (glossary links, regulations, AIM excerpts).
4. Advance with \`Space\` to the next rep in the session. Session progress is shown in the header.

Sessions are server-derived. The current slot is "first unresolved slot in the session," so refresh, tab-close, or laptop-sleep all land you back at the right rep with prior answers preserved. There is no client-only queue state to lose.

The legacy \`/reps/session\` route was retired in ADR 012 phase 3. Every entry point (dashboard CTA, scheduled-reps panel, plan detail) now links \`/session/start\`, which steps through the active plan's next session.`,
		},
		{
			id: 'shuffle-seed',
			title: 'The shuffle seed (?s=...)',
			body: `Each rep's option order is shuffled per-session. The seed lives in the URL as \`?s=<number>\`. This matters because:

- **Refresh preserves the shuffle.** Reloading the page with the same \`?s\` keeps A/B/C/D/E mapped to the same options, so your keyboard-selection muscle memory stays valid across reloads.
- **Back-button is stable.** Going back to a rep you already answered shows the same option order you saw originally.
- **Shuffle button regenerates the seed.** On the \`/session/start\` preview screen, the Shuffle button rolls a new seed and re-orders. In-session, option order is fixed for the session.

Why shuffle at all? Without it, the first option in the database row list would be the correct answer more often than chance, and keyboard-selection would train the wrong habit. Shuffling breaks the positional cue.`,
		},
		{
			id: 'confidence-prompt',
			title: 'Why the confidence prompt is sometimes there',
			body: `Same mechanic as memory review: djb2 hash of \`repId + today's date\`, sampled at 50%. See [Memory review](/help/memory-review#confidence-sampling) for the full explanation. Rate confidence before you see the scored outcome; skipping weakens the calibration signal for that rep.`,
		},
		{
			id: 'skip-semantics',
			title: 'Skip today vs skip permanently',
			body: `The skip row offers two links:

- **Skip today.** Removes this rep from today's session only. It will appear again in a future session.
- **Skip permanently.** Adds the rep to the plan's permanent skip set. The rep is never scheduled for this plan again.

Skip permanently is a fat-finger hazard - the links sit directly below the rating buttons. Skip permanently is a non-reversible-without-action decision, but it is reversible: go to the plan detail page (\`/plans/[id]\`) and the permanently-skipped reps list there has a reactivate control per entry.

A ConfirmAction primitive that wraps skip-permanently in an inline "are you sure?" reveal is planned (see UX review, MAJOR finding on skip-permanently fat-finger). Until it ships, be deliberate when you click.`,
		},
		{
			id: 'keyboard-shortcuts',
			title: 'Keyboard shortcuts',
			body: `In-session:

- \`Space\` - reveal / continue to next rep.
- \`A\` - \`E\` - pick option by position. The letter matches the on-screen A-E label, which is the shuffled order, not the database order.
- \`1\` - \`5\` - rate confidence (when the prompt is shown).
- \`Escape\` - close the confidence prompt without rating (treated as skip).

Global (any page):

- \`/\` - focus the search palette.
- \`Cmd+K\` / \`Ctrl+K\` - also opens the palette.
- \`[\` - jump to aviation results in the palette.
- \`]\` - jump to help results in the palette.

The keydown handler guards against IME composition (Korean / Japanese / Chinese input) so composing a character never accidentally picks an option or advances. See [Keyboard shortcuts](/help/keyboard-shortcuts) for the full table.`,
		},
		{
			id: 'after-the-session',
			title: 'After the session',
			body: `The summary page shows score, per-rep outcomes, and a "Suggested next" block. Each suggestion links directly to a pre-filtered review queue or rep session so the gap-to-action loop closes (see the UX review refresh pass; read-only suggestions are being replaced with actionable links).

Sessions are not re-runnable. The session record is immutable once completed. To practice the same reps again, start a new session from the plan detail page - the server will surface reps due for re-practice first.`,
		},
	],
};
