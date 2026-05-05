---
key: bc
term: BC
related: [goal, plan]
---

# BC

**Bounded Context (Domain-Driven Design).** A backend module that owns one model and its rules. In airboss, `bc/study` owns goals, plans, sessions, cards, and reviews as separate sub-aggregates with their own invariants.

The user-facing surface does not have to mirror the BC structure. Goal and Plan are two BCs with two distinct uniqueness invariants (one primary goal per user, one active plan per user) but the user sees them rolled onto a single Program page.
