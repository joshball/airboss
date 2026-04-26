---
title: "Design: Reference Library & Regulatory Monitoring"
product: hangar
feature: reference-library
type: design
status: done
---

# Design: Reference Library & Regulatory Monitoring

## Route Files

```text
apps/hangar/src/routes/(app)/
  references/
    +page.svelte              -- document list with search/filter
    +page.server.ts           -- load documents, search action
    new/
      +page.svelte            -- create form with file upload
      +page.server.ts         -- create action
    [id]/
      +page.svelte            -- detail view with linked content
      +page.server.ts         -- load doc + links
      edit/
        +page.svelte          -- edit form
        +page.server.ts       -- update + delete + supersede actions
  compliance/
    regulatory-checks/
      +page.svelte            -- check history list
      +page.server.ts         -- load checks
      new/
        +page.svelte          -- checklist form
        +page.server.ts       -- create action + task auto-creation
```

## Schema (Drizzle)

```typescript
// libs/db/src/schema/course.ts (additions)

export const referenceDocument = courseSchema.table("reference_document", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  documentType: text("document_type").notNull(),
  source: text("source").notNull(),
  version: text("version"),
  url: text("url"),
  filePath: text("file_path"),
  tags: jsonb("tags").notNull().default([]),
  notes: text("notes"),
  isSuperseded: boolean("is_superseded").notNull().default(false),
  supersededById: text("superseded_by_id").references(() => referenceDocument.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const referenceLink = courseSchema.table(
  "reference_link",
  {
    id: text("id").primaryKey(),
    referenceDocumentId: text("reference_document_id")
      .notNull()
      .references(() => referenceDocument.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueLink: unique().on(table.referenceDocumentId, table.entityType, table.entityId),
  }),
);
```

```typescript
// libs/db/src/schema/compliance.ts (additions)

export const regulatoryCheck = complianceSchema.table("regulatory_check", {
  id: text("id").primaryKey(),
  checkedAt: timestamp("checked_at").notNull(),
  checkedBy: text("checked_by")
    .notNull()
    .references(() => account.id),
  visitedFircPage: boolean("visited_firc_page").notNull().default(false),
  reviewedAcUpdates: boolean("reviewed_ac_updates").notNull().default(false),
  checkedCfrChanges: boolean("checked_cfr_changes").notNull().default(false),
  changesFound: boolean("changes_found").notNull(),
  findings: text("findings"),
  taskIds: jsonb("task_ids").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

## BC Layer

### Reference documents -- `libs/bc/course/src/manage.ts`

```typescript
export async function createReferenceDoc(db: DB, doc: NewReferenceDocument): Promise<ReferenceDocument>;
export async function updateReferenceDoc(db: DB, id: string, updates: Partial<ReferenceDocument>): Promise<void>;
export async function deleteReferenceDoc(db: DB, id: string): Promise<void>; // soft delete
export async function markSuperseded(db: DB, oldId: string, newId: string): Promise<{ tasksCreated: number }>;
```

`markSuperseded` sets `isSuperseded = true`, `supersededById = newId`, then queries all `reference_link` rows for `oldId` and creates a compliance task for each linked entity.

### Reference documents -- `libs/bc/course/src/read.ts`

```typescript
export async function getReferenceDocuments(db: DB, filters?: ReferenceDocFilters): Promise<ReferenceDocument[]>;
export async function getReferenceDocById(db: DB, id: string): Promise<ReferenceDocument | null>;
export async function getLinksForDocument(db: DB, docId: string): Promise<ReferenceLink[]>;
export async function getLinksForEntity(db: DB, entityType: string, entityId: string): Promise<ReferenceLink[]>;
```

### Regulatory checks -- `libs/bc/compliance/src/manage.ts`

```typescript
export async function createRegulatoryCheck(db: DB, check: NewRegulatoryCheck): Promise<RegulatoryCheck>;
```

If `changesFound`, this function calls `createTask` from `@firc/bc/platform/manage` and stores the returned task IDs.

### Regulatory checks -- `libs/bc/compliance/src/read.ts`

```typescript
export async function getRegulatoryChecks(db: DB): Promise<RegulatoryCheck[]>;
export async function getLastRegulatoryCheck(db: DB): Promise<RegulatoryCheck | null>;
export async function getDaysSinceLastCheck(db: DB): Promise<number | null>; // null = never checked
```

## File Upload

Simple form-based upload. Files stored in `data/uploads/references/` on the local filesystem. The `filePath` column stores the relative path within this directory. A static file serving route in hangar serves the file.

No cloud storage, no S3, no CDN. Local-only for Phase 6.

```typescript
// In the create/edit action:
const file = formData.get("file") as File;
if (file && file.size > 0) {
  const filename = `${generateId("ref")}_${file.name}`;
  const path = `data/uploads/references/${filename}`;
  await Bun.write(path, file);
  // Store path in DB
}
```

Max file size: 50 MB (configurable constant).

## Reference Section on Content Pages

A reusable Svelte component that shows linked references and allows adding/removing links.

```svelte
<!-- libs/ui/src/ReferenceLinks.svelte -->
<script lang="ts">
  let { entityType, entityId, links, allDocuments } = $props();
</script>

<section class="reference-links">
  <h3>References</h3>
  {#each links as link}
    <div class="link-row">
      <a href={ROUTES.REFERENCE_DETAIL(link.referenceDocumentId)}>{link.title}</a>
      <form method="POST" action="?/removeReference">
        <input type="hidden" name="linkId" value={link.id} />
        <button type="submit">Remove</button>
      </form>
    </div>
  {/each}
  <form method="POST" action="?/addReference">
    <select name="referenceDocumentId">
      {#each allDocuments as doc}
        <option value={doc.id}>{doc.title}</option>
      {/each}
    </select>
    <button type="submit">Add</button>
  </form>
</section>
```

Each content edit page adds `addReference` and `removeReference` form actions.

## Key Decisions

**Why local file storage:** Cloud storage adds deployment complexity. This is a small-team tool with < 100 documents. Local files are simple and sufficient. Can migrate to S3 later by changing the upload handler and adding a serving proxy.

**Why soft delete for references:** Documents may be linked to content. Hard delete would break links. Soft delete keeps the record for audit while hiding it from active views.

**Why auto-create tasks on supersede:** The whole point of linking references to content is knowing what to review when things change. Manual "go check everything" is error-prone. Auto-created tasks ensure nothing is missed.

**Why a checklist for regulatory checks:** AC 61-83K Appendix A specifies what to check. A structured checklist ensures the check is thorough and creates an audit trail. Free-form notes alone would be insufficient for compliance evidence.
