---
title: 'User Stories: Node render modes'
product: study
feature: node-render-modes
type: user-stories
status: draft
review_status: pending
created: 2026-05-04
---

## The first-time learner

- As a learner encountering density altitude for the first time, I want the page to start with a relatable scenario, so I have something to hang the explanation on.
- As a first-time learner, I want the regulation to come last, so I see it as the answer to a question I now understand, not as a rule to memorize cold.

## The returning reviewer

- As a returning learner who already understands density altitude, I want to skip the discovery walkthrough and see the synthesis first, so my time isn't wasted re-reading what I already know.
- As a reviewer, I want the regulation right after the synthesis, so I can refresh both the rule and its plain-language form quickly.
- As a reviewer, I still want access to the full explanation, so I can drop into it if I realize I've forgotten the why.

## The pre-checkride memorizer

- As a learner studying for an oral, I want to see the regulation verbatim first, so I can drill the exact wording.
- As a memorizer, I want a 1-paragraph synthesis right after the reg, so I have a memory anchor.
- As a memorizer, I want the discovery hook hidden by default, so I'm not distracted by stories.

## The mode-switcher

- As a learner, I want to switch modes without leaving the page, so trying a different reading order is cheap.
- As a learner, I want my mode preference to persist across nodes, so I don't have to pick "memorize" on every page.
- As a learner sharing a link to a knowledge node, I want to share with a `?mode=memorize` URL param, so my study partner sees the version I was looking at.

## The author

- As a content author, I want to write each section once and let the renderer reorder, so I don't author three versions of the same node.
- As an author, I want my section delimiters to be invisible HTML comments, so the markdown stays markdown and my editor highlights it correctly.
- As an author, I want a lint check that flags missing `synthesis` or `explanation` sections, so I notice incomplete migrations before they ship.

## The discovery-first believer

- As a content author who agrees with ADR 011, I want Learn to be the default mode, so the system's pedagogy stays discovery-first by default.
- As a learner who agrees with ADR 011, I don't want to fight the default, so first-time visitors land in Learn mode without me intervening.

## The reg-first learner

- As a learner whose brain works rule-first, I want a Memorize mode that respects my preference, so the system isn't paternalistic.
- As a Memorize-mode user, I want the toggle to remember my choice, so I'm not re-selecting it on every visit.

## The accessibility user

- As a screen-reader user, I want mode changes to be announced, so I know the page just rearranged.
- As a keyboard user, I want arrow keys to move between toggle buttons, so I don't have to tab through three buttons one at a time.

## The migration-aware contributor

- As a contributor adding a new knowledge node post-migration, I want a clear template and a lint that enforces the structured shape, so I don't accidentally ship a free-form node.
- As a contributor migrating an old node, I want a one-shot script that converts `## Hook` / `## Explanation` headings to delimiters, so the bulk of the work is automated.

## The forward-looker

- As a learner, I want flightbag handbook sections to gain a similar render-mode toggle in v1.1, so the same vocabulary works across all reading surfaces.
- As an author, I want the section types to be extensible, so adding a new section type (e.g., `worked_examples`) in the future doesn't require schema changes.
