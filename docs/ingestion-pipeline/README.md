# Ingestion pipeline

How FAA reference material flows from publisher URLs into queryable, citable in-app content. This directory is the home for everything about the **process** — discovery, download, extraction, registration, resolution, citation.

## Map

| Doc | Purpose |
| --- | ------- |
| [pipeline.md](pipeline.md) | The five steps end-to-end. Read this first. |
| [tooling.md](tooling.md) | Tools used at each step (`pdftotext`, PyMuPDF/`fitz`, Drizzle, dispatcher CLIs, etc.) |
| [inventory.md](inventory.md) | What's currently ingested |
| [section-extraction-strategies.md](section-extraction-strategies.md) | TOC parse vs prompt extraction vs compare |
| [section-extraction-prompt-strategy.md](section-extraction-prompt-strategy.md) | The fresh-session prompt-flow for LLM-assisted extraction |
| [handbook-ingest-pipeline.md](handbook-ingest-pipeline.md) | Per-handbook operator guide (older — superseded by `pipeline.md` for the big picture) |
| [handbook-ingestion-strategies.md](handbook-ingestion-strategies.md) | Strategy-level decision tree (overlap with `section-extraction-strategies.md` — pending consolidation) |
| [handbook-onboarding-checklist.md](handbook-onboarding-checklist.md) | Step-by-step checklist for adding a new handbook |
| [reference-citations-pattern.md](reference-citations-pattern.md) | How citation chips, pickers, and cited-by panels work |
| [reference-system-flow.md](reference-system-flow.md) | High-level data-flow diagram |

## Anchors

- [ADR 018 — Source artifact storage policy](../decisions/018-source-artifact-storage-policy/decision.md)
- [ADR 019 — Reference identifier system](../decisions/019-reference-identifier-system/decision.md)
- [ADR 021 — Source cache flat naming](../decisions/021-source-cache-flat-naming/decision.md)
- [ADR 022 — Chapter source ingestion](../decisions/022-chapter-source-ingestion/decision.md)
- [scripts/README.sources.md](../../scripts/README.sources.md) — operator runbook

## Pending consolidation

There is overlap among `pipeline.md`, `handbook-ingest-pipeline.md`, and `handbook-ingestion-strategies.md`. The newest doc (`pipeline.md`) is the canonical big-picture entry point; the older docs cover specific subsystems and remain useful but are candidates for merging or archiving in a future sweep.

The two `section-extraction-*.md` docs cover the same strategy space from different angles. Same consolidation pending.
