---
status: deferred
trigger: when sim scenario seeding/editing moves into hangar
source: 2026-04-27 schema review
---

# Promote sim manifests to a `sim.scenario` table

## Problem

`sim.attempt.scenario_id` is a `text` not-null with no FK. The sim BC reads/writes scenario manifests from disk (`apps/sim` ships with manifests). The column is effectively a magic string with no rename safety, no shape guard, and no way to ask the DB "list scenarios that have ever been attempted."

## Scope

1. Add `sim.scenario { id text pk, slug text unique, manifest_path text, ... }`.
2. Mirror manifests on hangar boot (or via a `sim` BC seed).
3. `sim.attempt.scenario_id REFERENCES sim.scenario(id) ON DELETE RESTRICT`.

## Trigger

When sim scenarios become editable in hangar (no longer pure on-disk manifests).
