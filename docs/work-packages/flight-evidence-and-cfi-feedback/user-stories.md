---
title: 'User Stories: Flight evidence and CFI feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: user-stories
status: draft
review_status: pending
created: 2026-05-04
---

## The student in the plane

- As a student pilot, I want to log every maneuver I attempted on a flight, so I have a record of what I practiced.
- As a student, I want to enter the actual numbers from my flight (rotate speed, touchdown distance, altitude held), so I can compare my performance to the standards over time.
- As a student, I want to upload my GPS track from ForeFlight / CloudAhoy / Sentry, so I can see where I actually flew alongside my numbers.
- As a student, I want to self-assess each maneuver before my CFI sees it, so I'm honest with myself about what went well and what didn't.
- As a student, I want my flight evidence to count toward my Practiced pill, so my progress reflects what I've actually done in the cockpit.

## The student getting feedback

- As a student, I want to see my CFI's assessment + notes on each maneuver, so I know what to work on next time.
- As a student, I want my CFI's feedback to persist across sessions, so I can revisit "what did instructor say about my last short field?" weeks later.
- As a student, I want to know when my CFI hasn't reviewed a maneuver yet, so I'm not waiting on them when I should be flying again.
- As a student, I want to edit my self-assessment after a CFI signoff if I notice I logged the wrong number, so my record is accurate -- and I want my CFI to see I edited it.

## The CFI

- As a CFI, I want a list of my active students, so I see who I'm responsible for.
- As a CFI, I want to see each student's recent flight attempts, so I can review what they've been doing without scheduling a meeting.
- As a CFI, I want to leave per-maneuver feedback that's tied to the ACS leaf, so my notes feed the student's progress map automatically.
- As a CFI, I want to mark a maneuver "satisfactory" / "needs work" / "unable", so my signoff aligns with ACS standards.
- As a CFI, I want my signoff to update my student's Practiced pill, so they see immediate progress without me explaining the system.
- As a CFI, I want to see if a student edited a maneuver after my signoff, so I can decide whether to re-sign-off or push back.

## The CFI authoring a syllabus

- As a CFI, I want to author my own teaching syllabus, so I can teach in the order that works for me, not the order the FAA happens to write the ACS in.
- As a CFI, I want to drag-and-drop lessons to reorder them, so changing my approach mid-semester takes seconds, not minutes.
- As a CFI, I want my reorder to save immediately without a "Save" button, so I trust the UI.
- As a CFI, I want each lesson to link to one or more ACS leaves, so my students' progress on my syllabus rolls up to checkride readiness.
- As a CFI, I want my syllabus to be the default Course view for my students on `/study`, so they see my plan, not the generic FAR navigation course.
- As a CFI, I want my syllabus private to me by default, so I'm not accidentally sharing my pedagogy.

## The CFI / student edge

- As a CFI, I want to invite a new student via email, so onboarding doesn't require admin intervention.
- As a CFI, I want to pause a link without deleting it, so I can take a break from a student without losing the history.
- As a CFI, I want to end a link cleanly, so a graduated student is no longer in my active list.
- As a CFI, I want my private notes about a student (separate from per-maneuver notes), so I can track "this student is anxious about engine-out" without the student seeing it.

## The student switching CFIs

- As a student with two CFIs, I want each to see only their own assessments, so feedback isn't tangled.
- As a student switching CFIs, I want past feedback from my previous CFI to remain visible, so the history is durable.

## The track-uploading user

- As a user with a CloudAhoy export, I want to upload that file directly without converting it, so I don't have to think about formats.
- As a user with a ForeFlight CSV, I want it to just work, so I'm not learning a new tool.
- As a user without GPS gear, I want logging to be optional, so I can still record my flight numbers.

## The progress-watcher

- As a learner, I want my CFI-signed-satisfactory maneuvers to count as fully mastered, so the system reflects ACS-standard performance.
- As a learner, I want my self-assessed maneuvers to count as "covered but not mastered", so I see I've started but haven't proven it yet.
- As a learner, I want a clear visual difference between "not attempted", "self-assessed only", and "CFI-signed", so I always know my exact status.

## The audit-aware admin

- As a hangar admin, I want every CFI signoff to appear in the audit log, so I can investigate disputes about who said what when.
- As a hangar admin, I want the syllabus reorder to be a single audit row with the full new ordering, so I can see "instructor changed lesson order from X to Y at time Z" in one record.

## The forward-looking

- As a student, I want my flight evidence to remain valid when WP 3's render-mode toggle ships, so changes to the knowledge node UI don't reset my history.
- As a CFI, I want my teaching syllabus to support more lesson kinds (ground vs. flight, in-class vs. solo) in a future WP, so I have room to grow.
