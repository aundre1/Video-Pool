import { 
  users, 
  memberships, 
  categories, 
  videos, 
  downloads, 
  type User, 
  type InsertUser, 
  type Membership, 
  type InsertMembership,
  type Category,
  type InsertCategory,
  type Video,
  type InsertVideo,
  type Download,
  type InsertDownload
} from "@shared/schema";
import { db } from "./db";
import { eq, like, and, desc, asc, sql, count } from "drizzle-orm";
import { IStorage } from "./storage";

// Database storage implementation
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      eq(users.username, username)
    );
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      eq(users.email, email)
    );
    return user;
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    
    return result.length > 0;
  }
  
  async getAllUsers(filter?: { searchTerm?: string, membershipId?: number, page?: number, limit?: number }): Promise<{ users: User[], total: number }> {
    // Build the query conditions
    let conditions = [];
    
    if (filter?.searchTerm) {
      const searchTerm = `%${filter.searchTerm}%`;
      conditions.push(
        sql`(${users.username} LIKE ${searchTerm} OR ${users.email} LIKE ${searchTerm})`
      );
    }
    
    if (filter?.membershipId !== undefined) {
      if (filter.membershipId === 0) {
        // Free users (no membership)
        conditions.push(sql`${users.membershipId} IS NULL`);
      } else {
        // Users with specific membership
        conditions.push(eq(users.membershipId, filter.membershipId));
      }
    }
    
    // Count total matching users
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(users)
      .where(conditions.length ? and(...conditions) : undefined);
    
    // Get the users with pagination
    let query = db.select().from(users).where(conditions.length ? and(...conditions) : undefined);
    
    let usersList: User[];
    if (filter?.page && filter?.limit) {
      const offset = (filter.page - 1) * filter.limit;
      usersList = await query.limit(filter.limit).offset(offset);
    } else {
      usersList = await query;
    }
    
    return { users: usersList, total: Number(total) };
  }
  
  // Membership methods
  async getMembership(id: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.id, id));
    return membership;
  }
  
  async getAllMemberships(): Promise<Membership[]> {
    return db.select().from(memberships);
  }
  
  async createMembership(membershipData: InsertMembership): Promise<Membership> {
    const [membership] = await db.insert(memberships).values(membershipData).returning();
    return membership;
  }
  
  async updateMembership(id: number, membershipData: Partial<Membership>): Promise<Membership | undefined> {
    const [updatedMembership] = await db
      .update(memberships)
      .set(membershipData)
      .where(eq(memberships.id, id))
      .returning();
    
    return updatedMembership;
  }
  
  async deleteMembership(id: number): Promise<boolean> {
    const result = await db
      .delete(memberships)
      .where(eq(memberships.id, id))
      .returning({ id: memberships.id });
    
    return result.length > 0;
  }
  
  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }
  
  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }
  
  async getAllCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }
  
  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(categoryData).returning();
    return category;
  }
  
  async updateCategory(id: number, categoryData: Partial<Category>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    
    return updatedCategory;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning({ id: categories.id });
    
    return result.length > 0;
  }
  
  // Video methods
  async getVideo(id: number): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }
  
  async getAllVideos(filter?: { searchTerm?: string, categoryId?: number, isPremium?: boolean, isLoop?: boolean, sortBy?: string, page?: number, limit?: number }): Promise<{ videos: Video[], total: number }> {
    // Build the query conditions
    let conditions = [];
    
    if (filter?.searchTerm) {
      const searchTerm = `%${filter.searchTerm}%`;
      conditions.push(
        sql`(${videos.title} LIKE ${searchTerm} OR ${videos.description} LIKE ${searchTerm})`
      );
    }
    
    if (filter?.categoryId !== undefined) {
      conditions.push(eq(videos.categoryId, filter.categoryId));
    }
    
    if (filter?.isPremium !== undefined) {
      conditions.push(eq(videos.isPremium, filter.isPremium));
    }
    
    if (filter?.isLoop !== undefined) {
      conditions.push(eq(videos.isLoop, filter.isLoop));
    }
    
    // Count total matching videos
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(videos)
      .where(conditions.length ? and(...conditions) : undefined);
    
    // Build the query with sorting and pagination
    let query = db.select().from(videos).where(conditions.length ? and(...conditions) : undefined);
    
    // Build the final query based on sorting and pagination
    let finalQuery = query;
    
    // Apply sorting
    if (filter?.sortBy) {
      switch (filter.sortBy) {
        case 'newest':
          finalQuery = query.orderBy(desc(videos.createdAt));
          break;
        case 'oldest':
          finalQuery = query.orderBy(asc(videos.createdAt));
          break;
        case 'popular':
          finalQuery = query.orderBy(desc(videos.downloadCount));
          break;
        case 'title':
          finalQuery = query.orderBy(asc(videos.title));
          break;
      }
    }
    
    // Apply pagination
    let videosList: Video[];
    if (filter?.page && filter?.limit) {
      const offset = (filter.page - 1) * filter.limit;
      videosList = await finalQuery.limit(filter.limit).offset(offset);
    } else {
      videosList = await finalQuery;
    }
    
    return { videos: videosList, total: Number(total) };
  }
  
  async getFeaturedVideos(filter?: { type?: string, limit?: number }): Promise<Video[]> {
    let baseQuery = db.select().from(videos);
    
    // Apply filters with different query objects for each condition
    let finalQuery;
    if (filter?.type === 'new') {
      finalQuery = baseQuery.where(eq(videos.isNew, true));
    } else if (filter?.type === 'trending' || filter?.type === 'popular') {
      finalQuery = baseQuery.orderBy(desc(videos.downloadCount));
    } else {
      finalQuery = baseQuery;
    }
    
    // Apply limit
    let resultQuery;
    if (filter?.limit) {
      resultQuery = await finalQuery.limit(filter.limit);
    } else {
      resultQuery = await finalQuery;
    }
    
    return resultQuery;
  }
  
  async getVideosByCategory(categoryId: number, page?: number, limit?: number): Promise<{ videos: Video[], total: number }> {
    // Count total videos in this category
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(videos)
      .where(eq(videos.categoryId, categoryId));
    
    // Get videos with pagination
    let baseQuery = db.select().from(videos).where(eq(videos.categoryId, categoryId));
    
    let videosList: Video[];
    if (page && limit) {
      const offset = (page - 1) * limit;
      videosList = await baseQuery.limit(limit).offset(offset);
    } else {
      videosList = await baseQuery;
    }
    
    return { videos: videosList, total: Number(total) };
  }
  
  async createVideo(videoData: InsertVideo): Promise<Video> {
    const [video] = await db.insert(videos).values({
      ...videoData,
      downloadCount: 0,
      createdAt: new Date()
    }).returning();
    
    // Update category item count
    await this.incrementCategoryItemCount(video.categoryId);
    
    return video;
  }
  
  async updateVideo(id: number, videoData: Partial<Video>): Promise<Video | undefined> {
    const oldVideo = await this.getVideo(id);
    if (!oldVideo) return undefined;
    
    const [updatedVideo] = await db
      .update(videos)
      .set(videoData)
      .where(eq(videos.id, id))
      .returning();
    
    // If category changed, update item counts
    if (videoData.categoryId && videoData.categoryId !== oldVideo.categoryId) {
      await this.decrementCategoryItemCount(oldVideo.categoryId);
      await this.incrementCategoryItemCount(videoData.categoryId);
    }
    
    return updatedVideo;
  }
  
  async deleteVideo(id: number): Promise<boolean> {
    const video = await this.getVideo(id);
    if (!video) return false;
    
    const result = await db
      .delete(videos)
      .where(eq(videos.id, id))
      .returning({ id: videos.id });
    
    // Update category item count
    if (result.length > 0) {
      await this.decrementCategoryItemCount(video.categoryId);
      return true;
    }
    
    return false;
  }
  
  async incrementVideoDownloadCount(id: number): Promise<void> {
    await db
      .update(videos)
      .set({ downloadCount: sql`${videos.downloadCount} + 1` })
      .where(eq(videos.id, id));
  }
  
  // Batch video operations
  async batchDeleteVideos(videoIds: number[]): Promise<{ success: boolean, deletedCount: number }> {
    try {
      // First get all videos to manage category counts
      const videosToDelete = await db
        .select()
        .from(videos)
        .where(sql`${videos.id} IN (${videoIds.join(',')})`);
      
      // Extract unique category IDs to update counts
      const categoryIds = [...new Set(videosToDelete.map(v => v.categoryId))];
      
      // Delete videos
      const result = await db
        .delete(videos)
        .where(sql`${videos.id} IN (${videoIds.join(',')})`)
        .returning({ id: videos.id });
      
      // Update category counts
      for (const categoryId of categoryIds) {
        const count = videosToDelete.filter(v => v.categoryId === categoryId).length;
        await db
          .update(categories)
          .set({ 
            itemCount: sql`GREATEST(${categories.itemCount} - ${count}, 0)` 
          })
          .where(eq(categories.id, categoryId));
      }
      
      return {
        success: result.length > 0,
        deletedCount: result.length
      };
    } catch (error) {
      console.error("Error in batchDeleteVideos:", error);
      return { success: false, deletedCount: 0 };
    }
  }
  
  async batchUpdateVideoCategory(videoIds: number[], categoryId: number): Promise<{ success: boolean, updatedCount: number }> {
    try {
      // First verify category exists
      const category = await this.getCategory(categoryId);
      if (!category) {
        return { success: false, updatedCount: 0 };
      }
      
      // Get original videos to track their categories
      const originalVideos = await db
        .select()
        .from(videos)
        .where(sql`${videos.id} IN (${videoIds.join(',')})`);
      
      // Extract unique source category IDs 
      const sourceCategoryIds = [...new Set(originalVideos.map(v => v.categoryId))];
      
      // Update videos
      const result = await db
        .update(videos)
        .set({ categoryId })
        .where(sql`${videos.id} IN (${videoIds.join(',')})`)
        .returning({ id: videos.id });
      
      // Decrement counts in source categories
      for (const sourceCategoryId of sourceCategoryIds) {
        if (sourceCategoryId !== categoryId) { // Skip if same as target
          const count = originalVideos.filter(v => v.categoryId === sourceCategoryId).length;
          await db
            .update(categories)
            .set({ 
              itemCount: sql`GREATEST(${categories.itemCount} - ${count}, 0)` 
            })
            .where(eq(categories.id, sourceCategoryId));
        }
      }
      
      // Increment count in target category
      await db
        .update(categories)
        .set({ 
          itemCount: sql`${categories.itemCount} + ${result.length}` 
        })
        .where(eq(categories.id, categoryId));
      
      return {
        success: result.length > 0,
        updatedCount: result.length
      };
    } catch (error) {
      console.error("Error in batchUpdateVideoCategory:", error);
      return { success: false, updatedCount: 0 };
    }
  }
  
  async batchUpdateVideoPremiumStatus(videoIds: number[], isPremium: boolean): Promise<{ success: boolean, updatedCount: number }> {
    try {
      const result = await db
        .update(videos)
        .set({ isPremium })
        .where(sql`${videos.id} IN (${videoIds.join(',')})`)
        .returning({ id: videos.id });
      
      return {
        success: result.length > 0,
        updatedCount: result.length
      };
    } catch (error) {
      console.error("Error in batchUpdateVideoPremiumStatus:", error);
      return { success: false, updatedCount: 0 };
    }
  }
  
  async batchUpdateVideoFeaturedStatus(videoIds: number[], isNew: boolean): Promise<{ success: boolean, updatedCount: number }> {
    try {
      const result = await db
        .update(videos)
        .set({ isNew })
        .where(sql`${videos.id} IN (${videoIds.join(',')})`)
        .returning({ id: videos.id });
      
      return {
        success: result.length > 0,
        updatedCount: result.length
      };
    } catch (error) {
      console.error("Error in batchUpdateVideoFeaturedStatus:", error);
      return { success: false, updatedCount: 0 };
    }
  }
  
  // Helper methods for category counts
  private async incrementCategoryItemCount(categoryId: number): Promise<void> {
    await db
      .update(categories)
      .set({ itemCount: sql`${categories.itemCount} + 1` })
      .where(eq(categories.id, categoryId));
  }
  
  private async decrementCategoryItemCount(categoryId: number): Promise<void> {
    await db
      .update(categories)
      .set({ itemCount: sql`GREATEST(${categories.itemCount} - 1, 0)` })
      .where(eq(categories.id, categoryId));
  }
  
  // Download methods
  async createDownload(downloadData: InsertDownload): Promise<Download> {
    const [download] = await db.insert(downloads).values({
      ...downloadData,
      downloadedAt: new Date()
    }).returning();
    
    // Increment video download count
    await this.incrementVideoDownloadCount(download.videoId);
    
    // Update user download count if needed
    await db
      .update(users)
      .set({ downloadsUsed: sql`${users.downloadsUsed} + 1` })
      .where(eq(users.id, download.userId));
    
    return download;
  }
  
  async getUserDownloads(userId: number): Promise<Download[]> {
    return db
      .select()
      .from(downloads)
      .where(eq(downloads.userId, userId))
      .orderBy(desc(downloads.downloadedAt));
  }
  
  async getRecentUserDownloads(userId: number, limit: number): Promise<(Download & { video: Video })[]> {
    // For the JOIN operation, we can use plain SQL since Drizzle's JOIN API might be complex
    const result = await db.execute<(Download & { video: Video })>(sql`
      SELECT d.*, v.*
      FROM ${downloads} d
      JOIN ${videos} v ON d.video_id = v.id
      WHERE d.user_id = ${userId}
      ORDER BY d.downloaded_at DESC
      LIMIT ${limit}
    `);
    
    return result.rows;
  }
  
  // Stats operations
  async getStatistics(): Promise<{
    totalUsers: number;
    totalVideos: number;
    totalDownloads: number;
    activeMemberships: number;
    downloadsToday: number;
  }> {
    // Get total users
    const [usersResult] = await db
      .select({ count: count() })
      .from(users);
    
    // Get total videos
    const [videosResult] = await db
      .select({ count: count() })
      .from(videos);
    
    // Get total downloads
    const [downloadsResult] = await db
      .select({ count: count() })
      .from(downloads);
    
    // Get active memberships (users with membership)
    const [membershipsResult] = await db
      .select({ count: count() })
      .from(users)
      .where(sql`${users.membershipId} IS NOT NULL`);
    
    // Get downloads today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [todayDownloadsResult] = await db
      .select({ count: count() })
      .from(downloads)
      .where(sql`${downloads.downloadedAt} >= ${today}`);
    
    return {
      totalUsers: Number(usersResult.count),
      totalVideos: Number(videosResult.count),
      totalDownloads: Number(downloadsResult.count),
      activeMemberships: Number(membershipsResult.count),
      downloadsToday: Number(todayDownloadsResult.count)
    };
  }
}