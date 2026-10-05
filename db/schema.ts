import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), internalName: text('internal_name').notNull(),
  title: text('title').notNull(), source: text('source').notNull(),
  status: text('status').notNull().default('draft'), links: text('links').notNull().default('{}'),
  demo: integer('demo').notNull().default(0), revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const qrCodes = sqliteTable('qr_codes', {
  token: text('token').primaryKey(), label: text('label').notNull().unique(), batchId: text('batch_id').notNull(),
  jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  assignedAt: text('assigned_at'), createdAt: text('created_at').notNull(),
}, t => [index('idx_qr_job').on(t.jobId), index('idx_qr_batch').on(t.batchId)]);
export const customerLinks = sqliteTable('customer_links', {
  jobId: text('job_id').primaryKey().references(() => jobs.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(), createdAt: text('created_at').notNull(),
});
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  objectKey: text('object_key').notNull(), label: text('label').notNull(),
  kind: text('kind').notNull(), position: integer('position').notNull(), mime: text('mime').notNull(),
}, t => [index('idx_photos_job').on(t.jobId)]);
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), platform: text('platform'), createdAt: text('created_at').notNull(),
}, t => [index('idx_events_job_type').on(t.jobId, t.type)]);
export const counters = sqliteTable('counters', { name: text('name').primaryKey(), value: integer('value').notNull() });
export const limits = sqliteTable('limits', { key: text('key').primaryKey(), count: integer('count').notNull() });
