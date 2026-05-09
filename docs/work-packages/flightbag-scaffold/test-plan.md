# flightbag-scaffold test plan

Scaffold-level coverage. Real content + e2e ship in follow-on WPs.

## Automated

### Unit

| Suite                                        | Covers                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/constants/src/routes.test.ts`          | Each `ROUTES.FLIGHTBAG_*` returns the expected URL string for sample inputs; URL components are URI-encoded                                         |
| `libs/sources/src/url-for-reference.test.ts` | `urlForReference` maps each corpus + locator depth to the right `ROUTES.FLIGHTBAG_*` template; falls back to `FLIGHTBAG_HOME` for un-mapped corpora |
| `libs/library/src/index.test.ts`             | Lib's primitives import successfully (smoke); component shape is exported                                                                           |

### Build

| Command                                    | Expectation                    |
| ------------------------------------------ | ------------------------------ |
| `bun run check`                            | 0 errors, 0 warnings           |
| `bun --cwd apps/flightbag run build`       | Vite production build succeeds |
| `bun --cwd libs/sources run test` (vitest) | URL helper suite passes        |

### Lint / grep gates

| Check                            | Pattern                  | Expectation |     |     |                            |                                                             |
| -------------------------------- | ------------------------ | ----------- | --- | --- | -------------------------- | ----------------------------------------------------------- |
| No raw paths in flightbag source | `grep -rE "'/(?:handbook | cfr         | aim | ac  | acs)/" apps/flightbag/src` | Zero matches; every URL must come from `ROUTES.FLIGHTBAG_*` |

## Manual smoke

1. `bun --cwd apps/flightbag run dev` boots on port 9640 without errors.
2. Visit `http://localhost:9640/` -- corpus index renders with placeholder links.
3. Visit `/handbook/phak/8083-25C` -- handbook landing renders.
4. Visit `/handbook/phak/8083-25C/2` -- chapter renders.
5. Visit `/handbook/phak/8083-25C/2/3` -- section renders (placeholder body).
6. Visit `/aim/5/1/7` -- AIM paragraph renders (placeholder body).
7. Visit `/cfr/14/91/103` -- CFR section renders (placeholder body).
8. Visit `/ac/61-65/j` -- AC root renders.
9. Visit `/acs/ppl-airplane-acs-6c/area/1/task/A` -- ACS task renders.

If any route 500s on the placeholder load, the data layer or the resolver dispatch is broken.

## Out of scope (downstream WPs)

- Playwright e2e for navigating between flightbag pages
- Round-trip test: study citation chip -> flightbag URL -> renders the right section
- Performance test: cold-start time for a leaf route
- Visual regression of the placeholder pages (not stable yet)
