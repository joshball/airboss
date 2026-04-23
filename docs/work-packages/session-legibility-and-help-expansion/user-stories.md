---
title: 'User Stories: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: user-stories
status: unread
---

# User Stories: Session Legibility and Help Expansion

## Understanding `/session/start`

- As a learner who just logged in, I want to understand what "Continue where you left off" means without leaving the page, so I can decide whether to start the session.
- As a learner seeing "Core topic, unstarted" for the first time, I want a hover hint that tells me what "core" means and why this node was chosen, so the label stops feeling arbitrary.
- As a learner seeing "Unused domain" in the Diversify slice, I want a one-line explanation in context, so I know why the engine is suggesting this item.
- As a learner, I want to know the difference between Node, Card, and Rep without having to read a manual, so I can interpret the preview at a glance.
- As a learner who wants to go deeper, I want every InfoTip to offer a "Learn more" link to a real help page, so a 10-second curiosity can become a 2-minute deep dive.
- As a learner returning after a week, I want to collapse the explanatory legend so the page feels efficient, but expand it any time I forget, so the help scales with my familiarity.

## Navigating from preview to detail

- As a learner, I want to click a card ID in the preview and see the card's actual content, so I can decide whether I actually want to review it before starting a session.
- As a learner, I want to click a node ID and land on the knowledge page, so I can review prerequisites or context before the session starts.
- As a learner, I want clicking a scenario/rep ID to take me somewhere useful (even if it's the browse list focused on that scenario), so the preview rows aren't just decoration.

## Discovering why the engine picked this item

- As a learner, I want reason chips like "Overdue" or "Low rep accuracy" to come with a short definition on hover, so I can understand the selection heuristic.
- As a curious learner, I want to follow a reason chip's "Learn more" link and land on a reason-codes table that shows every possible reason and which slice it belongs to, so I can build a mental model of how session composition works.
- As a learner studying the algorithm, I want one concept page per major idea (FSRS, spaced repetition, calibration) so I can learn the science, not just the UI.

## Help as a docs site, not a text dump

- As a learner opening a help page, I want tables, callouts, code blocks, and pull-quotes rendered beautifully, so reading help feels like reading docs, not a README.
- As a learner reading about FSRS-5, I want inline links to Wikipedia, papers, and the FAA handbook, so I can go as deep as I want.
- As a learner on mobile, I want help pages to be readable without horizontal scrolling and with touch-friendly target sizes, so I can study on the bus.
- As a learner with reduced-motion preferences, I want popovers and transitions to respect my system settings, so the UI doesn't fight my accessibility choices.

## Discovering help from any route

- As a learner on `/memory/review`, I want a small `?` in the header to take me to the detailed help for that page, so help is always one click away.
- As a learner on `/session/start`, I want the same `?` affordance, so the help pattern is predictable across the app.
- As a learner browsing help, I want a dedicated `/help/concepts` index that groups foundational ideas separately from per-page help, so I can study the "why" separately from the "how."

## Authoring and maintaining help

- As a content author, I want Markdown callouts (`:::tip`, `:::warn`, `:::note`, `:::example`) that map to existing styled cards, so I can emphasise without writing HTML.
- As a content author, I want to declare `externalRefs` once per page and have them auto-rendered as a references footer with source badges, so I never hand-format a bibliography.
- As a content author, I want the build to fail if I typo a `helpId` or ship a bad URL or leave a callout unclosed, so errors surface before users see them.
- As a content author, I want to cross-link concept and per-page help with `[[display::id]]`, so I can stitch the help library together with minimal ceremony.

## Scaling help over time

- As a product owner, I want adding a per-page help page to be a drop-in operation (author a file, register it, add `<PageHelp pageId="…" />` to the route), so I can add coverage incrementally without infrastructure work.
- As a product owner, I want `reviewedAt` stamps and the >12-month warning to keep help pages honest, so stale help gets flagged.
- As a product owner, I want external URLs validated to reject `localhost` and private IPs at build time, so bad links don't ship.

## Negative and edge stories

- As a learner who deletes a page that InfoTips pointed to, I want the UI to degrade gracefully (hide "Learn more", don't throw), so the absence of help never breaks the preview.
- As a learner reading a help page in reduced-motion mode, I want animations disabled but content and links fully functional.
- As a learner on a touch device with no hover, I want every InfoTip reachable by tap, with clear open and close affordances.
- As a learner navigating by keyboard only, I want every InfoTip, every clickable ID, and every callout link reachable in a logical tab order, with visible focus rings and Escape-to-close.
