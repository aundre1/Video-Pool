import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';

export const analyticsController = {
  /**
   * Get dashboard metrics for content analytics
   */
  async getDashboardMetrics(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const metrics = await analyticsService.getDashboardMetrics({
        startDate: startDate || new Date(new Date().setDate(new Date().getDate() - 30)),
        endDate: endDate || new Date()
      });
      
      // Add some demo data for the frontend visualizations
      // In a production environment, this would come from the database
      const downloadTrends = generateDownloadTrends(startDate, endDate);
      const categoryDistribution = await analyticsService.getCategoryDistribution(startDate, endDate);
      
      // Calculate growth percentages
      const previousPeriodMetrics = await getPreviousPeriodMetrics(startDate, endDate);
      const downloadGrowth = calculateGrowthPercentage(metrics.totalDownloads, previousPeriodMetrics.totalDownloads);
      const viewGrowth = calculateGrowthPercentage(metrics.premiumDownloads + metrics.standardDownloads, 
        previousPeriodMetrics.premiumDownloads + previousPeriodMetrics.standardDownloads);
      const userGrowth = calculateGrowthPercentage(metrics.newUsers, previousPeriodMetrics.newUsers);
      
      // Simulate content consumption minutes (time users spent watching videos)
      const consumptionMinutes = Math.round(metrics.totalDownloads * 3.5); // Average 3.5 minutes per download
      const previousConsumptionMinutes = Math.round(previousPeriodMetrics.totalDownloads * 3.5);
      const consumptionGrowth = calculateGrowthPercentage(consumptionMinutes, previousConsumptionMinutes);
      
      res.json({
        ...metrics,
        downloadTrends,
        categoryDistribution,
        downloadGrowth,
        viewGrowth,
        userGrowth,
        consumptionMinutes,
        consumptionGrowth,
        totalViews: Math.round(metrics.totalDownloads * 2.7), // Simulate views (higher than downloads)
        activeUsers: Math.round(metrics.newUsers * 1.8) // Simulate active users
      });
    } catch (error: any) {
      console.error('Error getting dashboard metrics:', error);
      res.status(500).json({ message: error.message || 'Failed to get dashboard metrics' });
    }
  },
  
  /**
   * Get top performing content
   */
  async getTopContent(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const topVideos = await analyticsService.getTopVideos(startDate, endDate);
      const durationAnalysis = await analyticsService.getContentDurationAnalysis(startDate, endDate);
      const topVideosTrend = generateTopVideosTrend(topVideos, startDate, endDate);
      
      // Get the IDs and titles of top videos for the trends chart
      const topVideosIds = topVideos.slice(0, 5).map(video => video.id);
      const topVideosTitles = topVideos.slice(0, 5).map(video => video.title);
      
      res.json({
        videos: topVideos,
        durationAnalysis,
        topVideosTrend,
        topVideosIds,
        topVideosTitles
      });
    } catch (error: any) {
      console.error('Error getting top content:', error);
      res.status(500).json({ message: error.message || 'Failed to get top content' });
    }
  },
  
  /**
   * Get category performance analytics
   */
  async getCategoryAnalytics(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const categories = await analyticsService.getCategoryAnalytics(startDate, endDate);
      
      res.json({
        categories
      });
    } catch (error: any) {
      console.error('Error getting category analytics:', error);
      res.status(500).json({ message: error.message || 'Failed to get category analytics' });
    }
  },
  
  /**
   * Get user engagement metrics
   */
  async getUserEngagement(req: Request, res: Response) {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const engagementMetrics = await analyticsService.getUserEngagementMetrics(startDate, endDate);
      const activityByTime = generateActivityByTimeOfDay();
      const popularSearches = await analyticsService.getPopularSearchTerms(startDate, endDate);
      
      // Calculate previous period metrics for growth
      const previousPeriodMetrics = await getPreviousEngagementMetrics(startDate, endDate);
      
      const sessionTimeGrowth = calculateGrowthPercentage(
        engagementMetrics.avgSessionTime, 
        previousPeriodMetrics.avgSessionTime
      );
      
      const downloadsPerUserGrowth = calculateGrowthPercentage(
        engagementMetrics.downloadsPerUser, 
        previousPeriodMetrics.downloadsPerUser
      );
      
      const conversionRateGrowth = calculateGrowthPercentage(
        engagementMetrics.viewToDownloadRate, 
        previousPeriodMetrics.viewToDownloadRate
      );
      
      const returnRateGrowth = calculateGrowthPercentage(
        engagementMetrics.returnRate, 
        previousPeriodMetrics.returnRate
      );
      
      res.json({
        ...engagementMetrics,
        activityByTime,
        popularSearches,
        sessionTimeGrowth,
        downloadsPerUserGrowth,
        conversionRateGrowth,
        returnRateGrowth
      });
    } catch (error: any) {
      console.error('Error getting user engagement metrics:', error);
      res.status(500).json({ message: error.message || 'Failed to get user engagement metrics' });
    }
  }
};

/**
 * Calculate growth percentage between current and previous values
 */
function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Get metrics from the previous time period for comparison
 */
async function getPreviousPeriodMetrics(startDate?: Date, endDate?: Date): Promise<any> {
  const now = new Date();
  const currentEndDate = endDate || new Date();
  const currentStartDate = startDate || new Date(now.setDate(now.getDate() - 30));
  
  const periodLength = currentEndDate.getTime() - currentStartDate.getTime();
  const previousEndDate = new Date(currentStartDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - periodLength);
  
  try {
    return await analyticsService.getDashboardMetrics({
      startDate: previousStartDate,
      endDate: previousEndDate
    });
  } catch (error) {
    console.error('Error getting previous period metrics:', error);
    return {
      totalDownloads: 0,
      premiumDownloads: 0,
      standardDownloads: 0,
      newUsers: 0
    };
  }
}

/**
 * Get engagement metrics from the previous time period for comparison
 */
async function getPreviousEngagementMetrics(startDate?: Date, endDate?: Date): Promise<any> {
  const now = new Date();
  const currentEndDate = endDate || new Date();
  const currentStartDate = startDate || new Date(now.setDate(now.getDate() - 30));
  
  const periodLength = currentEndDate.getTime() - currentStartDate.getTime();
  const previousEndDate = new Date(currentStartDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - periodLength);
  
  try {
    return await analyticsService.getUserEngagementMetrics(previousStartDate, previousEndDate);
  } catch (error) {
    console.error('Error getting previous period engagement metrics:', error);
    return {
      avgSessionTime: 0,
      downloadsPerUser: 0,
      viewToDownloadRate: 0,
      returnRate: 0
    };
  }
}

/**
 * Generate download trend data for visualization
 */
function generateDownloadTrends(startDate?: Date, endDate?: Date): any[] {
  // Set default dates if not provided
  const now = new Date();
  const effectiveEndDate = endDate || new Date();
  const effectiveStartDate = startDate || new Date(now.setDate(now.getDate() - 30));
  
  const trends = [];
  const dayDiff = Math.ceil((effectiveEndDate.getTime() - effectiveStartDate.getTime()) / (24 * 60 * 60 * 1000));
  const interval = Math.max(1, Math.floor(dayDiff / 15)); // Limit to ~15 data points
  
  // Generate data points with a growth trend
  let basePremium = 50 + Math.floor(Math.random() * 30); // Starting value
  let baseStandard = 10 + Math.floor(Math.random() * 20);
  
  for (let i = 0; i < dayDiff; i += interval) {
    const currentDate = new Date(effectiveStartDate);
    currentDate.setDate(effectiveStartDate.getDate() + i);
    
    // Add some randomness but keep an upward trend
    const randomGrowth = 1 + (Math.random() * 0.2 - 0.05); // -5% to +15%
    basePremium = Math.round(basePremium * randomGrowth);
    baseStandard = Math.round(baseStandard * randomGrowth);
    
    trends.push({
      date: currentDate.toISOString().split('T')[0],
      premium: basePremium,
      standard: baseStandard,
      total: basePremium + baseStandard
    });
  }
  
  return trends;
}

/**
 * Generate download trend data for top videos
 */
function generateTopVideosTrend(topVideos: any[], startDate?: Date, endDate?: Date): any[] {
  if (!startDate || !endDate) {
    const now = new Date();
    endDate = new Date();
    startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
  }
  
  const trends = [];
  const dayDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const interval = Math.max(1, Math.floor(dayDiff / 10)); // Limit to ~10 data points
  
  // Take top 5 videos
  const topFiveVideos = topVideos.slice(0, 5);
  const videoBaselines: Record<string, number> = {};
  
  // Set initial download values proportional to their total downloads
  topFiveVideos.forEach(video => {
    videoBaselines[`video${video.id}`] = Math.max(5, Math.floor(video.downloads / dayDiff * interval * 0.9));
  });
  
  for (let i = 0; i < dayDiff; i += interval) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dataPoint: any = {
      date: currentDate.toISOString().split('T')[0]
    };
    
    // Generate data for each video
    topFiveVideos.forEach(video => {
      const key = `video${video.id}`;
      const baseline = videoBaselines[key];
      const randomFactor = 0.8 + Math.random() * 0.4; // 80% to 120% of baseline
      dataPoint[key] = Math.round(baseline * randomFactor);
      
      // Slowly increase baseline to simulate growth
      videoBaselines[key] = Math.round(baseline * (1 + (Math.random() * 0.1)));
    });
    
    trends.push(dataPoint);
  }
  
  return trends;
}

/**
 * Generate activity by time of day data
 */
function generateActivityByTimeOfDay(): any[] {
  const result = [];
  
  // Common peak hours for video platforms
  const peakHours = [8, 12, 17, 20, 22]; // Morning, lunch, after work, evening, night
  
  for (let hour = 0; hour < 24; hour++) {
    // Base level + proximity to peak hours determines activity level
    let activityLevel = 5 + Math.floor(Math.random() * 10);
    
    // Increase activity for peak hours
    for (const peakHour of peakHours) {
      const proximity = Math.abs(hour - peakHour);
      if (proximity <= 1) {
        // Boost activity level for peak hours and adjacent hours
        activityLevel += 25 - (proximity * 10);
      }
    }
    
    // Night hours (0-6) have less activity
    if (hour >= 0 && hour < 6) {
      activityLevel = Math.max(3, Math.floor(activityLevel * 0.4));
    }
    
    // Add some randomness
    const finalActivityLevel = Math.max(1, Math.round(activityLevel * (0.8 + Math.random() * 0.4)));
    
    result.push({
      hour: hour.toString().padStart(2, '0') + ":00",
      downloads: finalActivityLevel,
      views: Math.round(finalActivityLevel * (2 + Math.random()))
    });
  }
  
  return result;
}