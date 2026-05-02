# AFH chapter 02 rename diff

Source: `handbooks/afh/FAA-H-8083-3C/02/`
Target: `handbooks/afh/FAA-H-8083-3C/02-ground-operations/`

Chapter title: "Ground Operations" (from frontmatter `section_title` of `index.md`).
Slug: `ground-operations`.

## Note on the brief

The user's brief stated "AFH does NOT have an index.md, only sections." That is incorrect for the current state of the repo: every AFH chapter directory (01..18) does contain an `index.md`. AFH chapter 02 here behaves identically to PHAK chapter 02 with regard to the rename.

## Directory rename

| Before                                | After                                          |
| ------------------------------------- | ---------------------------------------------- |
| `handbooks/afh/FAA-H-8083-3C/02/`     | `handbooks/afh/FAA-H-8083-3C/02-ground-operations/` |

## File renames

Includes the errata pairing case: `02-preflight-assessment-of-the-aircraft.md` and its sibling `02-preflight-assessment-of-the-aircraft.errata.md`. Errata files are NOT renamed -- they share the section file's stem and follow it.

| Before                                                     | After                              |
| ---------------------------------------------------------- | ---------------------------------- |
| `index.md`                                                 | `00-ground-operations.md`          |
| `01-introduction.md` ... `15-chapter-summary.md`           | (unchanged)                        |
| `02-preflight-assessment-of-the-aircraft.md`               | (unchanged)                        |
| `02-preflight-assessment-of-the-aircraft.errata.md`        | (unchanged) -- sibling of the .md   |
| `02-01-visual-preflight-assessment.md` ... `02-05-engine-and-propeller.md` | (unchanged)         |
| `03-risk-and-resource-management.md` and `03-NN-*.md`      | (unchanged)                        |
| `14-post-flight.md`, `14-01-securing-and-servicing.md`     | (unchanged)                        |

## Errata pairing rule

For every `<NN>(-<MM>)?-<slug>.md` section file, an optional `<NN>(-<MM>)?-<slug>.errata.md` may exist alongside it. The pair must always move together. The migration script identifies pairs by basename equivalence ignoring the `.errata` infix. No errata file is ever stranded.

## File count

| Before | After |
| ------ | ----- |
| 34     | 34    |
