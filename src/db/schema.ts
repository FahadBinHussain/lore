import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  date,
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

// Updated to include Anime/Manga for better categorization logic
export const mediaTypeEnum = pgEnum('media_type', [
  'movie', 
  'tv', 
  'anime', 
  'manga', 
  'game', 
  'book', 
  'comic', 
  'boardgame', 
  'soundtrack', 
  'podcast', 
  'themepark'
]);

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
]);

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

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
  // UNIQUE IDENTIFIER: External ID + Source (e.g., '123' from 'tmdb')
  externalId: varchar('external_id', { length: 255 }).notNull(),
  source: varchar('source', { length: 50 }).notNull(), // 'tmdb', 'anilist', 'igdb', 'openlibrary', 'manual'
  mediaType: mediaTypeEnum('media_type').notNull(),
  
  title: varchar('title', { length: 500 }).notNull(),
  originalTitle: varchar('original_title', { length: 500 }),
  description: text('description'),
  posterPath: text('poster_path'),
  backdropPath: text('backdrop_path'),
  
  // Use date() for release dates to avoid timezone shifts
  releaseDate: date('release_date'), 
  
  rating: decimal('rating', { precision: 3, scale: 1 }),
  voteCount: integer('vote_count').default(0),
  genres: jsonb('genres').$type<string[]>(),
  
  // Media-specific metadata
  runtime: integer('runtime'), // Minutes
  pageCount: integer('page_count'),
  developer: varchar('developer', { length: 255 }),
  publisher: varchar('publisher', { length: 255 }),
  author: varchar('author', { length: 255 }),
  isbn: varchar('isbn', { length: 20 }),
  platforms: jsonb('platforms').$type<string[]>(),
  networks: jsonb('networks').$type<string[]>(),
  
  // Episodes/Seasons (Great for Anime/TV tracking)
  seasons: integer('seasons'),
  totalEpisodes: integer('total_episodes'),
  
  status: varchar('status', { length: 50 }), // 'released', 'upcoming', 'cancelled'
  isPlaceholder: boolean('is_placeholder').default(false).notNull(), // For AI-suggested future items
  
  tagline: text('tagline'),
  popularity: decimal('popularity', { precision: 10, scale: 2 }),
  additionalData: jsonb('additional_data'), // Catch-all for theme park coordinates, ride height requirements, etc.
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('media_items_external_source_idx').on(table.externalId, table.source),
  index('media_items_mediaType_idx').on(table.mediaType),
  index('media_items_title_idx').on(table.title),
  index('media_items_releaseDate_idx').on(table.releaseDate),
]);

// ==================== USER MEDIA PROGRESS ====================

export const userMediaProgress = pgTable('user_media_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  
  status: watchStatusEnum('status').default('not_started').notNull(),
  
  // Granular Tracking (Perfect for TV/Anime/Books)
  currentProgress: integer('current_progress').default(0), // Episode number or Page number
  currentSeason: integer('current_season').default(1),
  progressPercentage: decimal('progress_percentage', { precision: 5, scale: 2 }).default('0'),
  
  rating: integer('rating'), // User's personal score (1-10)
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
  index('user_media_progress_status_idx').on(table.status),
]);

// ==================== LISTS (USER PERSONAL) ====================

export const lists = pgTable('lists', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  visibility: listVisibilityEnum('visibility').default('public').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  itemCount: integer('item_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const listItems = pgTable('list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').references(() => lists.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('list_items_listId_mediaItemId_idx').on(table.listId, table.mediaItemId),
]);

// ==================== COLLECTIONS (THE UNIVERSES) ====================

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "Despicable Me"
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
  index('collections_slug_idx').on(table.slug),
]);

export const collectionItems = pgTable('collection_items', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  mediaItemId: integer('media_item_id').references(() => mediaItems.id, { onDelete: 'cascade' }).notNull(),
  
  // UNIVERSE TIMELINE FEATURES
  releaseOrder: integer('release_order').default(0).notNull(), // Order by year
  chronologicalOrder: integer('chronological_order'), // Order by story timeline
  groupName: varchar('group_name', { length: 255 }), // e.g., "Phase 1", "Prequels", "Shorts"
  
  isRequired: boolean('is_required').default(true).notNull(), // If false, it's "Spin-off/Optional"
  notes: text('notes'),
  addedAt: timestamp('added_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('collection_items_uniq_idx').on(table.collectionId, table.mediaItemId),
]);

export const collectionFollowers = pgTable('collection_followers', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').references(() => collections.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  followedAt: timestamp('followed_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('coll_followers_idx').on(table.collectionId, table.userId),
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
  uniqueIndex('user_coll_progress_idx').on(table.userId, table.collectionId),
]);

// ==================== ACTIVITY LOG ====================

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 100 }).notNull(), // 'completed_movie', 'followed_universe'
  entityType: varchar('entity_type', { length: 50 }),
  entityId: integer('entity_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  mediaProgress: many(userMediaProgress),
  collections: many(collections),
  collectionProgress: many(userCollectionProgress),
}));

export const mediaItemsRelations = relations(mediaItems, ({ many }) => ({
  collectionItems: many(collectionItems),
  mediaProgress: many(userMediaProgress),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  items: many(collectionItems),
  collectionProgress: many(userCollectionProgress),
  creator: one(users, { fields: [collections.createdBy], references: [users.id] }),
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

export const userMediaProgressRelations = relations(userMediaProgress, ({ one }) => ({
  user: one(users, { fields: [userMediaProgress.userId], references: [users.id] }),
  mediaItem: one(mediaItems, { fields: [userMediaProgress.mediaItemId], references: [mediaItems.id] }),
}));