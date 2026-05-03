# Runbook: add a new reference document

Step-by-step procedure for adding a new FAA reference document to airboss. Follows the patterns established by WP-CFR (#491), WP-AC (#480), WP-ACS-V (#501), and WP-AIM.

> **For the canonical list of what's currently in the corpus, see [docs/platform/REFERENCES.md](../platform/REFERENCES.md).** This runbook is for ADDING something not yet there.

## Decision tree

Before you start: pick the corpus.

```text
Is it a chapter-aware FAA handbook (FAA-H-XXXX-NX)?
├─ YES, with per-chapter PDFs → handbooks/, Class A2 (use afh.yaml as template)
├─ YES, single PDF only → handbooks/, Class C (use avwx.yaml as template)
└─ NO
   ├─ Advisory Circular (AC NN-NN) → ac/ corpus
   ├─ Airman Certification Standards (FAA-S-ACS-N) → acs/ corpus
   ├─ AIM section → can't add piecewise; AIM ingests as a whole
   ├─ CFR Part → cfr-titles.yaml + the 14cfr-NN slug pattern
   ├─ NTSB ALJ ruling → ntsb-alj/ corpus (`course/references/ntsb-alj.yaml` + `libs/sources/src/ntsb-alj/manifest.yaml`)
   ├─ Chief Counsel opinion → wp-cc corpus (in spec)
   ├─ SAFO / InFO → wp-safo-info corpus (in spec)
   └─ Something else → discuss in REFERENCES.md before pipelining
```

## Procedure (handbook example)

### 1. Author the YAML config

`scripts/sources/config/handbooks/<slug>.yaml`:

```yaml
edition: FAA-H-XXXX-NX
source_url: https://www.faa.gov/sites/faa.gov/files/<path>.pdf
filename: FAA-H-XXXX-NX.pdf
subjects: [<1-3 from AVIATION_TOPIC_VALUES>]
primary_cert: <one of CERT_APPLICABILITY_VALUES, or null>

# For Class A2 (chapter PDFs available):
chapter_pdfs:
  base_url: https://www.faa.gov/sites/faa.gov/files/<path>/
  pattern: "<NN>_<slug>_<N>.pdf"  # or whatever the FAA uses
  count: 17
  file_ordinal_offset: 2  # if filenames start at 02_ for chapter 1
  outline_strategy: bookmark  # or 'toc-page', 'prompt', 'toc-file'

# For Class C (single PDF):
# omit chapter_pdfs; outline_strategy goes at top level
outline_strategy: bookmark
```

### 2. Download

```bash
bun run sources download --only handbooks
```

Bytes land in `~/Documents/airboss-handbook-cache/handbooks/<slug>/<edition>/`.

### 3. Extract

```bash
bun run sources extract handbooks <slug> --edition <edition>
```

Per-chapter `.md` files + `manifest.json` written to `handbooks/<slug>/<edition>/`.

If extraction picks the wrong section boundaries:
- Try `--strategy compare` to see TOC vs prompt-flow disagreements
- Edit the YAML's `outline_strategy` field
- Re-run

### 4. Author the YAML reference card (if not auto-generated)

For corpora that don't auto-generate cards from the handbook config (most don't), add a reference YAML at `course/references/<corpus>.yaml`:

```yaml
- slug: <slug-matching-the-card>
  kind: handbook
  edition: <edition>
  title: <Common name>
  publisher: FAA
  url: <publisher index page>
  subjects: [<same as ingest config>]
  primary_cert: <same>
```

### 5. Register

```bash
bun run sources register handbooks
```

Inserts `study.reference` row + `study.reference_section` rows.

### 6. Verify

```bash
bun run db reset --force && bun run db seed
```

Visit `/library/handbook/<slug>/` (or eventually `flightbag/handbook/<slug>/...`) to see the new doc. Drill down through chapters/sections.

### 7. Update REFERENCES.md

Add a row to the right corpus section. Mark stage `✅ readable, section-tree`. Include section count. Update the "Last updated" line at the top.

### 8. Tests

- Re-run the affected test suites
- `bun run check`

### 9. Ship

One PR per new document (or batch related docs). Title: `feat(study): add <slug> (<FAA number>) <common-name>`.

## Procedure (AC example, per WP-AC #480 + WP-AC-LINK-ONLY draft)

Different config file but same shape:

1. `scripts/sources/config/ac.yaml` — add an entry
2. `bun run sources download --only ac`
3. `bun run sources register ac` (extracts + registers in one step for whole-doc-shaped ACs; for section-tree ACs, run `extract` first)
4. Add YAML card to `course/references/advisory-circulars.yaml`
5. Verify, update REFERENCES.md, ship

## Anchors

- [pipeline.md](pipeline.md) — the 5-step ETL walkthrough (what each step does)
- [tooling.md](tooling.md) — `pdftotext` / PyMuPDF / cli dispatcher details
- [section-extraction-strategies.md](section-extraction-strategies.md) — TOC vs prompt vs compare
- [docs/platform/REFERENCES.md](../platform/REFERENCES.md) — canonical list
- [docs/work-packages/whole-doc-promotion/research.md](../work-packages/whole-doc-promotion/research.md) — per-handbook strategy precedents
