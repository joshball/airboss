---
title: 'User Stories: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: user-stories
status: draft
review_status: pending
created: 2026-05-04
revised: 2026-05-04
---

## The student in the plane

- As a student pilot, I want to log every maneuver I attempted on a flight, so I have a record of what I practiced.
- As a student, I want to enter the actual numbers from my flight (rotate speed, touchdown distance, altitude held), so I can compare my performance to the standards over time.
- As a student, I want to upload my GPS track from ForeFlight / CloudAhoy / Sentry, so I can see where I actually flew alongside my numbers.
- As a student, I want to self-assess each maneuver, so I'm honest with myself about what went well and what didn't.
- As a student, I want my flight evidence to count toward my Practiced pill, so my progress reflects what I've actually done in the cockpit -- without waiting on someone else's signoff.

## The student practicing solo

- As a returning pilot rebuilding skills before booking time with a CFI, I want my self-assessed practice to count, so I don't see "Practiced: 0%" forever.
- As a solo student, I don't want the system to gate my progress behind a CFI signoff I don't have yet, so I can use airboss the day I start practicing.
- As a solo student, I want a clear visual difference between "self-assessed satisfactory" and "teacher-signed satisfactory" when both apply to the same leaf, so I always know what the data is.

## The student getting feedback

- As a student, I want to invite a teacher (CFI, mentor, or just a friend who knows aviation) to review a specific flight, so I can get feedback without committing to an ongoing relationship.
- As a student, I don't want my teacher to have to "create an account" before they can leave feedback, so they actually leave feedback instead of bouncing.
- As a student, I want to see my teacher's assessment + notes on each maneuver, so I know what to work on next time.
- As a student, I want my teacher's feedback to persist across sessions, so I can revisit "what did instructor say about my last short field?" weeks later.
- As a student, I want to know when my teacher hasn't reviewed a maneuver yet, so I'm not waiting on them when I should be flying again.

## The teacher receiving a debrief invite

- As a CFI clicking a debrief link, I want to land directly on the flight I'm reviewing, so I don't navigate through a sign-up flow.
- As a CFI receiving a link, I want the email to tell me what flight I'm being asked about (date, aircraft, route), so I know what I'm signing up for before I click.
- As a CFI, I want to leave per-maneuver feedback that's tied to the ACS leaf, so my notes feed the student's progress map automatically.
- As a CFI, I want to mark a maneuver "satisfactory" / "needs work" / "unable", so my assessment aligns with ACS standards.
- As a CFI, I never want to be asked to "create my account" to leave one piece of feedback, so the friction stays below my threshold for engagement.
- As a CFI who's left feedback once, I want to know I can come back later (the system remembers me), so subsequent debriefs feel natural.

## The teacher in an ongoing relationship

- As a teacher with several students, I want a list of my active students, so I see who I'm responsible for.
- As a teacher, I want to see each student's recent flight attempts in one place, so I can review what they've been doing without scheduling a meeting.
- As a teacher, I want to pause a link without deleting it, so I can take a break from a student without losing the history.
- As a teacher, I want to end a link cleanly, so a graduated student is no longer in my active list.
- As a teacher, I want my private notes about a student (separate from per-maneuver notes), so I can track "this student is anxious about engine-out" without the student seeing it.
- As a teacher, I want to see when a student edited a maneuver after my signoff, so I can decide whether to re-sign-off or push back.

## The teacher authoring a syllabus

- As a teacher, I want to author my own teaching syllabus, so I can teach in the order that works for me, not the order the FAA happens to write the ACS in.
- As a teacher, I want to drag-and-drop lessons to reorder them, so changing my approach mid-semester takes seconds, not minutes.
- As a teacher, I want my reorder to save immediately without a "Save" button, so I trust the UI.
- As a teacher, I want each lesson to link to one or more ACS leaves, so my students' progress on my syllabus rolls up to checkride readiness.
- As a teacher, I want my syllabus to be the default Course view for my students on `/study`, so they see my plan, not the generic FAR navigation course.
- As a teacher, I want my syllabus private to me by default, so I'm not accidentally sharing my pedagogy.

## The student switching teachers

- As a student with two teachers, I want each to see only their own assessments, so feedback isn't tangled.
- As a student with multiple active teachers, I want to choose whose syllabus is my default Course view, so I'm studying with the right plan.
- As a student switching teachers, I want past feedback from my previous teacher to remain visible, so the history is durable.

## The CFI / mentor / peer distinction

- As a student, I want to invite a mentor (not a CFI) to look at my work, so I get feedback from someone whose certificates aren't the point.
- As a peer-study partner, I want to engage as a "peer" not a "cfi" so the relationship kind reflects reality.
- As a teacher, I want my role's `kind` to default to `cfi` when invited via debrief (assuming most invites come from students wanting a CFI), but be editable to `mentor` or `peer` if that's actually who I am.

## The track-uploading user

- As a user with a CloudAhoy export, I want to upload that file directly without converting it, so I don't have to think about formats.
- As a user with a ForeFlight CSV, I want it to just work, so I'm not learning a new tool.
- As a user without GPS gear, I want logging to be optional, so I can still record my flight numbers.

## The objective progress watcher

- As a learner, I want my Practiced pill to count any maneuver where someone (me or a teacher) said "satisfactory," so the system is a tracker not a judge.
- As a learner, I want to see the breakdown ("9 self, 6 teacher") when I drill in, so I know how the number was computed.
- As a learner, I want a clear visual difference between "not attempted", "attempted but no satisfactory assessment", and "at least one satisfactory assessment", so I always know my exact status -- without the system inventing a grade.

## The audit-aware admin

- As a hangar admin, I want every teacher signoff to appear in the audit log, so I can investigate disputes about who said what when.
- As a hangar admin, I want every role grant / revoke to appear in the audit log, so I can investigate "how did this user become a teacher?" questions.
- As a hangar admin, I want the syllabus reorder to be a single audit row with the full new ordering, so I can see "teacher changed lesson order from X to Y at time Z" in one record.

## The role-aware user

- As any user, I want the `student` role to be auto-granted on first sign-in, so I can use `/study` without setup.
- As a student who's also a CFI for someone else, I want both roles to coexist on my account, so I'm not forced to pick one.
- As a CFI who wants to brush up on my own currency, I want my `student` role to be active alongside my `teacher` role, so I can study and teach from the same account.
- As a user who never wants to teach, I want to be able to revoke the teacher role I was auto-granted, so I'm not perpetually opted in to something I don't want.

## The forward-looking

- As a student, I want my flight evidence to remain valid when WP 3's render-mode toggle ships, so changes to the knowledge node UI don't reset my history.
- As a teacher, I want my teaching syllabus to support more lesson kinds (ground vs. flight, in-class vs. solo) in a future WP, so I have room to grow.
- As a user, I want the schema to be ready for billing later (subscription, plan, certificate verification) without a major rework, so the platform can monetize when the time is right.
- As a student logging GPS tracks, I want a future enhancement to grade my track against maneuver standards automatically (per the ADS-B / GPS auto-grading IDEA), so I learn what the numbers say without doing the math myself.
