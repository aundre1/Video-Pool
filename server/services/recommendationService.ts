import { db } from '../db';
import { 
  videos,
  users, 
  downloads, 
  categories
} from '@shared/schema';
import { eq, and, sql, desc, not, inArray, asc, count, sum, gt, gte, lte } from 'drizzle-orm';

/**
 * Recommendation service for generating personalized video recommendations
 * based on user download history
 */
export class RecommendationService {
  
  /**
   * Get personalized video recommendations for a user based on their download history
   * 
   * Algorithm:
   * 1. Get user's download history
   * 2. Identify favorite categories based on download frequency
   * 3. Find videos in those categories that the user hasn't downloaded yet
   * 4. Also include popular videos from categories the user has shown some interest in
   * 5. Return a diversified set of recommendations
   * 
   * @param userId - The ID of the user to get recommendations for
   * @param limit - Maximum number of recommendations to return (default: 10)
   */
  async getRecommendationsForUser(userId: number, limit: number = 10): Promise<any[]> {
    // First check if the user has any download history
    const userDownloads = await db
      .select({ videoId: downloads.videoId })
      .from(downloads)
      .where(eq(downloads.userId, userId));
    
    // If user has no downloads, return popular videos
    if (userDownloads.length === 0) {
      return this.getPopularVideos(limit);
    }
    
    // Get the IDs of videos the user has already downloaded
    const downloadedVideoIds = userDownloads.map(d => d.videoId);
    
    // Find the user's favorite categories based on download history
    const favoriteCategories = await db.execute(sql`
      SELECT 
        v.category_id,
        COUNT(d.id) as download_count
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE d.user_id = ${userId}
      GROUP BY v.category_id
      ORDER BY download_count DESC
      LIMIT 3
    `);
    
    // Convert the result to an array for typescript compatibility
    const favoriteCategoriesArray = Array.isArray(favoriteCategories) 
      ? favoriteCategories 
      : (favoriteCategories as unknown as any[]);
    
    // Extract category IDs from the results
    const favoriteCategoryIds = favoriteCategoriesArray.map((cat: any) => cat.category_id);
    
    // If we couldn't determine favorite categories, fall back to popular videos
    if (favoriteCategoryIds.length === 0) {
      return this.getPopularVideos(limit);
    }
    
    // Main recommendations: videos from favorite categories that user hasn't downloaded
    const mainRecommendations = await db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        resolution: videos.resolution,
        fileSize: videos.fileSize,
        categoryId: videos.categoryId,
        downloadCount: videos.downloadCount,
        isPremium: videos.isPremium
      })
      .from(videos)
      .where(and(
        inArray(videos.categoryId, favoriteCategoryIds),
        not(inArray(videos.id, downloadedVideoIds))
      ))
      .orderBy(desc(videos.downloadCount))
      .limit(Math.ceil(limit * 0.7)); // 70% of recommendations from favorite categories
    
    // Remaining slots: popular videos from other categories to diversify recommendations
    const remainingSlots = Math.max(0, limit - mainRecommendations.length);
    
    if (remainingSlots > 0) {
      const discoveryRecommendations = await db
        .select({
          id: videos.id,
          title: videos.title,
          description: videos.description,
          thumbnailUrl: videos.thumbnailUrl,
          duration: videos.duration,
          resolution: videos.resolution,
          fileSize: videos.fileSize,
          categoryId: videos.categoryId,
          downloadCount: videos.downloadCount,
          isPremium: videos.isPremium
        })
        .from(videos)
        .where(and(
          not(inArray(videos.categoryId, favoriteCategoryIds)),
          not(inArray(videos.id, downloadedVideoIds))
        ))
        .orderBy(desc(videos.downloadCount))
        .limit(remainingSlots);
      
      return [...mainRecommendations, ...discoveryRecommendations];
    }
    
    return mainRecommendations;
  }
  
  /**
   * Get personalized recommendations based on a user's download history
   * This is the main method that should be called from the controller
   * 
   * @param userId - The ID of the user to get recommendations for
   * @param limit - Maximum number of recommendations to return
   */
  async getPersonalizedRecommendations(userId: number, limit: number = 12): Promise<any[]> {
    try {
      // 1. Get recommendations by favorite categories
      const categoryBasedRecs = await this.getRecommendationsForUser(userId, Math.ceil(limit * 0.5));
      
      // 2. Get recommendations by download patterns (what other users with similar downloads like)
      const collaborativeRecs = await this.getCollaborativeRecommendations(userId, Math.ceil(limit * 0.3));
      
      // 3. Get trending videos not in the above recommendations
      const existingIds = [...categoryBasedRecs, ...collaborativeRecs].map(v => v.id);
      const trendingRecs = await this.getTrendingVideosExcluding(existingIds, Math.ceil(limit * 0.2));
      
      // Combine all recommendations, removing duplicates
      const combinedRecs = [...categoryBasedRecs];
      
      // Add collaborative recs if not already included
      for (const video of collaborativeRecs) {
        if (!combinedRecs.some(v => v.id === video.id)) {
          combinedRecs.push(video);
        }
      }
      
      // Add trending recs if not already included
      for (const video of trendingRecs) {
        if (!combinedRecs.some(v => v.id === video.id)) {
          combinedRecs.push(video);
        }
      }
      
      // Limit to requested number
      return combinedRecs.slice(0, limit);
    } catch (error) {
      console.error("Error generating personalized recommendations:", error);
      // Fall back to basic recommendations if an error occurs
      return this.getPopularVideos(limit);
    }
  }
  
  /**
   * Get collaborative filtering recommendations for a user
   * Finds users with similar taste and recommends videos they've downloaded
   * 
   * @param userId - The ID of the user to get recommendations for
   * @param limit - Maximum number of recommendations to return
   */
  async getCollaborativeRecommendations(userId: number, limit: number = 5): Promise<any[]> {
    // Get the videos this user has downloaded
    const userDownloads = await db
      .select({ videoId: downloads.videoId })
      .from(downloads)
      .where(eq(downloads.userId, userId));
    
    if (userDownloads.length === 0) {
      return [];
    }
    
    const userVideoIds = userDownloads.map(d => d.videoId);
    
    // Find users with similar taste (users who downloaded at least 2 of the same videos)
    const similarUsers = await db.execute(sql`
      SELECT 
        d.user_id,
        COUNT(DISTINCT d.video_id) AS common_downloads
      FROM downloads d
      WHERE 
        d.user_id != ${userId} AND
        d.video_id IN (${userVideoIds.join(',')})
      GROUP BY d.user_id
      HAVING COUNT(DISTINCT d.video_id) >= 2
      ORDER BY common_downloads DESC
      LIMIT 10
    `);
    
    if ((similarUsers as any[]).length === 0) {
      return [];
    }
    
    // Get IDs of similar users
    const similarUserIds = (similarUsers as any[]).map((user: any) => user.user_id);
    
    // Find videos that similar users downloaded but the current user hasn't
    const recommendedVideos = await db.execute(sql`
      SELECT DISTINCT 
        v.id,
        v.title,
        v.description,
        v.thumbnail_url AS "thumbnailUrl",
        v.duration,
        v.resolution,
        v.file_size AS "fileSize",
        v.category_id AS "categoryId",
        v.download_count AS "downloadCount",
        v.is_premium AS "isPremium",
        COUNT(DISTINCT d.user_id) AS download_count_similar_users
      FROM 
        videos v
      JOIN 
        downloads d ON v.id = d.video_id
      WHERE 
        d.user_id IN (${similarUserIds.join(',')})
        AND v.id NOT IN (${userVideoIds.join(',')})
      GROUP BY 
        v.id, v.title, v.description, v.thumbnail_url, v.duration, 
        v.resolution, v.file_size, v.category_id, v.download_count, v.is_premium
      ORDER BY 
        download_count_similar_users DESC
      LIMIT ${limit}
    `);
    
    // Format the results and return
    return (recommendedVideos as any[]).map((video: any) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      resolution: video.resolution,
      fileSize: video.fileSize,
      categoryId: video.categoryId,
      downloadCount: video.downloadCount,
      isPremium: video.isPremium
    }));
  }
  
  /**
   * Get trending videos excluding specific video IDs
   * 
   * @param excludeIds - Video IDs to exclude
   * @param limit - Maximum number of videos to return
   */
  async getTrendingVideosExcluding(excludeIds: number[], limit: number = 5): Promise<any[]> {
    // Get videos with recent download activity that aren't in the excluded list
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentDownloads = await db.execute(sql`
      SELECT 
        v.id,
        v.title,
        v.description,
        v.thumbnail_url AS "thumbnailUrl",
        v.duration,
        v.resolution,
        v.file_size AS "fileSize",
        v.category_id AS "categoryId",
        v.download_count AS "downloadCount",
        v.is_premium AS "isPremium",
        COUNT(d.id) AS recent_downloads
      FROM 
        videos v
      JOIN 
        downloads d ON v.id = d.video_id
      WHERE 
        d.downloaded_at >= ${thirtyDaysAgo.toISOString()}
        ${excludeIds.length > 0 ? `AND v.id NOT IN (${excludeIds.join(',')})` : ''}
      GROUP BY 
        v.id, v.title, v.description, v.thumbnail_url, v.duration, 
        v.resolution, v.file_size, v.category_id, v.download_count, v.is_premium
      ORDER BY 
        recent_downloads DESC
      LIMIT ${limit}
    `);
    
    return (recentDownloads as any[]).map((video: any) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      resolution: video.resolution,
      fileSize: video.fileSize,
      categoryId: video.categoryId,
      downloadCount: video.downloadCount,
      isPremium: video.isPremium
    }));
  }
  
  /**
   * Get trending videos (videos with highest download activity in the last 30 days)
   * 
   * @param limit - Maximum number of videos to return
   */
  async getTrendingVideos(limit: number = 10): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      const trendingVideos = await db.execute(sql`
        SELECT 
          v.id,
          v.title,
          v.description,
          v.thumbnail_url AS "thumbnailUrl",
          v.duration,
          v.resolution,
          v.file_size AS "fileSize",
          v.category_id AS "categoryId",
          v.download_count AS "downloadCount",
          v.is_premium AS "isPremium",
          COUNT(d.id) AS recent_downloads
        FROM 
          videos v
        JOIN 
          downloads d ON v.id = d.video_id
        WHERE 
          d.downloaded_at >= ${thirtyDaysAgo.toISOString()}
        GROUP BY 
          v.id, v.title, v.description, v.thumbnail_url, v.duration, 
          v.resolution, v.file_size, v.category_id, v.download_count, v.is_premium
        ORDER BY 
          recent_downloads DESC
        LIMIT ${limit}
      `);
      
      return (trendingVideos as any[]).map((video: any) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        resolution: video.resolution,
        fileSize: video.fileSize,
        categoryId: video.categoryId,
        downloadCount: video.downloadCount,
        isPremium: video.isPremium
      }));
    } catch (error) {
      console.error("Error getting trending videos:", error);
      // Fall back to popular videos
      return this.getPopularVideos(limit);
    }
  }
  
  /**
   * Get new releases (recently added videos)
   * 
   * @param limit - Maximum number of videos to return
   */
  async getNewReleases(limit: number = 10): Promise<any[]> {
    return db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        resolution: videos.resolution,
        fileSize: videos.fileSize,
        categoryId: videos.categoryId,
        downloadCount: videos.downloadCount,
        isPremium: videos.isPremium
      })
      .from(videos)
      .orderBy(desc(videos.createdAt || videos.id))
      .limit(limit);
  }
  
  /**
   * Get popular videos across the platform
   * 
   * @param limit - Maximum number of videos to return
   */
  async getPopularVideos(limit: number = 10): Promise<any[]> {
    return db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        resolution: videos.resolution,
        fileSize: videos.fileSize,
        categoryId: videos.categoryId,
        downloadCount: videos.downloadCount,
        isPremium: videos.isPremium
      })
      .from(videos)
      .orderBy(desc(videos.downloadCount))
      .limit(limit);
  }
  
  /**
   * Get similar videos to a specific video
   * Used for "you might also like" recommendations
   * 
   * @param videoId - The ID of the video to find similar videos for
   * @param limit - Maximum number of videos to return
   */
  async getSimilarVideos(videoId: number, limit: number = 5): Promise<any[]> {
    // First get the video's category
    const [video] = await db
      .select({ categoryId: videos.categoryId })
      .from(videos)
      .where(eq(videos.id, videoId));
    
    if (!video) {
      return [];
    }
    
    // Return other videos from the same category
    return db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        resolution: videos.resolution,
        fileSize: videos.fileSize,
        categoryId: videos.categoryId,
        downloadCount: videos.downloadCount,
        isPremium: videos.isPremium
      })
      .from(videos)
      .where(and(
        eq(videos.categoryId, video.categoryId),
        not(eq(videos.id, videoId))
      ))
      .orderBy(desc(videos.downloadCount))
      .limit(limit);
  }
  
  /**
   * Get "You Might Also Like" recommendations
   * 
   * @param options - Recommendation options including user ID, video ID, category ID, etc.
   */
  async getYouMightAlsoLike(options: {
    userId?: number;
    videoId?: number;
    categoryId?: number;
    limit?: number;
    includePremium?: boolean;
  }): Promise<any[]> {
    const {
      userId,
      videoId,
      categoryId,
      limit = 10,
      includePremium = true
    } = options;
    
    try {
      // If we have a video ID, use SQL for more complex logic
      if (videoId) {
        const similarVideos = await db.execute(sql`
          SELECT 
            v.id,
            v.title,
            v.description,
            v.thumbnail_url AS "thumbnailUrl",
            v.duration,
            v.resolution,
            v.category_id AS "categoryId",
            v.download_count AS "downloadCount",
            v.is_premium AS "isPremium"
          FROM 
            videos v
          WHERE 
            v.id != ${videoId}
            ${categoryId ? sql`AND v.category_id = ${categoryId}` : sql``}
            ${!includePremium ? sql`AND v.is_premium = false` : sql``}
          ORDER BY 
            v.download_count DESC
          LIMIT ${limit}
        `);
        
        return (similarVideos as any[]);
      }
      
      // If no video ID, use standard query builder
      return await db
        .select({
          id: videos.id,
          title: videos.title,
          description: videos.description,
          thumbnailUrl: videos.thumbnailUrl,
          duration: videos.duration,
          resolution: videos.resolution,
          categoryId: videos.categoryId,
          downloadCount: videos.downloadCount,
          isPremium: videos.isPremium
        })
        .from(videos)
        .where(
          categoryId 
            ? and(
                eq(videos.categoryId, categoryId), 
                !includePremium ? eq(videos.isPremium, false) : undefined
              )
            : !includePremium ? eq(videos.isPremium, false) : undefined
        )
        .orderBy(desc(videos.downloadCount))
        .limit(limit);
    } catch (error) {
      console.error("Error getting you might like recommendations:", error);
      // Return empty array on error
      return [];
    }
  }
  
  /**
   * Get curated sets of videos based on a theme
   * 
   * @param theme - The theme to get curated sets for (e.g., 'party', 'wedding', 'club')
   * @param limit - Maximum number of videos to return per set
   */
  async getCuratedSets(theme: string, limit: number = 6): Promise<any> {
    // Define category mappings for different themes
    const themeCategoryMappings: Record<string, number[]> = {
      party: [1, 3, 5], // Example category IDs for party-themed videos
      wedding: [2, 4, 6], // Example category IDs for wedding-themed videos
      club: [1, 7, 9], // Example category IDs for club-themed videos
      default: [1, 2, 3, 4] // Default categories if theme not found
    };
    
    const categoryIds = themeCategoryMappings[theme] || themeCategoryMappings.default;
    
    // Get the category names
    const categoryResults = await db
      .select({
        id: categories.id,
        name: categories.name
      })
      .from(categories)
      .where(inArray(categories.id, categoryIds));
    
    // For each category, get the top videos
    const sets = await Promise.all(
      categoryResults.map(async (category) => {
        const categoryVideos = await db
          .select({
            id: videos.id,
            title: videos.title,
            description: videos.description,
            thumbnailUrl: videos.thumbnailUrl,
            duration: videos.duration,
            resolution: videos.resolution,

            categoryId: videos.categoryId,
            downloadCount: videos.downloadCount,
            isPremium: videos.isPremium
          })
          .from(videos)
          .where(eq(videos.categoryId, category.id))
          .orderBy(desc(videos.downloadCount))
          .limit(limit);
        
        return {
          category: {
            id: category.id,
            name: category.name
          },
          videos: categoryVideos
        };
      })
    );
    
    return {
      theme,
      sets
    };
  }
}

// Export an instance for use throughout the application
export const recommendationService = new RecommendationService();