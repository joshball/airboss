/**
 * Getting started help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MINOR "Login dev-accounts section is noisy in dev but zero affordance
 *     in prod" -- this page is where a first-time user learns what airboss
 *     is, that it's invite-only, and what the surfaces do.
 *   - No first-time orientation anywhere in the app -- new users land on
 *     the dashboard with nine unexplained panels. This page names every
 *     surface and the normal loop between them.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const gettingStarted: HelpPage = {
	id: 'getting-started',
	title: 'Getting started with airboss',
	summary: 'What airboss is, what the surfaces do, and how a normal day uses them.',
	tags: {
		appSurface: [APP_SURFACES.GLOBAL],
		helpKind: HELP_KINDS.CONCEPT,
		keywords: ['orientation', 'first-time', 'overview', 'pivot', 'invite-only'],
	},
	concept: true,
	related: ['dashboard', 'memory-review', 'reps-session', 'knowledge-graph'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'what-airboss-is',
			title: 'What airboss is',
			body: `airboss is a pilot performance and rehearsal platform. It sits between planning (ForeFlight) and the aircraft, and between the aircraft and reflection (CloudAhoy). It is not a course, not a sim, and not a logbook. It is a rehearsal and proficiency tool that targets the 20 minutes before a flight, the 10 minutes between flights, and the periodic check on where a pilot is drifting.

The platform started as a FIRC course (every-24-month CFI renewal) and pivoted in early 2026. The engine, scenario model, spaced-repetition scheduler, and pre-brief/debrief pieces all survived the pivot. What changed is the audience (every pilot, not CFIs every two years), the business posture (cover-costs, potentially open-source), and the regulatory posture (no FAA submission needed to ship v1).

The platform is currently invite-only. The login page exposes seeded accounts in dev; in production there is no self-signup. If you landed here without an invite, the right path is to request one from the project owner.`,
		},
		{
			id: 'the-surfaces',
			title: 'The surfaces',
			body: `airboss is organized by rendering surface, not by content theme. The study app (what you are looking at) owns these surfaces:

- **Dashboard** (\`/dashboard\`) - the launchpad. Nine panels summarize what is due, what you scheduled, where you are calibrated, where you are weak, and what your current plan says to do next. See [Dashboard](/help/dashboard).
- **Memory** (\`/memory\`) - flashcards scheduled by FSRS-5. The queue at \`/memory/review\` shows cards that are due; rating them (Again / Hard / Good / Easy) tells the scheduler how to re-space them. See [Memory review](/help/memory-review).
- **Reps** (\`/reps\`) - decision scenarios. Each rep poses a situation, optionally asks for a confidence rating, then shows the options. Reps live inside plans and sessions, not a separate session route. See [Reps session](/help/reps-session).
- **Calibration** (\`/calibration\`) - tracks how well your confidence matches your accuracy, by domain and by confidence level. See [Calibration](/help/calibration).
- **Knowledge** (\`/knowledge\`) - the knowledge graph. Each node has a 7-phase learn stepper (Context -> Problem -> Discover -> Reveal -> Practice -> Connect -> Verify) and a dual-gate mastery signal that combines card mastery with decision-rep accuracy. See [Knowledge graph](/help/knowledge-graph).
- **Glossary** (\`/glossary\`) - aviation reference. Terms, regs, AIM excerpts, and authored notes. Wiki-links like [[::adm-safety]] resolve here. The glossary is shared across every airboss app via \`@ab/aviation\`.
- **Help** (\`/help\`) - this surface. App-specific help pages per surface, plus a cross-library search that spans aviation references and help pages.`,
		},
		{
			id: 'first-time-loop',
			title: 'A normal day',
			body: `First time:

1. Log in. Land on \`/dashboard\`.
2. The CTA panel in the top-left tells you the next action. On a brand-new account, that is usually "Create your first card" or "Create your first scenario." Follow it.
3. After a few cards and reps, return to the dashboard. The Reviews-Due, Scheduled-Reps, and Calibration panels start to fill.

Daily loop, once you have content:

1. Dashboard shows what is due.
2. Run the memory review queue (cards due today). Rate each card, trust the scheduler.
3. Run the current session (decision reps from your active plan).
4. Check calibration weekly to see where your confidence and accuracy diverge. The biggest gap tells you what to practice next.

A rep session refresh is safe. The current slot is derived server-side as "first unresolved slot in the session," so reload, tab-close, or laptop-sleep all resume at the right place.`,
		},
		{
			id: 'invite-only',
			title: 'Invite-only scope',
			body: `airboss is closed-alpha today. There is no signup flow, no password reset, and no "request access" form on the login page. Dev environments seed accounts with a shared password for local use; production does not. If you are reading this page inside a production build, you already have an invite. Keep your session cookie and you stay signed in. Sign out from the user menu in the top-right nav when you want to clear the session.

The product is not monetized. The motivation is craft, not revenue. See the [pivot doc](https://github.com) (linked from internal docs only) for the full framing.`,
		},
	],
};
