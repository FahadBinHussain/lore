import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  integer, 
  boolean, 
  jsonb, 
  decimal, 
  pgEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== ENUMS ====================

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);

export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv', 'game', 'book']);

export const watchStatusEnum = pgEnum('watch_status', [
  'not_started', 
  'in_progress', 
  'completed', 
  'dropped', 
  'on_hold'
]);

export const listVisibilityEnum = pgEnum('list_visibility', ['public', 'private', 'unlisted']);

// ==================== USERS ====================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  role: userRoleEnum('role').default('user').notNull(),
  emailVerified: timestamp('email_verified'),
  bio: text('bio'),
  username: varchar('username', { length: 50 }).unique(),
  isActive: boolean('is_active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_username_idx').on(table.username),
  index('users_role_idx').on(table.role),
]);

// ==================== NEXTAUTH TABLES ====================

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  idToken: text('id_token'),
  sessionState: varchar('session_state', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('accounts_provider_providerAccountId_idx').on(table.provider, table.providerAccountId),
  index('accounts_userId_idx').on(table.userId),
]);

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('sessions_userId_idx').on(table.userId),
  index('sessions_sessionToken_idx').on(table.sessionToken),
]);

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  expires: timestamp('expires').notNull(),
}, (table) => [
  uniqueIndex('verification_tokens_identifier_token_idx').on(table.identifier, table.token),
]);

// ==================== MEDIA ITEMS ====================

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
  voteCount: integer('vote_count').default(0),
  genres: jsonb('genres').$type<string[]>(),
  runtime: integer('runtime'),
  pageCount: integer('page_count'),
  developer: varchar('developer', { length: 255 }),
  publisher: varchar('publisher', { length: 255 }),
  author: varchar('author', { length: 255 }),
  isbn: varchar('isbn', { length: 20 }),
  platforms: jsonb('platforms').$type<string[]>(),
  networks: jsonb('networks').$type<string[]>(),
  seasons: integer('seasons'),
  episodes: integer('episodes'),
  status: varchar('status', { length: 50 }),
  tagline: text('tagline'),
  popularity: decimal('popularity', { precision: 10, scale: 2 }),
  additionalData: jsonb('additional_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('media_items_externalId_mediaType_idx').on(table.externalId, table.mediaType),
  index('media_items_mediaType_idx').on(table.mediaType),
  index('media_items_title_idx').on(table.title),
  index('media_items_rating_idx').on(table.rating),
  index('media_items_releaseDate_idx').on(table.releaseDate),
]);

// ==================== USER MEDIA PROGRESS ====================

export const userMediaProgress = pgTable('user_media_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  status: watchStatusEnum('status').default('not_started').notNull(),
  progress: integer('progress').default(0),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0'),
  rating: integer('rating'),
  review: text('review'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  lastActivityAt: timestamp('last_activity_at'),
  notes: text('notes'),
  tags: jsonb('tags').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_media_progress_userId_mediaItemId_idx').on(table.userId, table.mediaItemId),
  index('user_media_progress_userId_idx').on(table.userId),
  index('user_media_progress_mediaItemId_idx').on(table.mediaItemId),
  index('user_media_progress_status_idx').on(table.status),
  index('user_media_progress_rating_idx').on(table.rating),
  index('user_media_progress_isFavorite_idx').on(table.isFavorite),
]);

// ==================== LISTS ====================

export const lists = pgTable('lists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  visibility: listVisibilityEnum('visibility').default('public').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  sortOrder: integer('sort_order').default(0),
  itemCount: integer('item_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('lists_userId_idx').on(table.userId),
  index('lists_visibility_idx').on(table.visibility),
]);

export const listItems = pgTable('list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').references(() => lists.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('list_items_listId_mediaItemId_idx').on(table.listId, table.mediaItemId),
  index('list_items_listId_idx').on(table.listId),
]);

// ==================== COLLECTIONS (UNIVERSES) ====================

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  coverImage: text('cover_image'),
  bannerImage: text('banner_image'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  visibility: listVisibilityEnum('visibility').default('public').notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  viewCount: integer('view_count').default(0),
  itemCount: integer('item_count').default(0),
  followerCount: integer('follower_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('collections_createdBy_idx').on(table.createdBy),
  index('collections_visibility_idx').on(table.visibility),
  index('collections_isFeatured_idx').on(table.isFeatured),
  index('collections_slug_idx').on(table.slug),
]);

export const collectionItems = pgTable('collection_items', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  isRequired: boolean('is_required').default(true).notNull(),
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('collection_items_collectionId_mediaItemId_idx').on(table.collectionId, table.mediaItemId),
  index('collection_items_collectionId_idx').on(table.collectionId),
]);

export const collectionFollowers = pgTable('collection_followers', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  followedAt: timestamp('followed_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('collection_followers_collectionId_userId_idx').on(table.collectionId, table.userId),
]);

// ==================== USER COLLECTION PROGRESS ====================

export const userCollectionProgress = pgTable('user_collection_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  collectionId: integer('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  itemsCompleted: integer('items_completed').default(0).notNull(),
  itemsTotal: integer('items_total').default(0).notNull(),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0'),
  isCompleted: boolean('is_completed').default(false).notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_collection_progress_userId_collectionId_idx').on(table.userId, table.collectionId),
  index('user_collection_progress_userId_idx').on(table.userId),
]);

// ==================== REVIEWS ====================

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull(),
  title: varchar('title', { length: 255 }),
  content: text('content'),
  containsSpoilers: boolean('contains_spoilers').default(false).notNull(),
  isRecommended: boolean('is_recommended'),
  helpfulCount: integer('helpful_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('reviews_userId_mediaItemId_idx').on(table.userId, table.mediaItemId),
  index('reviews_mediaItemId_idx').on(table.mediaItemId),
  index('reviews_rating_idx').on(table.rating),
]);

// ==================== ACTIVITY LOG ====================

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId: integer('entity_id'),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('activity_log_userId_idx').on(table.userId),
  index('activity_log_action_idx').on(table.action),
  index('activity_log_entityType_entityId_idx').on(table.entityType, table.entityId),
  index('activity_log_createdAt_idx').on(table.createdAt),
]);

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  mediaProgress: many(userMediaProgress),
  lists: many(lists),
  reviews: many(reviews),
  collections: many(collections),
  collectionProgress: many(userCollectionProgress),
  followedCollections: many(collectionFollowers),
  activityLogs: many(activityLog),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const mediaItemsRelations = relations(mediaItems, ({ many }) => ({
  collectionItems: many(collectionItems),
  listItems: many(listItems),
  mediaProgress: many(userMediaProgress),
  reviews: many(reviews),
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  user: one(users, {
    fields: [lists.userId],
    references: [users.id],
  }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, {
    fields: [listItems.listId],
    references: [lists.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [listItems.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  creator: one(users, {
    fields: [collections.createdBy],
    references: [users.id],
  }),
  items: many(collectionItems),
  followers: many(collectionFollowers),
  collectionProgress: many(userCollectionProgress),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [collectionItems.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const collectionFollowersRelations = relations(collectionFollowers, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionFollowers.collectionId],
    references: [collections.id],
  }),
  user: one(users, {
    fields: [collectionFollowers.userId],
    references: [users.id],
  }),
}));

export const userMediaProgressRelations = relations(userMediaProgress, ({ one }) => ({
  user: one(users, {
    fields: [userMediaProgress.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [userMediaProgress.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const userCollectionProgressRelations = relations(userCollectionProgress, ({ one }) => ({
  user: one(users, {
    fields: [userCollectionProgress.userId],
    references: [users.id],
  }),
  collection: one(collections, {
    fields: [userCollectionProgress.collectionId],
    references: [collections.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [reviews.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, {
    fields: [activityLog.userId],
    references: [users.id],
  }),
}));