# Credentials

Authored credential YAMLs seeded into `study.credential` + `study.credential_prereq` + `study.credential_syllabus` by `bun run db seed credentials`.

One YAML per credential. Each carries:

- `slug` -- stable kebab-case identifier (PK on `credential.slug`).
- `kind` -- one of `pilot-cert`, `instructor-cert`, `category-rating`, `class-rating`, `endorsement`, `student`.
- `title` -- display name.
- `category` -- aircraft category (`airplane`, `rotorcraft`, ..., `none` for credentials without a category).
- `class` -- class rating slug (`single-engine-land`, ...) or null.
- `regulatory_basis` -- inline `StructuredCitation[]` array carrying CFR references for the credential.
- `prereqs` -- list of `{ slug, kind }` edges into `credential_prereq`. `kind` is `required` / `recommended` / `experience`.
- `syllabi` -- list of `{ slug, primacy }` linking to syllabus rows. `primacy` is `primary` (one per credential) or `supplemental`.

## Authoring

Add a new credential as a new YAML file and reference its slug from prereqs / syllabi where appropriate. Run `bun run db seed credentials` after authoring; the seed validates the DAG is acyclic and that every referenced slug resolves.

## Seed origin

Production seeds set `seed_origin=null`; dev seeds may stamp a tag for cleanup via `bun run db seed:remove --origin <tag>`.
