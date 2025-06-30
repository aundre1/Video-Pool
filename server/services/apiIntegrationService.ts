import { db } from "../db";
import { apiKeys, apiUsage, users, videos, downloads } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { checkPermission } from "../middleware/permissions";

interface ApiKeyData {
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export const apiIntegrationService = {
  /**
   * Generate a new API key for a user
   */
  async generateApiKey(userId: number, keyData: ApiKeyData): Promise<{ key: string; secret: string }> {
    // Generate random key and secret
    const key = crypto.randomBytes(16).toString("hex");
    const secret = crypto.randomBytes(32).toString("hex");
    
    // Hash the secret for storage (in a real app you'd use a better algorithm)
    const hashedSecret = crypto.createHash("sha256").update(secret).digest("hex");
    
    // Store the API key in the database
    await db.insert(apiKeys).values({
      userId,
      name: keyData.name,
      key,
      secret: hashedSecret,
      permissions: keyData.permissions,
      expiresAt: keyData.expiresAt,
      isActive: true
    });
    
    // Return the key and secret (secret will only be shown once)
    return { key, secret };
  },
  
  /**
   * Get all API keys for a user
   */
  async getUserApiKeys(userId: number): Promise<any[]> {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        key: apiKeys.key,
        permissions: apiKeys.permissions,
        lastUsed: apiKeys.lastUsed,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt
      })
      .from(apiKeys)
      .where(and(
        eq(apiKeys.userId, userId),
        eq(apiKeys.isActive, true)
      ))
      .orderBy(desc(apiKeys.createdAt));
    
    return keys;
  },
  
  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: number, userId: number): Promise<boolean> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));
    
    if (!key || key.userId !== userId) {
      return false;
    }
    
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, keyId));
    
    return true;
  },
  
  /**
   * Update API key permissions or name
   */
  async updateApiKey(keyId: number, userId: number, updates: Partial<ApiKeyData>): Promise<any> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));
    
    if (!key || key.userId !== userId) {
      throw new Error("API key not found or does not belong to user");
    }
    
    const [updated] = await db
      .update(apiKeys)
      .set({
        name: updates.name ?? key.name,
        permissions: updates.permissions ?? key.permissions,
        expiresAt: updates.expiresAt ?? key.expiresAt,
        updatedAt: new Date()
      })
      .where(eq(apiKeys.id, keyId))
      .returning();
    
    return updated;
  },
  
  /**
   * Log API usage
   */
  async logApiUsage(apiKeyId: number, endpoint: string, method: string, responseCode: number, responseTime: number, ipAddress?: string, userAgent?: string): Promise<void> {
    await db.insert(apiUsage).values({
      apiKeyId,
      endpoint,
      method,
      responseCode,
      responseTime,
      ipAddress,
      userAgent
    });
    
    // Update the last used timestamp for the API key
    await db
      .update(apiKeys)
      .set({ lastUsed: new Date() })
      .where(eq(apiKeys.id, apiKeyId));
  },
  
  /**
   * Get API usage statistics for a user
   */
  async getApiUsageStats(userId: number, period: "day" | "week" | "month" = "month"): Promise<any> {
    // Get date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "day":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
      default:
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
    }
    
    // Get user's API keys
    const keys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
    
    const keyIds = keys.map(k => k.id);
    
    if (keyIds.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        requestsByEndpoint: [],
        requestsByDay: []
      };
    }
    
    // Get usage statistics
    const usageResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_requests,
        AVG(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 ELSE 0 END) as success_rate,
        AVG(response_time) as avg_response_time
      FROM api_usage
      WHERE 
        api_key_id IN (${sql.join(keyIds)}) AND
        timestamp >= ${startDate}
    `);
    
    // Get usage by endpoint
    const endpointStatsResult = await db.execute(sql`
      SELECT 
        endpoint,
        COUNT(*) as request_count,
        AVG(response_time) as avg_response_time
      FROM api_usage
      WHERE 
        api_key_id IN (${sql.join(keyIds)}) AND
        timestamp >= ${startDate}
      GROUP BY endpoint
      ORDER BY request_count DESC
      LIMIT 10
    `);
    
    // Get usage by day
    const dailyStatsResult = await db.execute(sql`
      SELECT 
        DATE_TRUNC('day', timestamp) as day,
        COUNT(*) as request_count
      FROM api_usage
      WHERE 
        api_key_id IN (${sql.join(keyIds)}) AND
        timestamp >= ${startDate}
      GROUP BY day
      ORDER BY day
    `);
    
    const totalRequests = parseInt(usageResult[0]?.total_requests || "0");
    const successRate = parseFloat(usageResult[0]?.success_rate || "0") * 100;
    const averageResponseTime = parseFloat(usageResult[0]?.avg_response_time || "0");
    
    return {
      totalRequests,
      successRate,
      averageResponseTime,
      requestsByEndpoint: endpointStatsResult,
      requestsByDay: dailyStatsResult
    };
  },
  
  /**
   * Verify API key and return user if valid
   */
  async verifyApiKey(key: string, secret?: string): Promise<{ valid: boolean, apiKey?: any, user?: any }> {
    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.key, key),
        eq(apiKeys.isActive, true)
      ));
    
    if (!apiKey) {
      return { valid: false };
    }
    
    // Check if the API key has expired
    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false };
    }
    
    // If secret is provided, verify it (for actions requiring higher security)
    if (secret) {
      const hashedSecret = crypto.createHash("sha256").update(secret).digest("hex");
      if (hashedSecret !== apiKey.secret) {
        return { valid: false };
      }
    }
    
    // Get the user associated with this API key
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, apiKey.userId));
    
    if (!user) {
      return { valid: false };
    }
    
    return { 
      valid: true, 
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: apiKey.permissions
      },
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  },
  
  /**
   * API Endpoint handlers
   */
  
  // Get videos (for DJ apps integration)
  async getVideos(apiKey: any, user: any, query: any): Promise<ApiResponse<any[]>> {
    // Check if API key has permission
    if (!apiKey.permissions.includes("read:video")) {
      return {
        success: false,
        error: "Permission denied: This API key does not have access to read videos"
      };
    }
    
    try {
      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 50, 100); // Cap at 100
      const offset = (page - 1) * limit;
      
      // Build query based on filters
      let videosQuery = db
        .select()
        .from(videos)
        .limit(limit)
        .offset(offset);
      
      // Filter by category if provided
      if (query.categoryId) {
        videosQuery = videosQuery.where(eq(videos.categoryId, parseInt(query.categoryId)));
      }
      
      // Filter by BPM range if provided
      if (query.minBpm && query.maxBpm) {
        // Note: This assumes you have a bpm field in your videos table
        // videosQuery = videosQuery.where(and(
        //   gte(videos.bpm, parseInt(query.minBpm)),
        //   lte(videos.bpm, parseInt(query.maxBpm))
        // ));
      }
      
      // Filter by premium status
      if (query.isPremium !== undefined) {
        videosQuery = videosQuery.where(eq(videos.isPremium, query.isPremium === 'true'));
      }
      
      // Filter by loop status
      if (query.isLoop !== undefined) {
        videosQuery = videosQuery.where(eq(videos.isLoop, query.isLoop === 'true'));
      }
      
      // Get the videos
      const videoResults = await videosQuery;
      
      // Get total count for pagination
      const countResult = await db
        .select({ count: sql`COUNT(*)` })
        .from(videos);
      
      const total = parseInt(countResult[0]?.count?.toString() || "0");
      
      return {
        success: true,
        data: videoResults,
        meta: {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      console.error("API error getting videos:", error);
      return {
        success: false,
        error: "Failed to fetch videos"
      };
    }
  },
  
  // Get video details
  async getVideoById(apiKey: any, user: any, videoId: number): Promise<ApiResponse<any>> {
    // Check if API key has permission
    if (!apiKey.permissions.includes("read:video")) {
      return {
        success: false,
        error: "Permission denied: This API key does not have access to read videos"
      };
    }
    
    try {
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));
      
      if (!video) {
        return {
          success: false,
          error: "Video not found"
        };
      }
      
      return {
        success: true,
        data: video
      };
    } catch (error) {
      console.error("API error getting video:", error);
      return {
        success: false,
        error: "Failed to fetch video details"
      };
    }
  },
  
  // Download a video
  async createVideoDownload(apiKey: any, user: any, videoId: number): Promise<ApiResponse<any>> {
    // Check if API key has permission
    if (!apiKey.permissions.includes("download:video")) {
      return {
        success: false,
        error: "Permission denied: This API key does not have access to download videos"
      };
    }
    
    try {
      // Check if video exists
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId));
      
      if (!video) {
        return {
          success: false,
          error: "Video not found"
        };
      }
      
      // Check if the user has a valid membership
      const [userDetails] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id));
      
      if (!userDetails || !userDetails.membershipId || userDetails.membershipEndDate && userDetails.membershipEndDate < new Date()) {
        return {
          success: false,
          error: "User does not have an active membership"
        };
      }
      
      // Check if the user has reached their download limit
      if (userDetails.downloadsRemaining !== null && userDetails.downloadsRemaining <= 0) {
        return {
          success: false,
          error: "User has reached their download limit"
        };
      }
      
      // Check if the video is premium and if the user has access to premium content
      // This would depend on your specific business rules
      
      // Record the download
      const [download] = await db
        .insert(downloads)
        .values({
          userId: user.id,
          videoId,
          downloadedAt: new Date()
        })
        .returning();
      
      // Update download counts
      await db
        .update(videos)
        .set({ 
          downloadCount: (video.downloadCount || 0) + 1 
        })
        .where(eq(videos.id, videoId));
      
      await db
        .update(users)
        .set({ 
          downloadsUsed: (userDetails.downloadsUsed || 0) + 1,
          downloadsRemaining: userDetails.downloadsRemaining !== null 
            ? userDetails.downloadsRemaining - 1 
            : null
        })
        .where(eq(users.id, user.id));
      
      // Generate the download URL - in a real app, this would be a signed URL with limited lifetime
      const downloadUrl = `/api/videos/${videoId}/download?token=${generateDownloadToken(videoId, user.id)}`;
      
      return {
        success: true,
        data: {
          downloadId: download.id,
          downloadUrl,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        }
      };
    } catch (error) {
      console.error("API error creating download:", error);
      return {
        success: false,
        error: "Failed to process download request"
      };
    }
  },
  
  // Get user download history
  async getUserDownloads(apiKey: any, user: any, query: any): Promise<ApiResponse<any[]>> {
    // Check if API key has permission
    if (!apiKey.permissions.includes("read:downloads")) {
      return {
        success: false,
        error: "Permission denied: This API key does not have access to read download history"
      };
    }
    
    try {
      const page = parseInt(query.page) || 1;
      const limit = Math.min(parseInt(query.limit) || 50, 100); // Cap at 100
      const offset = (page - 1) * limit;
      
      // Get download history
      const downloadsQuery = db
        .select({
          id: downloads.id,
          videoId: downloads.videoId,
          downloadedAt: downloads.downloadedAt
        })
        .from(downloads)
        .where(eq(downloads.userId, user.id))
        .orderBy(desc(downloads.downloadedAt))
        .limit(limit)
        .offset(offset);
      
      const downloadResults = await downloadsQuery;
      
      // Get videos for each download
      const downloadsWithVideos = await Promise.all(
        downloadResults.map(async (download) => {
          const [video] = await db
            .select({
              id: videos.id,
              title: videos.title,
              thumbnailUrl: videos.thumbnailUrl,
              duration: videos.duration,
              resolution: videos.resolution
            })
            .from(videos)
            .where(eq(videos.id, download.videoId));
          
          return {
            ...download,
            video
          };
        })
      );
      
      // Get total count for pagination
      const countResult = await db
        .select({ count: sql`COUNT(*)` })
        .from(downloads)
        .where(eq(downloads.userId, user.id));
      
      const total = parseInt(countResult[0]?.count?.toString() || "0");
      
      return {
        success: true,
        data: downloadsWithVideos,
        meta: {
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      console.error("API error getting user downloads:", error);
      return {
        success: false,
        error: "Failed to fetch download history"
      };
    }
  },
  
  // Get user profile information
  async getUserProfile(apiKey: any, user: any): Promise<ApiResponse<any>> {
    // Check if API key has permission
    if (!apiKey.permissions.includes("read:profile")) {
      return {
        success: false,
        error: "Permission denied: This API key does not have access to read user profile"
      };
    }
    
    try {
      const [userDetails] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          membershipId: users.membershipId,
          membershipEndDate: users.membershipEndDate,
          downloadsRemaining: users.downloadsRemaining,
          downloadsUsed: users.downloadsUsed,
          profileImageUrl: users.profileImageUrl,
          firstName: users.firstName,
          lastName: users.lastName
        })
        .from(users)
        .where(eq(users.id, user.id));
      
      if (!userDetails) {
        return {
          success: false,
          error: "User not found"
        };
      }
      
      // Get membership details if the user has one
      let membership = null;
      if (userDetails.membershipId) {
        const membershipResult = await db.execute(sql`
          SELECT * FROM memberships WHERE id = ${userDetails.membershipId}
        `);
        
        if (membershipResult.length > 0) {
          membership = membershipResult[0];
        }
      }
      
      // Calculate if membership is active
      const membershipActive = userDetails.membershipEndDate && userDetails.membershipEndDate >= new Date();
      
      return {
        success: true,
        data: {
          ...userDetails,
          membership,
          membershipActive
        }
      };
    } catch (error) {
      console.error("API error getting user profile:", error);
      return {
        success: false,
        error: "Failed to fetch user profile"
      };
    }
  }
};

// Helper function to generate a download token
function generateDownloadToken(videoId: number, userId: number): string {
  const data = {
    videoId,
    userId,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
  };
  
  const jsonStr = JSON.stringify(data);
  
  // In a real app, you'd use a more secure signing method
  const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET || 'development-secret');
  hmac.update(jsonStr);
  const signature = hmac.digest('hex');
  
  // Return token as base64 encoded string
  return Buffer.from(`${jsonStr}:${signature}`).toString('base64');
}