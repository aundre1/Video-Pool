import { Request, Response } from 'express';
import { recommendationService } from '../services/recommendationService';

export const recommendationsController = {
  // Get related videos for a specific video
  async getRelatedVideos(req: Request, res: Response) {
    try {
      const videoId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 8;
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      const relatedVideos = await recommendationService.getRelatedVideos(videoId, limit);
      res.json(relatedVideos);
    } catch (error: any) {
      console.error('Error getting related videos:', error);
      res.status(500).json({ message: error.message || 'Error getting related videos' });
    }
  },
  
  // Get personalized recommendations for the authenticated user
  async getPersonalizedRecommendations(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
      
      const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);
      res.json(recommendations);
    } catch (error: any) {
      console.error('Error getting personalized recommendations:', error);
      res.status(500).json({ message: error.message || 'Error getting recommendations' });
    }
  },
  
  // Get trending videos
  async getTrendingVideos(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const trendingVideos = await recommendationService.getTrendingVideos(limit);
      res.json(trendingVideos);
    } catch (error: any) {
      console.error('Error getting trending videos:', error);
      res.status(500).json({ message: error.message || 'Error getting trending videos' });
    }
  },
  
  // Get popular videos
  async getPopularVideos(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const popularVideos = await recommendationService.getPopularVideos(limit);
      res.json(popularVideos);
    } catch (error: any) {
      console.error('Error getting popular videos:', error);
      res.status(500).json({ message: error.message || 'Error getting popular videos' });
    }
  },
  
  // Get new releases
  async getNewReleases(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const newReleases = await recommendationService.getNewReleases(limit);
      res.json(newReleases);
    } catch (error: any) {
      console.error('Error getting new releases:', error);
      res.status(500).json({ message: error.message || 'Error getting new releases' });
    }
  },
  
  // Get curated DJ sets
  async getCuratedSets(req: Request, res: Response) {
    try {
      const theme = req.params.theme || 'party';
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
      
      const curatedSets = await recommendationService.getCuratedSets(theme, limit);
      res.json(curatedSets);
    } catch (error: any) {
      console.error('Error getting curated sets:', error);
      res.status(500).json({ message: error.message || 'Error getting curated sets' });
    }
  },
  
  // Get similar videos
  async getSimilarVideos(req: Request, res: Response) {
    try {
      const videoId = parseInt(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 6;
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      const similarVideos = await recommendationService.getSimilarVideos(videoId, limit);
      res.json(similarVideos);
    } catch (error: any) {
      console.error('Error getting similar videos:', error);
      res.status(500).json({ message: error.message || 'Error getting similar videos' });
    }
  },
  
  // Get "You Might Also Like" recommendations
  async getYouMightAlsoLike(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const videoId = req.query.videoId ? parseInt(req.query.videoId as string) : undefined;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const includePremium = req.query.includePremium !== 'false';
      
      const options = {
        userId,
        videoId,
        categoryId,
        limit,
        includePremium
      };
      
      const recommendations = await recommendationService.getYouMightAlsoLike(options);
      res.json(recommendations);
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      res.status(500).json({ message: error.message || 'Error getting recommendations' });
    }
  }
};