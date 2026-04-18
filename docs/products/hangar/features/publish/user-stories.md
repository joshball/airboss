---
title: "User Stories: Publish Pipeline"
product: hangar
feature: publish
type: user-stories
status: done
---

# User Stories: Publish Pipeline

Feature: Publish course content from authoring schema to published schema.
Status: **Not started**

## Stories

### PUB-1: Publish current content as a release

**As** a content author,
**I want to** publish the current course content as a versioned release,
**So that** sim can serve it to learners.

**Acceptance:**

- [ ] "Publish" button visible on a publish/release page
- [ ] Publish copies all course content (scenarios, modules, questions, micro-lessons, student models, competencies) to published schema
- [ ] A release record is created with a version string and timestamp
- [ ] Publish is atomic -- all tables or none
- [ ] All published rows include the release_id
- [ ] Success shows confirmation with version number

**Test:**

1. Create at least 1 scenario, 1 question, and have seeded modules/competencies
2. Go to `/publish` (or dashboard publish button)
3. Enter version "0.1.0", click Publish
4. Verify: success message with version
5. Verify DB:
   ```bash
   docker exec firc-db psql -U firc -c "SELECT id, version, published_at FROM published.release;"
   docker exec firc-db psql -U firc -c "SELECT title, release_id FROM published.scenario;"
   docker exec firc-db psql -U firc -c "SELECT title, release_id FROM published.module;"
   docker exec firc-db psql -U firc -c "SELECT count(*) FROM published.competency;"
   ```

---

### PUB-2: View published content (read-only)

**As** a content author,
**I want to** see what content is currently published,
**So that** I can verify what learners will experience.

**Acceptance:**

- [ ] Published view shows the latest release version and date
- [ ] Lists published scenarios, modules, questions (read-only, no edit)
- [ ] Content shown is from published schema, not course schema
- [ ] Clearly labeled as "Published" vs "Draft" content

**Test:**

1. After PUB-1, go to published content view
2. Verify: shows release v0.1.0 with timestamp
3. Verify: scenario titles match what was published
4. Verify: cannot edit from this view

---

### PUB-3: Publish again with new content

**As** a content author,
**I want to** publish a new release after making changes,
**So that** learners get updated content.

**Acceptance:**

- [ ] New release gets a new version string
- [ ] Both releases exist in published schema (versioned, not overwritten)
- [ ] New published content has the new release_id

**Test:**

1. After PUB-1, create a new scenario in draft
2. Publish as "0.2.0"
3. Verify DB: two rows in published.release
4. Verify: new scenario appears in published.scenario with the new release_id
5. Verify: old release's scenarios still exist with old release_id
