import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Membership plans
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  billingCycle: text("billing_cycle").notNull(), // monthly, quarterly, annual
  downloadLimit: integer("download_limit").notNull(),
  features: jsonb("features").notNull(),
  isPopular: boolean("is_popular").default(false),
});

export const insertMembershipSchema = createInsertSchema(memberships)
  .pick({
    name: true,
    price: true,
    billingCycle: true,
    downloadLimit: true,
    features: true,
    isPopular: true,
  });

// Video categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  iconName: text("icon_name").notNull(),
  itemCount: integer("item_count").default(0),
});

export const insertCategorySchema = createInsertSchema(categories)
  .pick({
    name: true,
    slug: true,
    iconName: true,
    itemCount: true,
  });

// Videos
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  videoUrl: text("video_url").notNull(),
  previewUrl: text("preview_url").notNull(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  duration: integer("duration").notNull(), // in seconds
  resolution: text("resolution").notNull(), // 4K, HD, etc
  isLoop: boolean("is_loop").default(false),
  isPremium: boolean("is_premium").default(true),
  isNew: boolean("is_new").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  downloadCount: integer("download_count").default(0),
});

export const insertVideoSchema = createInsertSchema(videos)
  .pick({
    title: true,
    description: true,
    thumbnailUrl: true,
    videoUrl: true,
    previewUrl: true,
    categoryId: true,
    duration: true,
    resolution: true,
    isLoop: true,
    isPremium: true,
    isNew: true,
  });

// User table with role-based access
export const userRoles = {
  USER: "user",            // Regular subscriber
  ADMIN: "admin",          // Full system admin
  UPLOADER: "uploader",    // Can upload/edit videos
  REVIEWER: "reviewer",    // Can approve/reject uploads
  PROMOTER: "promoter",    // Has special promotion abilities
  ANALYTICS: "analytics",  // Can view analytics only
  MODERATOR: "moderator"   // Can moderate content/comments
} as const;

export type UserRole = typeof userRoles[keyof typeof userRoles];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default(userRoles.USER),
  membershipId: integer("membership_id").references(() => memberships.id),
  membershipStartDate: timestamp("membership_start_date"),
  membershipEndDate: timestamp("membership_end_date"),
  downloadsRemaining: integer("downloads_remaining"),
  downloadsUsed: integer("downloads_used").default(0),
  profileImageUrl: text("profile_image_url"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  lastLogin: timestamp("last_login"),
  isActive: boolean("is_active").default(true),
  apiKey: text("api_key"), // For 3rd party integrations
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    password: true,
    email: true,
  });

// Downloads
export const downloads = pgTable("downloads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  videoId: integer("video_id").notNull().references(() => videos.id),
  downloadedAt: timestamp("downloaded_at").defaultNow(),
});

export const insertDownloadSchema = createInsertSchema(downloads)
  .pick({
    userId: true,
    videoId: true,
    downloadedAt: true,
  });

// Email Marketing Tables
export const emailCampaigns = pgTable("email_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content").notNull(),
  status: text("status").notNull().default("draft"), // draft, scheduled, sending, complete
  sendRate: integer("send_rate").default(100), // emails per hour
  scheduledTime: timestamp("scheduled_time"),
  segmentOptions: jsonb("segment_options").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  sentCount: integer("sent_count").default(0),
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0)
});

export const emailSubscribers = pgTable("email_subscribers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  isSubscribed: boolean("is_subscribed").default(true),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const emailSends = pgTable("email_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => emailCampaigns.id, { onDelete: "cascade" }),
  subscriberId: integer("subscriber_id").references(() => emailSubscribers.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  status: text("status").notNull().default("pending") // pending, sent, failed, opened, clicked
});

// Cloud Library (User Favorites / "My Crate")
export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  shareToken: varchar("share_token", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const playlistItems = pgTable("playlist_items", {
  id: serial("id").primaryKey(),
  playlistId: integer("playlist_id").notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  position: integer("position").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

// Notifications and Release Calendar
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("general"), // general, new-video, membership, featured, system
  data: jsonb("data"),
  read: boolean("read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Release calendar
export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  releaseDate: timestamp("release_date", { withTimezone: true }).notNull(),
  type: text("type").notNull(), // new-video, featured, event, promotion
  imageUrl: text("image_url"),
  link: text("link"),
  videoId: integer("video_id").references(() => videos.id, { onDelete: 'set null' }),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Device registrations for notifications
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId: text("device_id").notNull(),
  name: text("name"),
  type: text("type").default("browser"), // browser, mobile, tablet
  token: text("token"),
  lastActive: timestamp("last_active", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Category subscriptions for targeted notifications
export const categorySubscriptions = pgTable("category_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: 'cascade' }),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow(),
});

// Bulk Download Tables
export const bulkDownloads = pgTable("bulk_downloads", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  totalVideos: integer("total_videos").notNull(),
  successCount: integer("success_count").default(0),
  failCount: integer("fail_count").default(0),
  zipPath: text("zip_path"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const bulkDownloadItems = pgTable("bulk_download_items", {
  id: serial("id").primaryKey(),
  bulkDownloadId: integer("bulk_download_id").notNull().references(() => bulkDownloads.id, { onDelete: 'cascade' }),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  error: text("error"),
});

// Bulk Upload Tables
export const bulkUploadSessions = pgTable("bulk_upload_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  status: text("status").notNull().default("in-progress"), // in-progress, completed, failed
  totalFiles: integer("total_files").default(0),
  processedFiles: integer("processed_files").default(0),
  successfulFiles: integer("successful_files").default(0),
  failedFiles: integer("failed_files").default(0),
  defaultCategoryId: integer("default_category_id").references(() => categories.id),
  defaultTags: jsonb("default_tags").default([]),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const bulkUploadFiles = pgTable("bulk_upload_files", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => bulkUploadSessions.id, { onDelete: 'cascade' }),
  originalFilename: text("original_filename").notNull(),
  processedFilename: text("processed_filename").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  videoId: integer("video_id").references(() => videos.id),
  metadata: jsonb("metadata").default({}),
  suggestedTags: jsonb("suggested_tags").default([]),
  errorMessage: text("error_message"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
});

// Content Rights Management & Copyright Verification
export const contentRights = pgTable("content_rights", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  rightsHolder: text("rights_holder").notNull(),
  licenseType: text("license_type").notNull(), // commercial, non-commercial, etc.
  licenseExpiration: timestamp("license_expiration"),
  verificationStatus: text("verification_status").notNull().default("pending"), // pending, verified, rejected
  verificationDate: timestamp("verification_date"),
  verifiedById: integer("verified_by_id").references(() => users.id),
  documentationUrl: text("documentation_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const copyrightClaims = pgTable("copyright_claims", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  claimantName: text("claimant_name").notNull(),
  claimantEmail: text("claimant_email").notNull(),
  reason: text("reason").notNull(),
  evidence: text("evidence").notNull(),
  status: text("status").notNull().default("pending"), // pending, reviewing, approved, rejected
  resolvedById: integer("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const contentAnalysisResults = pgTable("content_analysis_results", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  analysisType: text("analysis_type").notNull(), // copyright, content-moderation, quality
  result: jsonb("result").notNull(),
  confidence: integer("confidence"), // 0-100 score
  reviewedById: integer("reviewed_by_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// API Management
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  scopes: jsonb("scopes").default([]),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code"),
  responseTime: integer("response_time"), // in milliseconds
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// Video Tags System
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const videoTags = pgTable("video_tags", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: 'cascade' }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: 'cascade' }),
  addedById: integer("added_by_id").references(() => users.id),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
});

// Define relations
export const membershipsRelations = relations(memberships, ({ many }) => ({
  users: many(users),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
  downloads: many(downloads),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  membership: one(memberships, {
    fields: [users.membershipId],
    references: [memberships.id],
  }),
  downloads: many(downloads),
}));

export const downloadsRelations = relations(downloads, ({ one }) => ({
  user: one(users, {
    fields: [downloads.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [downloads.videoId],
    references: [videos.id],
  }),
}));

export const emailCampaignsRelations = relations(emailCampaigns, ({ many }) => ({
  sends: many(emailSends)
}));

export const emailSubscribersRelations = relations(emailSubscribers, ({ one, many }) => ({
  user: one(users, {
    fields: [emailSubscribers.userId],
    references: [users.id]
  }),
  sends: many(emailSends)
}));

export const emailSendsRelations = relations(emailSends, ({ one }) => ({
  campaign: one(emailCampaigns, {
    fields: [emailSends.campaignId],
    references: [emailCampaigns.id]
  }),
  subscriber: one(emailSubscribers, {
    fields: [emailSends.subscriberId],
    references: [emailSubscribers.id]
  })
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  video: one(videos, { fields: [favorites.videoId], references: [videos.id] }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, { fields: [playlists.userId], references: [users.id] }),
  items: many(playlistItems),
}));

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistItems.playlistId], references: [playlists.id] }),
  video: one(videos, { fields: [playlistItems.videoId], references: [videos.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const releasesRelations = relations(releases, ({ one }) => ({
  video: one(videos, { fields: [releases.videoId], references: [videos.id] }),
  category: one(categories, { fields: [releases.categoryId], references: [categories.id] }),
}));

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
}));

export const categorySubscriptionsRelations = relations(categorySubscriptions, ({ one }) => ({
  user: one(users, { fields: [categorySubscriptions.userId], references: [users.id] }),
  category: one(categories, { fields: [categorySubscriptions.categoryId], references: [categories.id] }),
}));

export const bulkDownloadsRelations = relations(bulkDownloads, ({ one, many }) => ({
  user: one(users, { fields: [bulkDownloads.userId], references: [users.id] }),
  items: many(bulkDownloadItems),
}));

export const bulkDownloadItemsRelations = relations(bulkDownloadItems, ({ one }) => ({
  bulkDownload: one(bulkDownloads, { fields: [bulkDownloadItems.bulkDownloadId], references: [bulkDownloads.id] }),
  video: one(videos, { fields: [bulkDownloadItems.videoId], references: [videos.id] }),
}));

export const bulkUploadSessionsRelations = relations(bulkUploadSessions, ({ one, many }) => ({
  user: one(users, { fields: [bulkUploadSessions.userId], references: [users.id] }),
  defaultCategory: one(categories, { fields: [bulkUploadSessions.defaultCategoryId], references: [categories.id] }),
  files: many(bulkUploadFiles),
}));

export const bulkUploadFilesRelations = relations(bulkUploadFiles, ({ one }) => ({
  session: one(bulkUploadSessions, { fields: [bulkUploadFiles.sessionId], references: [bulkUploadSessions.id] }),
  video: one(videos, { fields: [bulkUploadFiles.videoId], references: [videos.id] }),
}));

export const contentRightsRelations = relations(contentRights, ({ one }) => ({
  video: one(videos, { fields: [contentRights.videoId], references: [videos.id] }),
  verifiedBy: one(users, { fields: [contentRights.verifiedById], references: [users.id] }),
}));

export const copyrightClaimsRelations = relations(copyrightClaims, ({ one }) => ({
  video: one(videos, { fields: [copyrightClaims.videoId], references: [videos.id] }),
  resolvedBy: one(users, { fields: [copyrightClaims.resolvedById], references: [users.id] }),
}));

export const contentAnalysisResultsRelations = relations(contentAnalysisResults, ({ one }) => ({
  video: one(videos, { fields: [contentAnalysisResults.videoId], references: [videos.id] }),
  reviewedBy: one(users, { fields: [contentAnalysisResults.reviewedById], references: [users.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  usageLogs: many(apiUsage),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  apiKey: one(apiKeys, { fields: [apiUsage.apiKeyId], references: [apiKeys.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  category: one(categories, { fields: [tags.categoryId], references: [categories.id] }),
  videoTags: many(videoTags),
}));

export const videoTagsRelations = relations(videoTags, ({ one }) => ({
  video: one(videos, { fields: [videoTags.videoId], references: [videos.id] }),
  tag: one(tags, { fields: [videoTags.tagId], references: [tags.id] }),
  addedBy: one(users, { fields: [videoTags.addedById], references: [users.id] }),
}));

// Create schemas for inserting data
// (Already defined above for memberships, categories, videos, users, and downloads)

// Export types
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Video = typeof videos.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Download = typeof downloads.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;

// Create insert schemas for the remaining tables
const insertEmailCampaignSchema = createInsertSchema(emailCampaigns);
const insertEmailSubscriberSchema = createInsertSchema(emailSubscribers);
const insertEmailSendSchema = createInsertSchema(emailSends);
const insertFavoriteSchema = createInsertSchema(favorites);
const insertPlaylistSchema = createInsertSchema(playlists);
const insertPlaylistItemSchema = createInsertSchema(playlistItems);
const insertNotificationSchema = createInsertSchema(notifications);
const insertReleaseSchema = createInsertSchema(releases);
const insertDeviceSchema = createInsertSchema(devices);
const insertCategorySubscriptionSchema = createInsertSchema(categorySubscriptions);
const insertBulkDownloadSchema = createInsertSchema(bulkDownloads);
const insertBulkDownloadItemSchema = createInsertSchema(bulkDownloadItems);
const insertBulkUploadSessionSchema = createInsertSchema(bulkUploadSessions);
const insertBulkUploadFileSchema = createInsertSchema(bulkUploadFiles);
const insertContentRightsSchema = createInsertSchema(contentRights);
const insertCopyrightClaimSchema = createInsertSchema(copyrightClaims);
const insertContentAnalysisResultSchema = createInsertSchema(contentAnalysisResults);
const insertApiKeySchema = createInsertSchema(apiKeys);
const insertApiUsageSchema = createInsertSchema(apiUsage);
const insertTagSchema = createInsertSchema(tags);
const insertVideoTagSchema = createInsertSchema(videoTags);

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;

export type EmailSubscriber = typeof emailSubscribers.$inferSelect;
export type InsertEmailSubscriber = z.infer<typeof insertEmailSubscriberSchema>;

export type EmailSend = typeof emailSends.$inferSelect;
export type InsertEmailSend = z.infer<typeof insertEmailSendSchema>;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;

export type Playlist = typeof playlists.$inferSelect;
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;

export type PlaylistItem = typeof playlistItems.$inferSelect;
export type InsertPlaylistItem = z.infer<typeof insertPlaylistItemSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Release = typeof releases.$inferSelect;
export type InsertRelease = z.infer<typeof insertReleaseSchema>;

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;

export type CategorySubscription = typeof categorySubscriptions.$inferSelect;
export type InsertCategorySubscription = z.infer<typeof insertCategorySubscriptionSchema>;

export type BulkDownload = typeof bulkDownloads.$inferSelect;
export type InsertBulkDownload = z.infer<typeof insertBulkDownloadSchema>;

export type BulkDownloadItem = typeof bulkDownloadItems.$inferSelect;
export type InsertBulkDownloadItem = z.infer<typeof insertBulkDownloadItemSchema>;

export type BulkUploadSession = typeof bulkUploadSessions.$inferSelect;
export type InsertBulkUploadSession = z.infer<typeof insertBulkUploadSessionSchema>;

export type BulkUploadFile = typeof bulkUploadFiles.$inferSelect;
export type InsertBulkUploadFile = z.infer<typeof insertBulkUploadFileSchema>;

export type ContentRights = typeof contentRights.$inferSelect;
export type InsertContentRights = z.infer<typeof insertContentRightsSchema>;

export type CopyrightClaim = typeof copyrightClaims.$inferSelect;
export type InsertCopyrightClaim = z.infer<typeof insertCopyrightClaimSchema>;

export type ContentAnalysisResult = typeof contentAnalysisResults.$inferSelect;
export type InsertContentAnalysisResult = z.infer<typeof insertContentAnalysisResultSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type ApiUsage = typeof apiUsage.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type VideoTag = typeof videoTags.$inferSelect;
export type InsertVideoTag = z.infer<typeof insertVideoTagSchema>;