---
title: 'Spaced Memory Items -- User Walkthrough Feedback (2026-04-24)'
status: archived
archived_date: 2026-04-25
closed_by: PRs #106, #107, #108, #111, #127, #128, #135, #138, #149, #150, #153, #156, #154, #159, #162, #165, #<this-pr>
feature: spaced-memory-items
session: 2026-04-24 manual test pass
---

# Spaced Memory Items -- Walkthrough Feedback

Raw feedback captured verbatim from user walkthrough on 2026-04-24. Each item preserved; analysis + plan live further down.

## Raw items

### Card model / connections

1. **Optional regulation reference on a card.** Cards (and anything we do if relevant) should be able to link to a reg. Feels like a wasted opportunity for connections and coverage otherwise.

### Card detail page

2. **Missing fields on card detail.** "Status = active" and source badge "Personal" are not visible on the detail page. User expected to see them per test-plan.
3. **Help needed on Suspend and Archive.** What do they do? Need hover help for both.
4. **No way to start a review from card detail.** "Recent reviews" panel implies there should be a way to review the card from here. Is there a button missing? Does it even make sense? Decide.
5. **"This card is read-only (source: Course)."** Meaning of Course/source needs explanation on the detail page.

### Navigation

6. **No nav link to `/memory/review`.** User had to go there manually. Proposal: `Start/Review` under the Memory tab, so "Start" is the entry to a review session.

### Review flow

7. **Space-to-reveal triggers confidence prompt first.** That's intentional but jarring -- confidence appears in the same screen after pressing space. Treat confidence as part of the question screen instead of a post-space interstitial.
8. **Confidence buttons should look clickable (not just keyboard).** Make 1-5 look like buttons. Drive users to click; allow space to skip; keyboard 1-5 works too. Allow user to go back/adjust on the next page if they got their confidence wrong.
9. **Rating language: "How well did you remember it" should also capture "did you get it right".** Maybe: Right/Wrong, each with sub-chicklets for frequency of next review (e.g. "Right -- show again in 3 days" vs "Wrong -- show again in 10 min"). Explicit frequency on the button.
10. **User may know it but want to push it out anyway.** E.g., "I don't want this question again for a while" even on a correct answer. Do we want to track that? Probably yes, but maybe argue against. Decision needed.
11. **Per-card feedback on the question itself.** Add a like/don't like (or flag) on each card during review, with mandatory comment on dislike. Rating the *content* separate from rating *your recall*.
12. **Undo button UX.** When the undo toast appears, the card shifts up and down -- annoying. Proposal: put undo below the card, keep it longer, fade a bit. User should always be able to go back.
13. **Mystery `?` after "Card 1 of 12".** Turns out it's a help trigger. User dislikes the presentation. Proposal: a distinct "help" chicklet or button instead of a bare `?`.
14. **Tags during review need tooltips.** E.g. "Airspace" tag on the question screen -- what does that domain tag mean? Hover help. [Waiting on incoming PR.]
15. **"Card 1 of 12" should be a dropdown.** Let user click it to jump to a specific card in the session. Possibly. Decide.
16. **"Wild guess" confidence label.** User hit a card where they genuinely had no idea (couldn't even guess). Wild Guess felt inadequate. Suggestion: "No idea". (User retracted -- probably same thing.)
17. **Poor question clarity example.** `91.155(b)(2) traffic-pattern exception: what does it allow and where?` -- user didn't understand the question. Suggestion: rephrase to `what does it allow and where regarding visibility and cloud clearance?`.

### URL / shareability / state

18. **URL tracker for review sessions.** Need to think this through. Possible slug ID for the run + card number. Two purposes:
    - (a) get back into a run / resume
    - (b) redo the same run
    - (c) show that card later
    Decide intent. Possibly a share button is better for single-card sharing, with URL representing the run/domain. State we're in and how it affects this -- write it up.

### Card detail re-entry

19. **After review, user didn't know how to get back to the card detail page.** Need a link. Could be gated: our seed cards hide edit UI, user cards show it; or show the link but disable edit for non-owners. Decide.

### Memory dashboard

20. **Status pills (New/Review/Learning/Relearning) need help.** Hover help each. Can fit on one row. [Waiting on incoming PR for help primitives.]
21. **"Domain: 12 | 10 due" -- meaning unclear.** Hover help.
22. **"Due now" everywhere -- why?** Hover help explaining scheduling state.

### Browse

23. **Browse rows need per-card stats.** User couldn't find which card they just reviewed. Add: last reviewed, state, stability, due -- at minimum enough signal to locate the card you just touched.

### Card detail (again)

24. **Badges "Airspace / Basic / Course" -- what do they mean?** Hover help. [Waiting on incoming PR.]
