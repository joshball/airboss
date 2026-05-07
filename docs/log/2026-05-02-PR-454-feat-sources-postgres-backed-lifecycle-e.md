---
pr: 454
date: 2026-05-02
title: "feat(sources): Postgres-backed lifecycle + editions (WP phases 2+3)"
wp_id: promotion-batches-persistence
bugs_fixed: []
summary: |
  recordPromotion / recordDePromotion are now async and write a row to sources_registry.promotion_batches inside a Drizzle transaction before mutating the in-memory overlay. The audit row is the source of truth; ENTRY_LIFECYCLES is a runtime cache replayed at bootstrap. New commitIngestBatch is the single atomic entry point for an ingest pipeline (validate -> upsert sources/editions -> record promotion). Lifecycle failure rolls the in-memory SOURCES / EDITIONS overlays back to their pre-call state. Editions become a generation-counted cache. warmEditionsCache() populates the in-memory map from...
---
