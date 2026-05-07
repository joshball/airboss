---
pr: 200
date: 2026-04-25
title: "test(themes): component test infra + ThemePicker a11y coverage"
wp_id: null
bugs_fixed: []
summary: |
  Establishes component-test infrastructure on top of the existing vitest setup, then proves it on the theme picker. Closes the gap left by PR #195, which landed nine a11y behaviors with no automated coverage because the BC/lib-only vitest config had no DOM env.
---
