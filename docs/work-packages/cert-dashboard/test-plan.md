# Test Plan: Cert Dashboard

Manual walkthrough -- the user runs every step before flipping `status: done`. Per CLAUDE.md "nothing merges without a manual test plan."

## Setup

| Step | Action                                                                                          | Pass criteria                                |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 0.1  | Sign in as Abby (`abby@airboss.test`); confirm Abby's seeded primary goal targets PPL ASEL.     | Dashboard shows Abby's name; goal is primary |
| 0.2  | Confirm `bun run db:seed` has run; PPL ACS Area V is the seeded slice; mastery state exists.    | Reps + cards exist on Area V nodes           |

## Index page (`/credentials`)

| Step | Action                                                                                                         | Pass criteria                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1.1  | Navigate to `/credentials`.                                                                                    | Page loads; cards render for each credential in Abby's primary goal                          |
| 1.2  | Each card shows: title, kind label, category/class, mastery %, coverage %.                                     | Numbers match `getCredentialMastery` for Abby; mastery <= coverage                           |
| 1.3  | Mastery vs coverage labelled distinctly. Coverage = touched leaves / total; mastery = mastered / total.        | Tooltips or InfoTip explain the difference                                                   |
| 1.4  | Click a credential card.                                                                                       | Lands on `/credentials/[slug]`; back button returns                                          |
| 1.5  | Pre-check empty state: archive Abby's primary goal in the DB, refresh `/credentials`.                          | Banner: "Set a primary goal to filter this list"; all active credentials listed             |
| 1.6  | Restore Abby's primary goal.                                                                                   | Filtered list returns                                                                        |

## Detail page (`/credentials/[slug]`)

| Step | Action                                                                                          | Pass criteria                                                                                |
| ---- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2.1  | Navigate to `/credentials/private`.                                                             | Page loads with credential header (title, kind, category, class)                             |
| 2.2  | Prereq snippet shows immediate (one-hop) prereqs only.                                          | For PPL: empty (no prereqs); for CFII: shows CFI + IR; deep links work                       |
| 2.3  | Mastery rollup shows total leaves, covered, mastered.                                           | Numbers match `getCredentialMastery`; per-area breakdown visible                             |
| 2.4  | Each area row links to `/credentials/private/areas/[areaCode]`.                                  | Click navigates correctly                                                                    |
| 2.5  | "Supplemental syllabi" disclosure collapsed by default; expanding shows `getCredentialSyllabi`. | Disclosure expands; rows render                                                              |
| 2.6  | Visit `/credentials/private?edition=faa-s-acs-25`.                                              | Loader resolves the pinned edition; URL keeps `?edition=`                                    |
| 2.7  | Visit `/credentials/private` (no edition) for a credential with no primary syllabus authored.   | Empty state: "Syllabus not yet authored"; ADR 016 phase 10 link present                      |
| 2.8  | Visit `/credentials/no-such-cred`.                                                              | 404 page                                                                                     |

## Area drill (`/credentials/[slug]/areas/[areaCode]`)

| Step | Action                                                                                                | Pass criteria                                                                                  |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 3.1  | Navigate to `/credentials/private/areas/V` (Area V is the authored slice).                            | Area header renders; task list visible                                                         |
| 3.2  | Tasks expand to show K/R/S elements with mastery state.                                                | K, R, S separate; mastery indicators per element                                                |
| 3.3  | Element row shows linked knowledge nodes; jump-to-learn link routes to `/knowledge/[slug]/learn`.     | Click navigates; learn page loads the right node                                                |
| 3.4  | Element row shows citations from `getCitationsForSyllabusNode`.                                       | Citation chips render; clicking opens the cited section in the handbook reader                 |
| 3.5  | Breadcrumbs render: `Credentials -> Private -> Area V`.                                                | Each crumb is a link except the last                                                           |
| 3.6  | Visit `/credentials/private/areas/ZZ`.                                                                 | 404 page                                                                                       |

## Help page

| Step | Action                                                            | Pass criteria                                  |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------- |
| 4.1  | Open the help drawer on `/credentials`.                           | "Credentials" help page loads with sections    |
| 4.2  | Same on the detail page.                                          | Same help page; section links resolve          |
| 4.3  | `bun run check` -- help-id validator passes.                      | "help-id validator: OK"                        |

## Regressions

| Step | Action                                                                                | Pass criteria                                  |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 5.1  | Walk `/dashboard`, `/memory`, `/reps`, `/knowledge`, `/calibration`.                  | No regressions; styles intact                  |
| 5.2  | Run `bun run check`.                                                                  | 0 errors, 0 warnings                           |
| 5.3  | Run Playwright e2e: `bunx playwright test cert-dashboard`.                            | All cert-dashboard tests pass                  |
| 5.4  | Run Vitest unit tests for the credentials BC.                                         | No regressions in `credentials.test.ts`        |

## Sign-off

User sign-off date: ____________
