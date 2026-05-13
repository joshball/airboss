---
id: course-tree-arbitrary-depth
title: 'User Stories: Course Tree -- Arbitrary Depth'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-12
owner: agent
depends_on:
  - course-primitive
unblocks:
  - wx-scenarios-course-section
tags:
  - course
  - user-stories
legacy_fields:
  feature: course-tree-arbitrary-depth
  type: user-stories
---

# User Stories: Course Tree -- Arbitrary Depth

Three personas. Each story carries the success outcome + the failure path that the WP prevents.

## Author (writing course YAML)

### US-A1 -- I want to nest a lesson under a section so a multi-substep scenario is one navigable unit

As a course author writing the WX Scenarios section, I want each of the 6 scenarios to be a `lesson` with 4 substeps (intro / charts / analysis / instructor-internals) so the learner sees one lesson title in the outline and walks four leaves under it, instead of seeing 24 sibling leaves jammed into a flat section.

- **Success**: I author `level: lesson` on a YAML node; the seed accepts it; the outline renders the lesson title with substeps indented under it
- **Failure prevented**: today the seed throws "course step '<code>' must carry knowledge_node_id" because every non-section must be a leaf. I have no way to author a non-leaf that isn't a section. This WP removes that ceiling

### US-A2 -- I want the schema to permit deeper nesting if a future course needs it

As a future author writing (e.g.) a degree-program-shape course with semester / unit / lesson / step depth, I want to nest 4 levels deep without another platform-side WP. The schema permits depth up to 10; my pedagogy designs the shape; the platform supports it.

- **Success**: 4-level YAML parses, seeds, lenses, and renders without code changes
- **Failure prevented**: today every new depth is a structural WP. After this WP it's a YAML author's choice

### US-A3 -- I want my 2-level course to keep working unchanged

As the author of the existing weather-comprehensive course, I want my YAML to seed exactly as today after the schema change. No edits, no migrations, no diff in the rendered output.

- **Success**: `bun run db reseed` produces zero diff against my course's row set
- **Failure prevented**: a breaking change that demands every existing course be rewritten

## Learner (navigating)

### US-L1 -- I want the outline to make the lesson grouping visible

As a learner browsing the course outline, I want to see the lesson titles as a level above the leaf steps so the structure of a multi-substep scenario reads as a single coherent unit, not 4 sibling steps.

- **Success**: section h2 -> lesson h3 -> step li, indented; lesson title acts as a clickable landing
- **Failure prevented**: today the outline renders every leaf as a flat list; deep structure is invisible

### US-L2 -- I want prev/next to walk naturally through a lesson's substeps and then to the next lesson

As a learner working through Scenario 1's 4 substeps, I want clicking "next" four times to walk through every substep in order, then "next" once more to enter Scenario 2's first substep.

- **Success**: prev/next traverses leaves depth-first; the visit order matches the document order
- **Failure prevented**: today the step reader has no prev/next at all. I navigate by going back to the outline every time. This WP adds the rail

### US-L3 -- I want the lesson landing page to give me context before I dive in

As a learner clicking into Scenario 1 from the outline, I want to land on a page that frames the scenario (KSTL -> KORD, cold front passage, etc.) and lists the four substeps so I know what's coming before I commit.

- **Success**: lesson URL renders a landing with `body_md` + child list
- **Failure prevented**: today clicking a non-leaf URL 404s. There's no way to surface lesson framing

### US-L4 -- I want the breadcrumb to show me where I am in the lesson tree

As a learner three substeps deep into a scenario, I want a breadcrumb that reads "Weather Comprehensive / Scenarios / Cold Front Passage / Reading the Charts" so I know my place + can jump up.

- **Success**: breadcrumb component renders the parent chain
- **Failure prevented**: today there's no breadcrumb; the URL is the only orientation cue

## Course architect (Joshua + future content lead)

### US-CA1 -- I want to design course shape per the pedagogy, not per the schema

As the platform's course architect, I want the schema to be a tool that supports the structure I design, not a constraint that designs the structure for me. When pedagogy says "this scenario wants four substeps under a lesson title," the platform says yes.

- **Success**: the schema permits whatever structure pedagogy needs (up to a sanity cap of 10 levels)
- **Failure prevented**: the LMS dictating that every course must be exactly section + step

### US-CA2 -- I want one structural primitive that all future courses share

As the architect, I want every future course (Weather, IFR Procedures, FIRC, FAR Navigation) to share the same tree primitive. A 4-substep scenario in Weather and a 5-substep checkride prep in IFR Procedures are the same shape from the platform's perspective.

- **Success**: one schema, one lens, one renderer; every course is a tree
- **Failure prevented**: per-course structural extensions

### US-CA3 -- I want zero data migration to land this change

As the architect, I want the new schema to accept my existing content unchanged. No data migration, no migration script, no two-shape period. The change is a strict superset.

- **Success**: existing 10 sections re-seed clean; the only changes touch new content
- **Failure prevented**: a phased migration with deprecation windows (which CLAUDE.md explicitly forbids in this codebase)

## Out of scope user concerns

The following user concerns are deferred. See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for full revisit triggers.

- "I want to drag-and-drop lessons in the outline" -- deferred to a future Hangar editor WP
- "I want this lesson to appear in two courses" -- deferred until a real reuse case surfaces
- "I want this lesson to be instructor-only" -- per-row visibility deferred until role gating earns its own WP
- "I want the outline to collapse / expand" -- deferred until content scale demands it; static outline is sufficient for v1
