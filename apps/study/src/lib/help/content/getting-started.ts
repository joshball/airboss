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
import type { HelpPageIndex } from '@ab/help';

export const gettingStartedIndex: HelpPageIndex = {
	id: 'getting-started',
	title: 'Getting started with airboss',
	summary: 'What airboss is, what the surfaces do, and how a normal day uses them.',
	tags: {
		appSurface: [APP_SURFACES.GLOBAL],
		helpKind: HELP_KINDS.CONCEPT,
		keywords: ['orientation', 'first-time', 'overview', 'pivot', 'invite-only'],
	},
	sections: [
		{ id: 'what-airboss-is', title: 'What airboss is' },
		{ id: 'the-surfaces', title: 'The surfaces' },
		{ id: 'first-time-loop', title: 'A normal day' },
		{ id: 'invite-only', title: 'Invite-only scope' },
	],
	searchHaystack:
		'what airboss is, what the surfaces do, and how a normal day uses them. airboss is a pilot performance and rehearsal platform. it sits between planning (foreflight) and the aircraft, and between the aircraft and reflection (cloudahoy). it is not a course, not a sim, and not a logbook. it is a rehearsal and proficiency tool that targets the 20 minutes before a flight, the 10 minutes between flights, and the periodic check on where a pilot is drifting.\n\nthe platform started as a firc course (every-24-month cfi renewal) and pivoted in early 2026. the engine, scenario model, spaced-repetition scheduler, and pre-brief/debrief pieces all survived the pivot. what changed is the audience (every pilot, not cfis every two years), the business posture (cover-costs, potentially open-source), and the regulatory posture (no faa submission needed to ship v1).\n\nthe platform is currently invite-only. the login page exposes seeded accounts in dev; in production there is no self-signup. if you landed here without an invite, the right path is to request one from the project owner. airboss is organized by rendering surface, not by content theme. the study app (what you are looking at) owns these surfaces:\n\n- **dashboard** (`/dashboard`) - the launchpad. nine panels summarize what is due, what you scheduled, where you are calibrated, where you are weak, and what your current plan says to do next. see [dashboard](/help/dashboard).\n- **memory** (`/memory`) - flashcards scheduled by fsrs-5. the queue at `/memory/review` shows cards that are due; rating them (again / hard / good / easy) tells the scheduler how to re-space them. see [memory review](/help/memory-review).\n- **reps** (`/reps`) - decision scenarios. each rep poses a situation, optionally asks for a confidence rating, then shows the options. reps live inside plans and sessions, not a separate session route. see [reps session](/help/reps-session).\n- **calibration** (`/calibration`) - tracks how well your confidence matches your accuracy, by domain and by confidence level. see [calibration](/help/calibration).\n- **knowledge** (`/knowledge`) - the knowledge graph. each node has a 7-phase learn stepper (context -> problem -> discover -> reveal -> practice -> connect -> verify) and a dual-gate mastery signal that combines card mastery with decision-rep accuracy. see [knowledge graph](/help/knowledge-graph).\n- **glossary** (`/glossary`) - aviation reference. terms, regs, aim excerpts, and authored notes. wiki-links like  resolve here. the glossary is shared across every airboss app via `@ab/aviation`.\n- **help** (`/help`) - this surface. app-specific help pages per surface, plus a cross-library search that spans aviation references and help pages. first time:\n\n1. log in. land on `/dashboard`.\n2. the cta panel in the top-left tells you the next action. on a brand-new account, that is usually "create your first card" or "create your first scenario." follow it.\n3. after a few cards and reps, return to the dashboard. the reviews-due, scheduled-reps, and calibration panels start to fill.\n\ndaily loop, once you have content:\n\n1. dashboard shows what is due.\n2. run the memory review queue (cards due today). rate each card, trust the scheduler.\n3. run the current session (decision reps from your active plan).\n4. check calibration weekly to see where your confidence and accuracy diverge. the biggest gap tells you what to practice next.\n\na rep session refresh is safe. the current slot is derived server-side as "first unresolved slot in the session," so reload, tab-close, or laptop-sleep all resume at the right place. airboss is closed-alpha today. there is no signup flow, no password reset, and no "request access" form on the login page. dev environments seed accounts with a shared password for local use; production does not. if you are reading this page inside a production build, you already have an invite. keep your session cookie and you stay signed in. sign out from the user menu in the top-right nav when you want to clear the session.\n\nthe product is not monetized. the motivation is craft, not revenue. see the [pivot doc](https://github.com) (linked from internal docs only) for the full framing. orientation first-time overview pivot invite-only',
	related: ['dashboard', 'memory-review', 'reps-session', 'knowledge-graph'],
	reviewedAt: '2026-04-22',
	concept: true,
};
