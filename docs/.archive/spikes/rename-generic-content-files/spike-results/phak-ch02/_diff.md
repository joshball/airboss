# PHAK chapter 02 rename diff

Source: `handbooks/phak/FAA-H-8083-25C/02/`
Target: `handbooks/phak/FAA-H-8083-25C/02-aeronautical-decision-making/`

Chapter title: "Aeronautical Decision-Making" (from frontmatter `section_title`).
Slug: `aeronautical-decision-making` (lowercase, non-alphanumeric -> hyphen, max 48 chars per existing pipeline rule in `tools/handbook-ingest/ingest/normalize.py:_title_slug`).

## Directory rename

| Before                                            | After                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `handbooks/phak/FAA-H-8083-25C/02/`               | `handbooks/phak/FAA-H-8083-25C/02-aeronautical-decision-making/`               |

## File renames

Only `index.md` changes name. All section files and `_*` debug artifacts keep their existing names.

| Before              | After                                  | Notes                              |
| ------------------- | -------------------------------------- | ---------------------------------- |
| `index.md`          | `00-aeronautical-decision-making.md`   | Chapter overview, prefix-sorted to top |
| `01-introduction.md` ... `51-chapter-summary.md` | (unchanged) | 51 section files, already conformant |
| `05-01-hazardous-attitudes-and-antidotes.md` etc. | (unchanged) | nested-section files conformant |
| `_chapter_plaintext.txt`, `_llm_*.json`, `_model_self_report.txt` | (unchanged) | extraction debug outputs |

## Errata

PHAK chapter 02 has no errata files in this chapter (errata exist in PHAK chapters 01, 03, 09, 17). The errata pairing case is exercised in `afh-ch02` instead.

## File count

| Before | After |
| ------ | ----- |
| 65     | 65    |

Same file count, identical contents (only one filename change).
