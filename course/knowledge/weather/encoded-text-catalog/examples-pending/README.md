# Examples pending review

Catalog-example **candidates** authored from the `/practice/wx/test-page`
truth-model sandbox (Drill Phase 4). Each `<slug>.json` file in this
directory is a review queue entry, not a published catalog example.

## Lifecycle

1. An admin drags the sandbox sliders until a METAR or TAF looks the way
   they want, then clicks "Save as catalog example."
2. The sandbox writes a `CatalogExampleCandidate` JSON file here.
3. A human reviews the candidate and -- if it earns a place -- promotes it
   into the matching catalog markdown
   (`metar.md` / `taf.md` / ...) as a real example entry, then deletes the
   candidate file.

## Candidate shape

Each file carries enough to promote into a catalog markdown example:

- `slug` -- stable identifier (also the filename)
- `product` -- `metar` or `taf`
- `raw` -- the encoded product string the engine derived
- `synoptic` -- the 1-2 sentence story explaining why the product looks
  like this
- `tokenFamilies` -- the catalog token-family slugs the example exercises
- `references` -- source citations (AC 00-45H, AIM, FMH-1)
- `sliderState` -- the exact sandbox lever positions that produced it
  (provenance: re-derivable)
- `authoredAt` / `authoredBy` -- who saved the candidate, and when

Candidate files are working artifacts. They are not consumed by
`catalog.json` and do not appear on the examples page until a human
promotes them.
