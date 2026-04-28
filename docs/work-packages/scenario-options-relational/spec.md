---
status: deferred
trigger: when scenario authoring tooling lands, OR when a third use of `chosen_option` appears
source: 2026-04-27 schema review
---

# Promote `scenario.options` JSONB to a relational table

## Problem

`study.scenario.options` is a `jsonb` array carrying identity (`option.id`, `isCorrect`). `study.session_item_result.chosen_option` stores the picked id as free `text` with no FK. Three invariants are enforced only at the app layer:

1. Exactly one `isCorrect: true` per scenario
2. Option ids unique within scenario
3. `chosen_option` corresponds to an extant option id

Renames silently invalidate historical attempts; a seed bypassing the BC could produce zero/two correct options.

## Scope

1. Add `study.scenario_option { id text pk, scenario_id text fk, label text, is_correct bool, ... }`.
2. Partial UNIQUE `(scenario_id) WHERE is_correct = true`.
3. Migrate `session_item_result.chosen_option` text column -> `chosen_option_id` FK to `scenario_option.id`.
4. Migration: unnest existing JSONB arrays, re-key chosen_option strings to the new option ids.
5. Update bc-study reads/writes.

## Trigger

- Scenario authoring UI (rename safety becomes load-bearing).
- Third use site of `chosen_option` (forces FK question).

## Risk

Migration touches `session_item_result` (large append-only table). Run in a maintenance window with a backup.
