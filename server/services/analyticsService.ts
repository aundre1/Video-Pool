import { db } from '../db';
import { 
  videos, 
  users, 
  downloads, 
  favorites,
  playlists, 
  playlistItems,
  categories
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, count, sum, inArray } from 'drizzle-orm';

interface AnalyticsTimeframe {
  startDate: Date;
  endDate: Date;
}

interface VideoAnalytics {
  id: number;
  title: string;
  totalDownloads: number;
  totalPreviews: number;
  favoriteCount: number;
  playlistCount: number;
  downloadConversionRate: number; // previews to downloads ratio
  trendScore: number; // algorithm-based trending score
}

interface UserAnalytics {
  id: number;
  username: string;
  email: string;
  totalDownloads: number;
  activeSessionsLast30Days: number;
  favoriteCategories: Array<{id: number, name: string, count: number}>;
  downloadsByTimeOfDay: Record<string, number>; // morning, afternoon, evening, night
  membershipUtilization: number; // percentage of download limit used
}

interface CategoryAnalytics {
  id: number;
  name: string;
  totalDownloads: number;
  popularity: number; // 0-100 scale
  growthRate: number; // percent change over previous period
  mostDownloadedVideos: Array<{id: number, title: string, downloads: number}>;
}

interface SearchAnalytics {
  searchTerm: string;
  count: number;
  conversionRate: number; // search to download conversion
  averageSessionTime: number; // time between search and action
}

interface DashboardMetrics {
  newUsers: number;
  totalDownloads: number;
  activeSubscriptions: number;
  premiumDownloads: number;
  standardDownloads: number;
  revenues: {
    total: number;
    byMembershipTier: any[];
    monthOverMonthGrowth: number;
  };
  popularVideoIds: number[];
  popularCategoryIds: number[];
  searchTrends: string[];
}

interface DashboardMetrics {
  newUsers: number;
  totalDownloads: number;
  activeSubscriptions: number;
  premiumDownloads: number;
  standardDownloads: number;
  revenues: {
    total: number;
    byMembershipTier: Record<string, number>;
    monthOverMonthGrowth: number;
  };
  popularVideoIds: number[];
  popularCategoryIds: number[];
  searchTrends: string[];
}

export const analyticsService = {
  /**
   * Get category distribution for visualization
   */
  async getCategoryDistribution(startDate?: Date, endDate?: Date): Promise<any[]> {
    const now = new Date();
    startDate = startDate || new Date(now.setDate(now.getDate() - 30));
    endDate = endDate || new Date();
    
    try {
      // Query to get download counts by category
      const categoryDownloads = await db.execute(sql`
        SELECT 
          c.id,
          c.name,
          COUNT(d.id) as download_count
        FROM downloads d
        JOIN videos v ON d.video_id = v.id
        JOIN categories c ON v.category_id = c.id
        WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
        GROUP BY c.id, c.name
        ORDER BY download_count DESC
        LIMIT 6
      `);
      
      // Format for pie chart
      return (categoryDownloads as any[]).map((category: any) => ({
        name: category.name,
        value: parseInt(category.download_count)
      }));
    } catch (error) {
      console.error('Error getting category distribution:', error);
      return [];
    }
  },
  
  /**
   * Get top performing videos
   */
  async getTopVideos(startDate?: Date, endDate?: Date, limit: number = 10): Promise<any[]> {
    const now = new Date();
    startDate = startDate || new Date(now.setDate(now.getDate() - 30));
    endDate = endDate || new Date();
    
    try {
      // Query to get top videos by downloads
      const topVideos = await db.execute(sql`
        SELECT 
          v.id,
          v.title,
          v.description,
          v.thumbnail_url AS "thumbnailUrl",
          v.duration,
          v.resolution,
          v.category_id AS "categoryId",
          c.name AS "categoryName",
          COUNT(d.id) AS downloads,
          v.download_count * 2.7 AS views,
          v.is_premium AS "isPremium"
        FROM videos v
        JOIN downloads d ON v.id = d.video_id
        JOIN categories c ON v.category_id = c.id
        WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
        GROUP BY v.id, v.title, v.description, v.thumbnail_url, v.duration, v.resolution, 
                 v.category_id, c.name, v.download_count, v.is_premium
        ORDER BY downloads DESC
        LIMIT ${limit}
      `);
      
      return topVideos as any[];
    } catch (error) {
      console.error('Error getting top videos:', error);
      return [];
    }
  },
  
  /**
   * Get content duration analysis
   */
  async getContentDurationAnalysis(startDate?: Date, endDate?: Date): Promise<any[]> {
    const now = new Date();
    startDate = startDate || new Date(now.setDate(now.getDate() - 30));
    endDate = endDate || new Date();
    
    try {
      // Query to get videos with duration and downloads
      const durationData = await db.execute(sql`
        SELECT 
          v.id,
          v.title,
          v.duration,
          COUNT(d.id) AS downloads
        FROM videos v
        JOIN downloads d ON v.id = d.video_id
        WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
        GROUP BY v.id, v.title, v.duration
        ORDER BY downloads DESC
        LIMIT 50
      `);
      
      return (durationData as any[]).map((item: any) => ({
        id: item.id,
        title: item.title,
        duration: parseInt(item.duration),
        downloads: parseInt(item.downloads)
      }));
    } catch (error) {
      console.error('Error getting duration analysis:', error);
      return [];
    }
  },
  
  /**
   * Get category analytics
   */
  async getCategoryAnalytics(startDate?: Date, endDate?: Date): Promise<any[]> {
    const now = new Date();
    const currentStartDate = startDate || new Date(now.setDate(now.getDate() - 30));
    const currentEndDate = endDate || new Date();
    
    // Calculate previous period for growth rate
    const periodLength = currentEndDate.getTime() - currentStartDate.getTime();
    const previousEndDate = new Date(currentStartDate.getTime() - 1);
    const previousStartDate = new Date(previousEndDate.getTime() - periodLength);
    
    try {
      // Get current period downloads by category
      const currentPeriod = await db.execute(sql`
        SELECT 
          c.id,
          c.name,
          COUNT(d.id) AS download_count
        FROM categories c
        LEFT JOIN videos v ON c.id = v.category_id
        LEFT JOIN downloads d ON v.id = d.video_id AND d.downloaded_at >= ${currentStartDate} AND d.downloaded_at <= ${currentEndDate}
        GROUP BY c.id, c.name
        ORDER BY download_count DESC
      `);
      
      // Get previous period downloads by category
      const previousPeriod = await db.execute(sql`
        SELECT 
          c.id,
          COUNT(d.id) AS download_count
        FROM categories c
        LEFT JOIN videos v ON c.id = v.category_id
        LEFT JOIN downloads d ON v.id = d.video_id AND d.downloaded_at >= ${previousStartDate} AND d.downloaded_at <= ${previousEndDate}
        GROUP BY c.id
      `);
      
      // Convert to maps for easier lookup
      const prevDownloads = (previousPeriod as any[]).reduce((acc, item) => {
        acc[item.id] = parseInt(item.download_count);
        return acc;
      }, {} as Record<number, number>);
      
      // Calculate growth rates and format results
      return (currentPeriod as any[]).map((category: any) => {
        const currentDownloads = parseInt(category.download_count);
        const previousDownloads = prevDownloads[category.id] || 0;
        
        // Calculate growth rate
        const growthRate = previousDownloads > 0
          ? ((currentDownloads - previousDownloads) / previousDownloads) * 100
          : currentDownloads > 0 ? 100 : 0;
        
        // Calculate popularity as percentage of total downloads
        const totalDownloads = (currentPeriod as any[]).reduce(
          (sum, cat) => sum + parseInt(cat.download_count), 0
        );
        
        const popularity = totalDownloads > 0
          ? Math.round((currentDownloads / totalDownloads) * 100)
          : 0;
        
        return {
          id: category.id,
          name: category.name,
          downloads: currentDownloads,
          growthRate: growthRate,
          popularity: popularity,
          avgTime: 3 + Math.random() * 4 // Simulated average time spent (3-7 minutes)
        };
      });
    } catch (error) {
      console.error('Error getting category analytics:', error);
      return [];
    }
  },
  
  /**
   * Get popular search terms
   */
  async getPopularSearchTerms(startDate?: Date, endDate?: Date, limit: number = 10): Promise<any[]> {
    // In a real application, we would have a search_logs table
    // Here, we'll return simulated data
    
    // Common search terms for DJ video content
    const commonSearchTerms = [
      "hip hop",
      "dance",
      "party",
      "club",
      "EDM",
      "trap",
      "house music",
      "rap",
      "pop",
      "wedding",
      "remix",
      "transition",
      "visual effects",
      "loops",
      "light show"
    ];
    
    // Generate random counts with a pareto distribution (some very popular, most less popular)
    let totalSearches = 0;
    const searches = commonSearchTerms.map(term => {
      // Generate a count with pareto distribution
      const rank = commonSearchTerms.indexOf(term) + 1;
      const count = Math.floor(1000 / Math.pow(rank, 0.8) * (0.8 + Math.random() * 0.4));
      totalSearches += count;
      
      return { term, count };
    });
    
    // Sort by count and calculate percentages
    searches.sort((a, b) => b.count - a.count);
    
    return searches.slice(0, limit).map(search => ({
      term: search.term,
      count: search.count,
      percentage: Math.round((search.count / totalSearches) * 100)
    }));
  },
  /**
   * Get complete dashboard metrics for admin
   */
  async getDashboardMetrics(timeframe?: AnalyticsTimeframe): Promise<DashboardMetrics> {
    const now = new Date();
    const startDate = timeframe?.startDate || new Date(now.setDate(now.getDate() - 30));
    const endDate = timeframe?.endDate || new Date();
    
    // New users in period
    const newUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        gte(users.createdAt!, startDate),
        lte(users.createdAt!, endDate)
      ));
    
    const newUsers = newUsersResult[0]?.count || 0;
    
    // Total downloads in period
    const totalDownloadsResult = await db
      .select({ count: count() })
      .from(downloads)
      .where(and(
        gte(downloads.downloadedAt!, startDate),
        lte(downloads.downloadedAt!, endDate)
      ));
    
    const totalDownloads = totalDownloadsResult[0]?.count || 0;
    
    // Active subscriptions
    const activeSubscriptionsResult = await db
      .select({ count: count() })
      .from(users)
      .where(and(
        gte(users.membershipEndDate!, now),
        sql`${users.membershipId} IS NOT NULL`
      ));
    
    const activeSubscriptions = activeSubscriptionsResult[0]?.count || 0;
    
    // Get downloads by video type (premium vs standard)
    const downloadsByTypeQuery = await db.execute(sql`
      SELECT 
        SUM(CASE WHEN v.is_premium = true THEN 1 ELSE 0 END) as premium_downloads,
        SUM(CASE WHEN v.is_premium = false THEN 1 ELSE 0 END) as standard_downloads
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
    `);
    
    const downloadsByType = downloadsByTypeQuery[0] || { premium_downloads: 0, standard_downloads: 0 };
    
    // Calculate revenue (simplified, in real app would use payment records)
    const revenueByTierQuery = await db.execute(sql`
      SELECT 
        m.name as tier_name,
        COUNT(u.id) as user_count,
        m.price as tier_price
      FROM users u
      JOIN memberships m ON u.membership_id = m.id
      WHERE u.membership_end_date >= ${now}
      GROUP BY m.name, m.price
    `);
    
    const revenueByTier: Record<string, number> = {};
    let totalRevenue = 0;
    
    revenueByTierQuery.forEach((row: any) => {
      const tierRevenue = (row.user_count * row.tier_price) / 100; // convert from cents
      revenueByTier[row.tier_name] = tierRevenue;
      totalRevenue += tierRevenue;
    });
    
    // Get previous month for comparison
    const prevMonthStart = new Date(startDate);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(startDate);
    prevMonthEnd.setDate(prevMonthEnd.getDate() - 1);
    
    // Get previous month revenue (simplified)
    const prevRevenueQuery = await db.execute(sql`
      SELECT 
        SUM(m.price) as total_revenue
      FROM users u
      JOIN memberships m ON u.membership_id = m.id
      WHERE 
        u.membership_start_date >= ${prevMonthStart} AND 
        u.membership_start_date <= ${prevMonthEnd}
    `);
    
    const prevRevenue = (prevRevenueQuery[0]?.total_revenue || 0) / 100;
    const monthOverMonthGrowth = prevRevenue > 0 
      ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 
      : 0;
    
    // Get top videos
    const popularVideosQuery = await db
      .select({
        videoId: downloads.videoId
      })
      .from(downloads)
      .where(and(
        gte(downloads.downloadedAt!, startDate),
        lte(downloads.downloadedAt!, endDate)
      ))
      .groupBy(downloads.videoId)
      .orderBy(desc(count(downloads.id)))
      .limit(10);
    
    const popularVideoIds = popularVideosQuery.map(v => v.videoId) as number[];
    
    // Get popular categories
    const popularCategoriesQuery = await db.execute(sql`
      SELECT 
        v.category_id,
        COUNT(d.id) as download_count
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
      GROUP BY v.category_id
      ORDER BY download_count DESC
      LIMIT 5
    `);
    
    const popularCategoryIds = popularCategoriesQuery.map((row: any) => row.category_id) as number[];
    
    // Get search trends (would require a search_log table in real application)
    // Simulated here
    const searchTrends = [
      "new releases",
      "hip hop",
      "dance",
      "trap",
      "remixes"
    ];
    
    return {
      newUsers,
      totalDownloads,
      activeSubscriptions,
      premiumDownloads: downloadsByType.premium_downloads || 0,
      standardDownloads: downloadsByType.standard_downloads || 0,
      revenues: {
        total: totalRevenue,
        byMembershipTier: revenueByTier,
        monthOverMonthGrowth
      },
      popularVideoIds,
      popularCategoryIds,
      searchTrends
    };
  },
  
  /**
   * Get detailed analytics for a specific video
   */
  async getVideoAnalytics(videoId: number, timeframe?: AnalyticsTimeframe): Promise<VideoAnalytics> {
    const now = new Date();
    const startDate = timeframe?.startDate || new Date(now.setDate(now.getDate() - 30));
    const endDate = timeframe?.endDate || new Date();
    
    // Get video details
    const videoResult = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId));
    
    if (!videoResult.length) {
      throw new Error('Video not found');
    }
    
    const video = videoResult[0];
    
    // Total downloads
    const downloadsResult = await db
      .select({ count: count() })
      .from(downloads)
      .where(and(
        eq(downloads.videoId, videoId),
        gte(downloads.downloadedAt!, startDate),
        lte(downloads.downloadedAt!, endDate)
      ));
    
    const totalDownloads = downloadsResult[0]?.count || 0;
    
    // In a real application, we would have a table for previews
    // Here we simulate with an estimated value
    const totalPreviews = Math.round(totalDownloads * 2.5); // Just an estimate
    
    // Get favorite count
    const favoritesResult = await db
      .select({ count: count() })
      .from(favorites)
      .where(eq(favorites.videoId, videoId));
    
    const favoriteCount = favoritesResult[0]?.count || 0;
    
    // Get playlist inclusions
    const playlistResult = await db
      .select({ count: count() })
      .from(playlistItems)
      .where(eq(playlistItems.videoId, videoId));
    
    const playlistCount = playlistResult[0]?.count || 0;
    
    // Calculate conversion rate (downloads/previews)
    const downloadConversionRate = totalPreviews > 0 
      ? (totalDownloads / totalPreviews) * 100 
      : 0;
    
    // Calculate trend score (algorithm can be customized)
    // Factors: recent downloads, favorites, playlist adds, with time decay
    const daysSinceRelease = Math.max(1, Math.ceil((new Date().getTime() - (video.createdAt?.getTime() || 0)) / (1000 * 60 * 60 * 24)));
    
    const trendScore = (
      (totalDownloads * 5) + 
      (favoriteCount * 3) + 
      (playlistCount * 2)
    ) / Math.sqrt(daysSinceRelease);
    
    return {
      id: videoId,
      title: video.title,
      totalDownloads,
      totalPreviews,
      favoriteCount,
      playlistCount,
      downloadConversionRate,
      trendScore
    };
  },
  
  /**
   * Get detailed analytics for a specific user
   */
  async getUserAnalytics(userId: number, timeframe?: AnalyticsTimeframe): Promise<UserAnalytics> {
    const now = new Date();
    const startDate = timeframe?.startDate || new Date(now.setDate(now.getDate() - 30));
    const endDate = timeframe?.endDate || new Date();
    
    // Get user details
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!userResult.length) {
      throw new Error('User not found');
    }
    
    const user = userResult[0];
    
    // Get total downloads
    const downloadsResult = await db
      .select({ count: count() })
      .from(downloads)
      .where(and(
        eq(downloads.userId, userId),
        gte(downloads.downloadedAt!, startDate),
        lte(downloads.downloadedAt!, endDate)
      ));
    
    const totalDownloads = downloadsResult[0]?.count || 0;
    
    // In a real application, we would track sessions
    // Here we simulate with an estimated value
    const activeSessionsLast30Days = Math.min(30, Math.ceil(totalDownloads / 2) + Math.floor(Math.random() * 5));
    
    // Get favorite categories (via downloads)
    const favoriteCategoriesQuery = await db.execute(sql`
      SELECT 
        c.id,
        c.name,
        COUNT(d.id) as download_count
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      JOIN categories c ON v.category_id = c.id
      WHERE 
        d.user_id = ${userId} AND
        d.downloaded_at >= ${startDate} AND 
        d.downloaded_at <= ${endDate}
      GROUP BY c.id, c.name
      ORDER BY download_count DESC
      LIMIT 5
    `);
    
    const favoriteCategories = favoriteCategoriesQuery.map((row: any) => ({
      id: row.id,
      name: row.name,
      count: row.download_count
    }));
    
    // Get downloads by time of day
    const downloadsByTimeQuery = await db.execute(sql`
      SELECT 
        CASE
          WHEN EXTRACT(HOUR FROM d.downloaded_at) BETWEEN 5 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM d.downloaded_at) BETWEEN 12 AND 16 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM d.downloaded_at) BETWEEN 17 AND 21 THEN 'evening'
          ELSE 'night'
        END as time_of_day,
        COUNT(d.id) as download_count
      FROM downloads d
      WHERE 
        d.user_id = ${userId} AND
        d.downloaded_at >= ${startDate} AND 
        d.downloaded_at <= ${endDate}
      GROUP BY time_of_day
    `);
    
    const downloadsByTimeOfDay: Record<string, number> = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };
    
    downloadsByTimeQuery.forEach((row: any) => {
      downloadsByTimeOfDay[row.time_of_day] = row.download_count;
    });
    
    // Calculate membership utilization
    const membershipUtilization = user.membershipId && user.downloadsRemaining !== null && user.downloadsUsed !== null
      ? (user.downloadsUsed / (user.downloadsUsed + user.downloadsRemaining)) * 100
      : 0;
    
    return {
      id: userId,
      username: user.username,
      email: user.email,
      totalDownloads,
      activeSessionsLast30Days,
      favoriteCategories,
      downloadsByTimeOfDay,
      membershipUtilization
    };
  },
  
  /**
   * Get detailed analytics for a specific category
   */
  async getCategoryAnalytics(categoryId: number, timeframe?: AnalyticsTimeframe): Promise<CategoryAnalytics> {
    const now = new Date();
    const startDate = timeframe?.startDate || new Date(now.setDate(now.getDate() - 30));
    const endDate = timeframe?.endDate || new Date();
    
    // Get category details
    const categoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId));
    
    if (!categoryResult.length) {
      throw new Error('Category not found');
    }
    
    const category = categoryResult[0];
    
    // Total downloads for category
    const downloadsResult = await db.execute(sql`
      SELECT COUNT(d.id) as total_downloads
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE 
        v.category_id = ${categoryId} AND
        d.downloaded_at >= ${startDate} AND 
        d.downloaded_at <= ${endDate}
    `);
    
    const totalDownloads = downloadsResult[0]?.total_downloads || 0;
    
    // Calculate previous period for comparison
    const prevPeriodDuration = endDate.getTime() - startDate.getTime();
    const prevPeriodStart = new Date(startDate.getTime() - prevPeriodDuration);
    const prevPeriodEnd = new Date(startDate.getTime() - 1);
    
    // Get downloads from previous period
    const prevDownloadsResult = await db.execute(sql`
      SELECT COUNT(d.id) as total_downloads
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE 
        v.category_id = ${categoryId} AND
        d.downloaded_at >= ${prevPeriodStart} AND 
        d.downloaded_at <= ${prevPeriodEnd}
    `);
    
    const prevTotalDownloads = prevDownloadsResult[0]?.total_downloads || 0;
    
    // Calculate growth rate
    const growthRate = prevTotalDownloads > 0
      ? ((totalDownloads - prevTotalDownloads) / prevTotalDownloads) * 100
      : 0;
    
    // Calculate popularity score (0-100)
    // In a real application, this would be based on many factors
    // Here we simulate with a simplified algorithm
    const allCategoriesResult = await db.execute(sql`
      SELECT 
        v.category_id,
        COUNT(d.id) as download_count
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE d.downloaded_at >= ${startDate} AND d.downloaded_at <= ${endDate}
      GROUP BY v.category_id
      ORDER BY download_count DESC
    `);
    
    const highestDownloads = Math.max(
      ...allCategoriesResult.map((row: any) => row.download_count),
      1 // avoid division by zero
    );
    
    const popularity = Math.round((totalDownloads / highestDownloads) * 100);
    
    // Get most downloaded videos
    const topVideosResult = await db.execute(sql`
      SELECT 
        v.id,
        v.title,
        COUNT(d.id) as download_count
      FROM downloads d
      JOIN videos v ON d.video_id = v.id
      WHERE 
        v.category_id = ${categoryId} AND
        d.downloaded_at >= ${startDate} AND 
        d.downloaded_at <= ${endDate}
      GROUP BY v.id, v.title
      ORDER BY download_count DESC
      LIMIT 10
    `);
    
    const mostDownloadedVideos = topVideosResult.map((row: any) => ({
      id: row.id,
      title: row.title,
      downloads: row.download_count
    }));
    
    return {
      id: categoryId,
      name: category.name,
      totalDownloads,
      popularity,
      growthRate,
      mostDownloadedVideos
    };
  },
  
  /**
   * Get analytics on search terms
   * In a real application, this would require a search_logs table
   * Here we simulate approximate results
   */
  async getSearchAnalytics(limit?: number): Promise<SearchAnalytics[]> {
    // Simulate search analytics data
    // In a real application, this would be based on actual search logs
    return [
      {
        searchTerm: "hip hop",
        count: 187,
        conversionRate: 42.3,
        averageSessionTime: 325
      },
      {
        searchTerm: "dance remix",
        count: 142,
        conversionRate: 38.7,
        averageSessionTime: 278
      },
      {
        searchTerm: "trap",
        count: 126,
        conversionRate: 45.2,
        averageSessionTime: 312
      },
      {
        searchTerm: "dj set",
        count: 113,
        conversionRate: 51.4,
        averageSessionTime: 342
      },
      {
        searchTerm: "house music",
        count: 98,
        conversionRate: 40.8,
        averageSessionTime: 295
      }
    ].slice(0, limit || 10);
  },
  
  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(startDate?: Date, endDate?: Date): Promise<any> {
    const now = new Date();
    const effectiveStartDate = startDate || new Date(now.setDate(now.getDate() - 30));
    const effectiveEndDate = endDate || new Date();
    
    // Active users in period
    const activeUsersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) as active_users
      FROM downloads
      WHERE downloaded_at >= ${effectiveStartDate} AND downloaded_at <= ${effectiveEndDate}
    `);
    
    const activeUsers = activeUsersResult[0]?.active_users || 0;
    
    // Conversion metrics (based on downloads per user)
    const conversionMetricsResult = await db.execute(sql`
      SELECT 
        AVG(download_count) as avg_downloads_per_user,
        MAX(download_count) as max_downloads,
        MIN(download_count) as min_downloads,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY download_count) as median_downloads
      FROM (
        SELECT user_id, COUNT(*) as download_count
        FROM downloads
        WHERE downloaded_at >= ${effectiveStartDate} AND downloaded_at <= ${effectiveEndDate}
        GROUP BY user_id
      ) as user_downloads
    `);
    
    // User retention (simulated - would need user_sessions table in a real app)
    // Here we estimate based on returning downloads
    const retentionResult = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT user_id) as returning_users
      FROM downloads
      WHERE 
        downloaded_at >= ${effectiveStartDate} AND 
        downloaded_at <= ${effectiveEndDate} AND
        user_id IN (
          SELECT DISTINCT user_id 
          FROM downloads 
          WHERE downloaded_at < ${effectiveStartDate}
        )
    `);
    
    // Total users with memberships
    const totalSubscribersResult = await db.execute(sql`
      SELECT COUNT(*) as total_subscribers
      FROM users
      WHERE membership_id IS NOT NULL
    `);
    
    const totalSubscribers = totalSubscribersResult[0]?.total_subscribers || 0;
    
    // Calculate retention rate
    const retentionRate = totalSubscribers > 0
      ? (retentionResult[0]?.returning_users / totalSubscribers) * 100
      : 0;
    
    return {
      activeUsers,
      avgDownloadsPerUser: conversionMetricsResult[0]?.avg_downloads_per_user || 0,
      retentionRate,
      totalSubscribers
    };
  }
};