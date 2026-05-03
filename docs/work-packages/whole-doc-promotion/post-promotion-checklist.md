# Post-promotion checklist

When all 5 whole-doc handbook section-tree promotions land (WP-MTN, WP-RMH, WP-AIH, WP-IPH, WP-IFH), execute this checklist:

## Verify all promoted

```bash
find handbooks aim ac acs -name "manifest.json" | xargs -I{} jq -r '.kind' {} | sort | uniq -c
```

Expected: zero `whole-doc` entries. If any remain, that promotion didn't fully land.

## Check active corpus state

```bash
grep -E "^  - doc_id" scripts/sources/config/handbooks-extras.yaml | wc -l
```

Expected: 0 (or 1 if mtn-tips stayed in handbooks-extras with section-tree; verify which path WP-MTN took).

## Update REFERENCES.md

Flip every whole-doc handbook row to "✅ readable, section-tree" with section count from the new manifest. If headers/structure changed, update.

## Update REFERENCES_ROADMAP.md

Wave 2 status: "✅ all shipped". Wave 4 (handbooks-extras retire + AC promote) becomes the next sequenced work.

## Dispatch WP-EXTRAS-RETIRE

If `handbooks-extras.yaml` is empty (or only mtn-tips remains and the WP-MTN agent's call was to keep it), dispatch WP-EXTRAS-RETIRE per [its spec](../wp-handbooks-extras-retire/spec.md). It's small — delete the corpus, dispatcher case, and ingest module.

## Dispatch WP-AC-PROMOTE

Per [its spec](../wp-ac-promote-to-section-tree/spec.md). 9 ACs to promote from whole-doc to section-tree. Pre-condition: handbooks-extras retired.

## Dispatch WP-CITATION-CHIPS-TO-FLIGHTBAG

Once all references are section-tree and flightbag has feature parity (per [WP-FLIGHTBAG-CONTENT spec](../wp-flightbag-content-rendering/spec.md)), wire study citation chips to flightbag URLs.

## Dispatch WP-HANGAR-REFS

The hangar admin dashboard for references. Independent of the citation migration; can run in parallel.

## Update handoff doc

Add a "Wave 2 complete" section to the next session's handoff or create a new handoff file capturing the section-tree-everywhere milestone.
