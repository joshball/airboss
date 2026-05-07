---
pr: 490
date: 2026-05-03
title: "feat(content): rename generic content files (no more index.md or document.md)"
wp_id: rename-generic-content-files
bugs_fixed: []
summary: |
  Retires every index.md and document.md in the inline-derivative tree (handbooks/, aim/, ac/) and replaces them with self-describing filenames. Chapter directories now embed their slug (<NN>-<chapter-slug>/); chapter overviews land at <chapter-dir>/00-<chapter-slug>.md; AIM paragraphs become <KK>-<paragraph-slug>.md; whole-doc bodies become <doc-slug>-<edition>.md; AC bodies become ac-<doc>-<rev>.md.
---
