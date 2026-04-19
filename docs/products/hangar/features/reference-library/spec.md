---
title: "Spec: Reference Library & Regulatory Monitoring"
product: hangar
feature: reference-library
type: spec
status: done
---

# Spec: Reference Library & Regulatory Monitoring

Two capabilities: (1) a document store for organizing external reference materials (ACs, CFRs, handbooks, NTSB reports) with bidirectional links to course content, and (2) a regulatory change monitoring workflow that prompts 90-day checks per AC 61-83K and auto-creates tasks when changes are found.

Covers PRD sections C1, C2, and B5.

## What It Does

Authors upload and categorize FAA reference documents. Any content item (scenario, module, competency, question) can link to reference docs, and any reference doc shows all content that cites it. When a reference document is updated, all linked content is flagged for review.

Separately, a 90-day regulatory check workflow ensures the team monitors FAA policy changes. When changes are found, the system auto-creates tasks on the task board.

## Data Model

### New table: `course.reference_document`

| Column           | Type                                | Constraints                       | Notes                                 |
| ---------------- | ----------------------------------- | --------------------------------- | ------------------------------------- |
| `id`             | `text` PK                           |                                   | Tier B ULID: `ref_01jvxyz...`         |
| `title`          | `text` NOT NULL                     |                                   | Document name                         |
| `documentType`   | `text` NOT NULL                     | CHECK: valid `REFERENCE_DOC_TYPE` | AC, CFR, handbook, NTSB report, other |
| `source`         | `text` NOT NULL                     | CHECK: valid `REFERENCE_SOURCE`   | FAA, NTSB, TSA, other                 |
| `version`        | `text`                              |                                   | Version string or publication date    |
| `url`            | `text`                              |                                   | External link (if no file upload)     |
| `filePath`       | `text`                              |                                   | Local file reference (if uploaded)    |
| `tags`           | `jsonb` NOT NULL, default `[]`      |                                   | Free-form tags for search             |
| `notes`          | `text`                              |                                   | Author notes                          |
| `isSuperseded`   | `boolean` NOT NULL, default `false` |                                   | Set true when a newer version exists  |
| `supersededById` | `text`                              | FK -> self                        | Points to the newer version           |
| `createdAt`      | `timestamp` NOT NULL                |                                   |                                       |
| `updatedAt`      | `timestamp` NOT NULL                |                                   |                                       |

### New table: `course.reference_link`

Bidirectional join table connecting reference docs to content items.

| Column                | Type                 | Constraints                          | Notes                                  |
| --------------------- | -------------------- | ------------------------------------ | -------------------------------------- |
| `id`                  | `text` PK            |                                      | Tier B ULID                            |
| `referenceDocumentId` | `text` NOT NULL      | FK -> `course.reference_document`    |                                        |
| `entityType`          | `text` NOT NULL      | CHECK: valid `REFERENCE_ENTITY_TYPE` | scenario, module, competency, question |
| `entityId`            | `text` NOT NULL      |                                      | The linked content item's ID           |
| `notes`               | `text`               |                                      | Why this link exists                   |
| `createdAt`           | `timestamp` NOT NULL |                                      |                                        |

Unique constraint on `(referenceDocumentId, entityType, entityId)`.

### New table: `compliance.regulatory_check`

Tracks the 90-day FAA policy check workflow.

| Column              | Type                                | Constraints              | Notes                        |
| ------------------- | ----------------------------------- | ------------------------ | ---------------------------- |
| `id`                | `text` PK                           |                          | Tier B ULID                  |
| `checkedAt`         | `timestamp` NOT NULL                |                          | When the check was performed |
| `checkedBy`         | `text` NOT NULL                     | FK -> `identity.account` | Who did it                   |
| `visitedFircPage`   | `boolean` NOT NULL, default `false` |                          | Checklist item               |
| `reviewedAcUpdates` | `boolean` NOT NULL, default `false` |                          | Checklist item               |
| `checkedCfrChanges` | `boolean` NOT NULL, default `false` |                          | Checklist item               |
| `changesFound`      | `boolean` NOT NULL                  |                          | Were any changes detected?   |
| `findings`          | `text`                              |                          | Description of what changed  |
| `taskIds`           | `jsonb` NOT NULL, default `[]`      |                          | IDs of auto-created tasks    |
| `createdAt`         | `timestamp` NOT NULL                |                          |                              |

### New constants in `libs/constants/src/reference.ts`

| Constant                         | Type        | Values                                          |
| -------------------------------- | ----------- | ----------------------------------------------- |
| `REFERENCE_DOC_TYPE`             | enum object | `AC`, `CFR`, `HANDBOOK`, `NTSB_REPORT`, `OTHER` |
| `REFERENCE_SOURCE`               | enum object | `FAA`, `NTSB`, `TSA`, `OTHER`                   |
| `REFERENCE_ENTITY_TYPE`          | enum object | `SCENARIO`, `MODULE`, `COMPETENCY`, `QUESTION`  |
| `REGULATORY_CHECK_INTERVAL_DAYS` | number      | `90`                                            |

### New routes in `libs/constants/src/routes.ts`

| Route                             | Path                                       |
| --------------------------------- | ------------------------------------------ |
| `REFERENCES`                      | `'/references'`                            |
| `REFERENCE_NEW`                   | `'/references/new'`                        |
| `REFERENCE_DETAIL`                | `(id: string) => '/references/${id}'`      |
| `REFERENCE_EDIT`                  | `(id: string) => '/references/${id}/edit'` |
| `COMPLIANCE_REGULATORY_CHECKS`    | `'/compliance/regulatory-checks'`          |
| `COMPLIANCE_REGULATORY_CHECK_NEW` | `'/compliance/regulatory-checks/new'`      |

## Behavior

### Document Store

- **CRUD:** Create, read, update, delete (soft) reference documents
- **Search:** Filter by title (text search), type, source, tag
- **Version tracking:** When a newer version is uploaded, mark the old one `isSuperseded = true` and link via `supersededById`. Both remain accessible.
- **File handling:** For Phase 6, `filePath` stores a reference to a file on disk (not a cloud URL). Actual file upload/serving is a form action writing to a configured uploads directory. No cloud storage integration.

### Reference Links

- **From content item:** On any scenario/module/competency/question edit page, a "References" section shows linked docs with an "Add Reference" dropdown
- **From reference doc:** The reference detail page shows all linked content items grouped by entity type
- **Change flagging:** When a reference document is marked as superseded, all content linked to the old version gets a task auto-created: "Review [content item] -- reference [doc] has been updated"

### Regulatory Check Workflow

- **Trigger:** The compliance dashboard shows days since last check. When > 90 days, shows a warning.
- **Checklist form:** At `/compliance/regulatory-checks/new`, a form with 3 checkboxes (visited FIRC page, reviewed AC updates, checked CFR changes) + a "changes found" toggle + findings text field
- **Task auto-creation:** If `changesFound = true`, the form prompts for a description and auto-creates a task on the task board of type `compliance` with the findings linked. Task IDs stored in the check record.
- **History:** `/compliance/regulatory-checks` shows a list of all past checks, most recent first

### Auto-Generated Tasks (PRD D4 integration)

Reference doc updates and regulatory changes both auto-create tasks. Tasks are created via `@firc/bc/platform/manage` with:

- `type: 'compliance'`
- `title`: auto-generated from context (e.g., "Review scenario SCN-001 -- AC 61-83K updated")
- `productArea: 'content'`
- `priority: 'high'`

## Validation

| Field          | Rule                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `title`        | Required, 1-200 chars                                                                         |
| `documentType` | Must be valid `REFERENCE_DOC_TYPE`                                                            |
| `source`       | Must be valid `REFERENCE_SOURCE`                                                              |
| `version`      | Optional, max 100 chars                                                                       |
| `url`          | Optional, must be valid URL if provided                                                       |
| `filePath`     | Optional. Either `url` or `filePath` should be set (not enforced at DB level, warning in UI). |
| `tags`         | Array of strings, each max 50 chars, max 20 tags                                              |
| `notes`        | Optional, max 2000 chars                                                                      |
| `entityType`   | Must be valid `REFERENCE_ENTITY_TYPE`                                                         |
| `entityId`     | Must reference an existing content item                                                       |
| `findings`     | Required when `changesFound = true`, max 5000 chars                                           |

## Edge Cases

| Case                                      | Behavior                                               |
| ----------------------------------------- | ------------------------------------------------------ |
| Reference doc deleted (soft)              | Links remain but show "(archived)" on content items    |
| Content item deleted (soft)               | Link remains but hidden from reference doc detail view |
| Duplicate link attempt                    | Rejected by unique constraint. UI shows existing link. |
| Superseded doc has no linked content      | No tasks generated (nothing to review)                 |
| Regulatory check with no changes          | Recorded normally. Resets the 90-day countdown.        |
| Multiple regulatory checks on same day    | Allowed. Each is a separate record.                    |
| Task board full (many auto-created tasks) | No limit. Author can bulk-move to done.                |

## Out of Scope

- Cloud file storage (Phase 6 uses local filesystem)
- Full-text search within uploaded PDFs
- Automatic FAA website scraping
- Email/notification for regulatory check reminders
- Reference doc versioning (only current + superseded flag, no full version history)
- Bulk import of reference documents
