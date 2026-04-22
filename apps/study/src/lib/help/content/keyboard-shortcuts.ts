/**
 * Keyboard shortcuts help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MINOR "New card form Cmd+Enter submits, Enter does not - undocumented"
 *   - MINOR "Reps session '/' '[' ']' shortcuts undocumented"
 *   - Central reference for every kbd binding in the app.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const keyboardShortcuts: HelpPage = {
	id: 'keyboard-shortcuts',
	title: 'Keyboard shortcuts',
	summary: 'Every keyboard binding across memory review, reps sessions, the search palette, and forms.',
	tags: {
		appSurface: [APP_SURFACES.GLOBAL],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['keyboard', 'shortcuts', 'hotkeys', 'palette', 'cmd-k', 'slash'],
	},
	related: ['memory-review', 'reps-session', 'getting-started'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `airboss ships keyboard shortcuts on the surfaces that benefit from fast repeat input: memory review, rep sessions, the search palette, and the new-card form. All keydown handlers guard against IME composition events (Korean / Japanese / Chinese input methods) so composing characters never triggers shortcuts by accident.

On macOS \`Cmd\` is the modifier key; on Windows / Linux \`Ctrl\` is the equivalent. The table columns use \`Cmd\`; substitute \`Ctrl\` off macOS.`,
		},
		{
			id: 'memory-review-shortcuts',
			title: 'Memory review',
			body: `At \`/memory/review\`:

| Key     | Action                          |
| ------- | ------------------------------- |
| \`Space\` | Reveal answer                   |
| \`1\`     | Rate Again                      |
| \`2\`     | Rate Hard                       |
| \`3\`     | Rate Good                       |
| \`4\`     | Rate Easy                       |

See [Memory review](/help/memory-review) for what the four ratings mean for scheduling.`,
		},
		{
			id: 'reps-session-shortcuts',
			title: 'Reps session',
			body: `At \`/session/start\` or inside a session at \`/sessions/[id]\`:

| Key       | Action                                                                   |
| --------- | ------------------------------------------------------------------------ |
| \`Space\`   | Reveal / continue to next rep                                            |
| \`A\`-\`E\`   | Pick option by on-screen position (shuffled, not database order)         |
| \`1\`-\`5\`   | Rate confidence (when the prompt is shown)                               |
| \`Escape\`  | Close confidence prompt without rating (counts as skip)                  |

The shuffle seed is in the URL as \`?s=<number>\`; reload preserves the option order so A-E keys map to the same options across refreshes. See [Reps session](/help/reps-session).`,
		},
		{
			id: 'new-card-form-shortcuts',
			title: 'New card form',
			body: `At \`/memory/new\`:

| Key                  | Action                                                  |
| -------------------- | ------------------------------------------------------- |
| \`Cmd+Enter\`          | Submit the form (save card)                             |
| \`Cmd+Shift+Enter\`    | Save card and immediately open a fresh new-card form    |

\`Enter\` alone inserts a newline in multiline fields and does not submit. Plain \`Enter\` was not bound to submit because card front/back fields are multiline by intent (mathematical notation, code blocks, longer prose), and single-line submission would fight that.`,
		},
		{
			id: 'search-palette-shortcuts',
			title: 'Search palette',
			body: `The cross-library search palette spans aviation references and help pages. From any page in the \`(app)\` group:

| Key       | Action                                                         |
| --------- | -------------------------------------------------------------- |
| \`/\`       | Focus / open the palette                                       |
| \`Cmd+K\`   | Also opens the palette (alt path, same component)              |
| \`[\`       | Jump focus to the aviation-results section                     |
| \`]\`       | Jump focus to the help-results section                         |
| \`Enter\`   | Activate the focused result (open its detail route)            |
| \`Escape\`  | Close the palette                                              |

The two invocation paths (\`/\` and \`Cmd+K\`) exist because the UX review flagged search discoverability problems. Both work; both open the same component.`,
		},
		{
			id: 'dashboard-shortcuts',
			title: 'Dashboard',
			body: `The dashboard has no surface-specific shortcuts. Every panel is clickable or links to its deep-target route, and the search palette is reachable with \`/\` or \`Cmd+K\` like any other page. If you want to start the CTA action from the keyboard, \`Tab\` to the CTA button and \`Enter\`.`,
		},
		{
			id: 'global-browser-shortcuts',
			title: 'Global browser shortcuts',
			body: `Standard browser shortcuts work everywhere:

- \`Cmd+R\` - reload. Rep sessions are server-derived, so reload resumes at the current slot without losing progress.
- \`Cmd+[\` / \`Cmd+]\` - browser back / forward. Back from a rep mid-session lands on the previous rep with prior answer preserved.
- \`Cmd+F\` - native browser find. Useful on help pages and glossary detail pages where the full content is rendered.`,
		},
	],
};
