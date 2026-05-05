---
key: testid
term: testid
related: [e2e, page-anchor]
---

# testid

`data-testid="..."` -- a stable hook for tests, separate from CSS classes and visible text.

A testid does not change when the visible label is rewritten or when the styling moves. That is the whole point: tests written against `getByTestId('home-cta-primary')` survive copy churn and re-skinning.

Convention in the study app:

- Top-level route: `data-testid="page-anchor"` on the page's `<h1>`.
- Sub-tab: `data-testid="{section}-tab-{name}"`.
- Primary CTA: `data-testid="{page}-cta-primary"`.
- Nav: `data-testid="nav-{section}"`.

**Never repurpose a testid.** If the meaning changes, rename it.
