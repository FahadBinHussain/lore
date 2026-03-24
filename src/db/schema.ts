import { pgTable, serial, varchar, text, timestamp, integer, boolean, jsonb, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv', 'game', 'book']);
export const watchStatusEnum = pgEnum('watch_status', ['not_started', 'in_progress', 'completed', 'dropped']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mediaItems = pgTable('media_items', {
  id: serial('id').primaryKey(),
  externalId: varchar('external_id', { length: 255 }).notNull(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  originalTitle: varchar('original_title', { length: 500 }),
  description: text('description'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  releaseDate: timestamp('release_date'),
  rating: decimal('rating', { precision: 3, scale: 1 }),
  genres: jsonb('genres').$type<string[]>(),
  runtime: integer('runtime'),
  pageCount: integer('page_count'),
  developer: varchar('developer', { length: 255 }),
  author: varchar('author', { length: 255 }),
  additionalData: jsonb('additional_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const universes = pgTable('universes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const universeItems = pgTable('universe_items', {
  id: serial('id').primaryKey(),
  universeId: integer('universe_id').references(() => universes.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').notNull(),
  isRequired: boolean('is_required').default(true).notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

export const userProgress = pgTable('user_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  status: watchStatusEnum('status').default('not_started').notNull(),
  progress: integer('progress').default(0),
  rating: integer('rating'),
  review: text('review'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserMedia: { unique: ['userId', 'mediaItemId'] },
}));

export const userUniverseProgress = pgTable('user_universe_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  universeId: integer('universe_id').references(() => universes.id, { onDelete: 'cascade' }).notNull(),
  itemsCompleted: integer('items_completed').default(0).notNull(),
  itemsTotal: integer('items_total').default(0).notNull(),
  isCompleted: boolean('is_completed').default(false).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  uniqueUserUniverse: { unique: ['userId', 'universeId'] },
}));

export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  universeProgress: many(userUniverseProgress),
  universes: many(universes),
}));

export const mediaItemsRelations = relations(mediaItems, ({ many }) => ({
  universeItems: many(universeItems),
  userProgress: many(userProgress),
}));

export const universesRelations = relations(universes, ({ one, many }) => ({
  creator: one(users, {
    fields: [universes.createdBy],
    references: [users.id],
  }),
  items: many(universeItems),
  userProgress: many(userUniverseProgress),
}));

export const universeItemsRelations = relations(universeItems, ({ one }) => ({
  universe: one(universes, {
    fields: [universeItems.universeId],
    references: [universes.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [universeItems.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [userProgress.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const userUniverseProgressRelations = relations(userUniverseProgress, ({ one }) => ({
  user: one(users, {
    fields: [userUniverseProgress.userId],
    references: [users.id],
  }),
  universe: one(universes, {
    fields: [userUniverseProgress.universeId],
    references: [universes.id],
  }),
}));
