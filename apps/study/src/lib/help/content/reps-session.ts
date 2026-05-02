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

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const repsSessionIndex: HelpPageIndex = {
	id: 'reps-session',
	title: 'Decision reps session',
	summary: 'How a rep session flows, how the shuffle seed works, and how skip-permanently behaves.',
	tags: {
		appSurface: [APP_SURFACES.REPS, APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['reps', 'session', 'decision', 'shuffle', 'skip', 'confidence', 'scenario'],
	},
	sections: [
		{ id: 'flow', title: 'How a rep works' },
		{ id: 'shuffle-seed', title: 'The shuffle seed (?s=...)' },
		{ id: 'confidence-prompt', title: 'Why the confidence prompt is sometimes there' },
		{ id: 'skip-semantics', title: 'Skip today vs skip permanently' },
		{ id: 'keyboard-shortcuts', title: 'Keyboard shortcuts' },
		{ id: 'after-the-session', title: 'After the session' },
	],
	searchHaystack:
		'how a rep session flows, how the shuffle seed works, and how skip-permanently behaves. a decision rep is a one-screen scenario with a short prompt and 2-5 answer options. the flow per rep:\n\n1. the prompt loads. the options are listed a-e (or a-d) in a deterministic, seeded-random order.\n2. if today is a confidence-sampling day for this rep, a 1-5 confidence slider appears above the options (same djb2 mechanic as memory reviews; see [memory review](/help/memory-review#confidence-sampling)).\n3. pick an option. the screen reveals the scored outcome, any explanation text, and references (glossary links, regulations, aim excerpts).\n4. advance with `space` to the next rep in the session. session progress is shown in the header.\n\nsessions are server-derived. the current slot is "first unresolved slot in the session," so refresh, tab-close, or laptop-sleep all land you back at the right rep with prior answers preserved. there is no client-only queue state to lose.\n\nthe legacy `/reps/session` route was retired in adr 012 phase 3. every entry point (dashboard cta, scheduled-reps panel, plan detail) now links `/session/start`, which steps through the active plan\'s next session. each rep\'s option order is shuffled per-session. the seed lives in the url as `?s=<number>`. this matters because:\n\n- **refresh preserves the shuffle.** reloading the page with the same `?s` keeps a/b/c/d/e mapped to the same options, so your keyboard-selection muscle memory stays valid across reloads.\n- **back-button is stable.** going back to a rep you already answered shows the same option order you saw originally.\n- **shuffle button regenerates the seed.** on the `/session/start` preview screen, the shuffle button rolls a new seed and re-orders. in-session, option order is fixed for the session.\n\nwhy shuffle at all? without it, the first option in the database row list would be the correct answer more often than chance, and keyboard-selection would train the wrong habit. shuffling breaks the positional cue. same mechanic as memory review: djb2 hash of `repid + today\'s date`, sampled at 50%. see [memory review](/help/memory-review#confidence-sampling) for the full explanation. rate confidence before you see the scored outcome; skipping weakens the calibration signal for that rep. the skip row offers two links:\n\n- **skip today.** removes this rep from today\'s session only. it will appear again in a future session.\n- **skip permanently.** adds the rep to the plan\'s permanent skip set. the rep is never scheduled for this plan again.\n\nskip permanently is a fat-finger hazard - the links sit directly below the rating buttons. skip permanently is a non-reversible-without-action decision, but it is reversible: go to the plan detail page (`/plans/[id]`) and the permanently-skipped reps list there has a reactivate control per entry.\n\na confirmaction primitive that wraps skip-permanently in an inline "are you sure?" reveal is planned (see ux review, major finding on skip-permanently fat-finger). until it ships, be deliberate when you click. in-session:\n\n- `space` - reveal / continue to next rep.\n- `a` - `e` - pick option by position. the letter matches the on-screen a-e label, which is the shuffled order, not the database order.\n- `1` - `5` - rate confidence (when the prompt is shown).\n- `escape` - close the confidence prompt without rating (treated as skip).\n\nglobal (any page):\n\n- `/` - focus the search palette.\n- `cmd+k` / `ctrl+k` - also opens the palette.\n- `[` - jump to aviation results in the palette.\n- `]` - jump to help results in the palette.\n\nthe keydown handler guards against ime composition (korean / japanese / chinese input) so composing a character never accidentally picks an option or advances. see [keyboard shortcuts](/help/keyboard-shortcuts) for the full table. the summary page shows score, per-rep outcomes, and a "suggested next" block. each suggestion links directly to a pre-filtered review queue or rep session so the gap-to-action loop closes (see the ux review refresh pass; read-only suggestions are being replaced with actionable links).\n\nsessions are not re-runnable. the session record is immutable once completed. to practice the same reps again, start a new session from the plan detail page - the server will surface reps due for re-practice first. reps session decision shuffle skip confidence scenario',
	documents: '/session/start',
	related: ['memory-review', 'calibration', 'keyboard-shortcuts', 'getting-started'],
	reviewedAt: '2026-04-22',
};
