# CFR Part missing on /dev/cards

> Applies to: `regulations/cfr-*` + `study.reference` seed pipeline. Last updated 2026-05-08.

A CFR Part has authoring metadata but doesn't render on `/dev/cards`. Walk these four layers in order and stop at the first one that fails. Most of the time it's layer 1.

## Probe order

### 1. DB row exists in `study.reference`?

```bash
PGPASSWORD=airboss psql -h localhost -p 5435 -U airboss -d airboss -tA \
  -c "SELECT * FROM study.reference WHERE document_slug='14cfrXXX';"
```

If null, the gap is at the YAML refs file (`course/references/cfr-titles.yaml`). The seeder skips Parts without a manifest entry and logs `skip <slug>: no DB row in study.reference (long-tail Part out of scope per WP-CFR spec)`. Add the entry and re-seed.

### 2. `sections.json` has the Part?

```bash
python3 -c "import json; d = json.load(open('regulations/cfr-14/<edition>/sections.json')); print('XXX' in d['sectionsByPart'])"
```

If `False`, eCFR ingest hasn't run for the Part. Run the ingest pipeline.

### 3. Body markdown materialized on disk?

```bash
ls regulations/cfr-14/<edition>/<part>/
```

Empty directory means ingest started but didn't write markdown. Re-run with logs.

### 4. `_authoring/parts.yaml` has the overlay?

```bash
grep -A3 "^  - number: 'XXX'" regulations/cfr-{14,49}/_authoring/parts.yaml
```

If absent, description / whyItMatters / topics are missing -- author the overlay and re-seed.

## Re-seed

```bash
bun scripts/db/seed-references-from-manifest.ts
```

## Real example

PR #691 (2026-05-07) -- Wave 1 added overlays for Parts 68/103/105/119/121/125/133/137 in `_authoring/parts.yaml` but only Part 68 was added to `cfr-titles.yaml`. The other 7 sat dormant for a session until the `skip <slug>: no DB row` lines were spotted in the seed log. Layer 1 caught it; the other layers were green.

## Spec reference

The "no DB row → skip" behavior is intentional. See the WP-CFR work package spec: [docs/work-packages/wp-cfr/spec.md](../../work-packages/wp-cfr/spec.md).
