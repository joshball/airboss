---
title: 'ADR 025 context: WP frontmatter contract'
date: 2026-05-06
---

# Context: WP frontmatter contract

The conversation that drove ADR 025 happened in the [tracking-system-overhaul work package](../../work-packages/tracking-system-overhaul/spec.md). Key shaping decisions captured here for posterity.

## Why five categories instead of the original closed vocab

The first draft of the parent WP listed 13 thematic categories (`references`, `ingestion`, `citations`, `flightbag`, `learning-engine`, ...). The user's response: "not crazy". The push-back: 13 enum values is taxonomy debt -- every new corpus or surface tempts adding a 14th, and authors disagree about whether a citation-rendering bug is `citations` or `flightbag` or `ui-primitives`.

Five values forces the cross-cutting slice into `tags`, where it belongs. "Get all references work done" becomes `--tag references`, which composes with `--status '!shipped'` and `--product flightbag` exactly the same as a category filter would have.

## Why a single value, not an array

The earlier draft made `category` an array. Two-axis classification (product + categories[]) sounds general but rotted in practice:

- Authors over-tagged ("this is all five things") and under-tagged in the same pass.
- Filters had ambiguous semantics (`--category references,citations` -- AND or OR?).
- Generated views had to pick a primary category for grouping anyway.

A single category plus `tags[]` is cleaner: category is the home, tags are the cross-cuts.

## Why drop `tier`

Original draft: `tier: foundation | feature | polish | bug | infra | docs`. After the category collapse, tier was strict subset of the new five-value category vocabulary plus "bug", and bugs do not live in `docs/work-packages/`. Bugs live in `docs/bugs/` (Phase 6) with their own frontmatter and a `severity` field. Removing `tier` is a net delete -- one less field to fill in, one less field to disagree about.

## Why `human_review_status` is lint-enforced

The current state of the repo: 99 WPs, every `review_status: done` value on disk is a lie because the user has never walked any test plan. Agents flipped the field as part of "shipping" passes that the user never validated.

The fix is structural, not behavioural. A field that agents are told not to touch but can touch will be touched. A field that lint rejects when an agent edits it is impossible to spoof short of forging git config. The committer email check is good enough -- it is the same boundary git itself relies on for every commit attribution decision.

## Why the email is hardcoded

The single human reviewer is the user. There is no team, no CI run, no shared maintainer pool. Hardcoding the email is the simplest enforceable rule; if the user ever changes email, one constant flip in `libs/constants/src/work-package.ts` fixes it.

## Why Phase 1 is read-only

Mutations (`bun run wp set`) are deliberately punted to Phase 3. The hard part of Phase 1 is establishing the contract and proving the lint catches violations. Mutations are an ergonomics layer on top of a working contract; they need their own lint rules (you can't `set status shipped` if `human_review_status` isn't `signed-off`, etc.) and those rules are easier to write once the schema is settled.
