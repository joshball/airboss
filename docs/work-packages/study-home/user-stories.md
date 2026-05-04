---
title: 'User Stories: Study home'
product: study
feature: study-home
type: user-stories
status: draft
review_status: pending
created: 2026-05-04
---

## The returning CFI

- As a returning CFI rebuilding PPL knowledge, I want a single home page that orients me when I sign in, so I don't have to remember where I left off.
- As a returning CFI, I want to see at a glance how much of the PPL ACS I've actually retained, so I can gauge my readiness without doing a self-assessment.
- As a returning CFI, I want the system to tell me what to study today in plain English, so I don't have to interpret a dashboard.
- As a returning CFI, I want the option to ignore the system's suggestion and pick my own topic from the map, so I keep agency.
- As a returning CFI, I want the home page to never auto-route me to flashcards, so my study session begins with context, not memorization.

## The mode-flexible learner

- As a learner, I want to read the handbook chapter for today's topic if that's what I feel like, so I can use my reading time well.
- As a learner, I want to drill cards on a specific topic when my eyes glaze over from reading, so I can switch modes without leaving the page.
- As a learner, I want to run a scenario when I want to test my decision-making, so practice is one click from context.
- As a learner, I want to see all five study modes as equal options, so I don't feel pushed toward any one of them.
- As a learner, I want to know which mode is most appropriate without the system deciding for me, so I learn how I actually learn.

## The map navigator

- As a learner, I want to see the entire ACS as a hierarchical tree, so I have a mental model of the certification topology.
- As a learner, I want the area I'm working on to auto-expand, so I don't have to hunt for it.
- As a learner, I want to manually expand any other area to see its content, so I can preview what's coming.
- As a learner, I want each leaf to show me at a glance whether I've understood, memorized, and practiced it, so I see my gaps without drilling in.
- As a learner, I want the map to also show me the handbook organization, so I can study by chapter when that fits my mood.
- As a learner, I want a "Course" view that shows the FAR nav course as a week-by-week walk, so I can study in the structured order it was authored in.

## The discovery learner (mode A)

- As a learner who likes to understand the why first, I want each leaf to show its handbook citations expanded by default, so I read the explanation before the rule.
- As a learner who likes regs as confirmation, I want the regulation citations visible but folded by default, so I know they're there without being led to memorize first.

## The reg-first learner (mode B)

- As a learner who already understands the why, I want to flip the citation order to put regulation first, so I can review the rule cleanly.
- As a learner who flips the order once, I want my preference honored on every subsequent panel, so I don't fight the UI.

## The progress watcher

- As a learner, I want three independent progress numbers (understood, memorized, practiced), so I see which dimension is the gap.
- As a learner, I want absolute counts alongside percentages, so a "47%" doesn't look identical to "47%" when one represents 47 of 100 leaves and the other represents 7 of 15.
- As a learner, I want the focus area in the map to be visually distinct from areas I've finished, so my attention goes where it should.

## The first-time visitor

- As a new user with no primary goal, I want the page to tell me clearly that I need to set one, so I'm not staring at empty progress bars and wondering what's broken.
- As a new user, I want the tiles to still work, so I can explore the system without setup.

## The cert-curious

- As a learner targeting CFI (not PPL), I want the home page to work for my cert too, so the surface isn't PPL-locked.
- As a learner targeting CFI, I want the Course projection to gracefully say "no course content for this cert yet" rather than 404 or render empty, so I know it's a content gap not a bug.

## The forward-looking

- As a learner who will eventually fly with a CFI, I want the Practiced pill to count both sim sessions and in-the-plane attempts (when WP 2 lands), so my progress reflects what I've actually done in the cockpit.
- As a learner who reads about WP 3, I want the citation order toggle here to feel like a v1 of the broader render-mode toggle on knowledge nodes, so the mental model is consistent.

## The accessibility user

- As a screen-reader user, I want the progress strip to announce both the percentage and the absolute count, so the numbers are meaningful in audio.
- As a keyboard user, I want to tab through the page in a logical order, so I can study without a mouse.
- As a low-vision user, I want focus rings to be visible on every interactive element, so I can track where I am.

## The mobile user

- As a learner on my phone, I want the page to render usefully at 600 px wide, so I can check my Today briefing on the train.
- As a mobile user, I don't need the map to be as dense as desktop -- a single ACS list is fine.
