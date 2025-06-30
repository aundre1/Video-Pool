import { Request, Response } from "express";
import { storage } from "../storage";
import { insertVideoSchema, insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import { videoProcessor } from "../services/videoProcessor";

// Batch operation schemas
const batchDeleteSchema = z.object({
  videoIds: z.array(z.number()).min(1, "At least one video ID must be provided")
});

const batchUpdateCategorySchema = z.object({
  videoIds: z.array(z.number()).min(1, "At least one video ID must be provided"),
  categoryId: z.number()
});

const batchUpdatePremiumStatusSchema = z.object({
  videoIds: z.array(z.number()).min(1, "At least one video ID must be provided"),
  isPremium: z.boolean()
});

const batchUpdateFeaturedStatusSchema = z.object({
  videoIds: z.array(z.number()).min(1, "At least one video ID must be provided"),
  isNew: z.boolean()
});

const batchTagVideosSchema = z.object({
  videoIds: z.array(z.number()).min(1, "At least one video ID must be provided"),
  tags: z.array(z.string()).min(1, "At least one tag must be provided")
});

// Controller for videos
export const videosController = {
  // Batch operations
  batchDeleteVideos: async (req: Request, res: Response) => {
    try {
      const data = batchDeleteSchema.parse(req.body);
      const result = await storage.batchDeleteVideos(data.videoIds);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `Successfully deleted ${result.deletedCount} videos`,
          deletedCount: result.deletedCount
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to delete videos"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "An error occurred while deleting videos" 
      });
    }
  },
  
  batchUpdateVideoCategory: async (req: Request, res: Response) => {
    try {
      const data = batchUpdateCategorySchema.parse(req.body);
      const result = await storage.batchUpdateVideoCategory(data.videoIds, data.categoryId);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `Successfully updated category for ${result.updatedCount} videos`,
          updatedCount: result.updatedCount
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to update video categories"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "An error occurred while updating video categories" 
      });
    }
  },
  
  batchUpdateVideoPremiumStatus: async (req: Request, res: Response) => {
    try {
      const data = batchUpdatePremiumStatusSchema.parse(req.body);
      const result = await storage.batchUpdateVideoPremiumStatus(data.videoIds, data.isPremium);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `Successfully updated premium status for ${result.updatedCount} videos`,
          updatedCount: result.updatedCount
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to update video premium status"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "An error occurred while updating video premium status" 
      });
    }
  },
  
  batchUpdateVideoFeaturedStatus: async (req: Request, res: Response) => {
    try {
      const data = batchUpdateFeaturedStatusSchema.parse(req.body);
      const result = await storage.batchUpdateVideoFeaturedStatus(data.videoIds, data.isNew);
      
      if (result.success) {
        return res.status(200).json({
          success: true,
          message: `Successfully updated featured status for ${result.updatedCount} videos`,
          updatedCount: result.updatedCount
        });
      } else {
        return res.status(400).json({
          success: false,
          message: "Failed to update video featured status"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: "Validation error", 
          errors: error.errors 
        });
      }
      return res.status(500).json({ 
        success: false,
        message: "An error occurred while updating video featured status" 
      });
    }
  },
  // Get paginated videos with filters
  getVideos: async (req: Request, res: Response) => {
    try {
      const {
        search,
        category,
        premium,
        loop,
        sort = "newest",
        page = 1,
        limit = 12
      } = req.query;
      
      // Convert query params to correct types
      const filter = {
        searchTerm: search as string | undefined,
        categoryId: category ? parseInt(category as string) : undefined,
        isPremium: premium ? premium === "true" : undefined,
        isLoop: loop ? loop === "true" : undefined,
        sortBy: sort as string | undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };
      
      const result = await storage.getAllVideos(filter);
      
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get featured videos
  getFeaturedVideos: async (req: Request, res: Response) => {
    try {
      const { type, limit = 8 } = req.query;
      
      const videos = await storage.getFeaturedVideos({
        type: type as string | undefined,
        limit: parseInt(limit as string)
      });
      
      res.status(200).json(videos);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get a single video by ID
  getVideo: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.status(200).json(video);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get related videos
  getRelatedVideos: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Get videos from the same category (basic recommendation)
      const { videos } = await storage.getVideosByCategory(video.categoryId, 1, 4);
      
      // Filter out the current video
      const relatedVideos = videos.filter(v => v.id !== parseInt(id));
      
      res.status(200).json(relatedVideos);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get recommended videos for a user
  getRecommendedVideos: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
      
      // Use our advanced recommendation service that combines multiple algorithms
      // to provide intelligent recommendations based on download history
      const { recommendationService } = await import('../services/recommendationService');
      
      try {
        // Get personalized recommendations
        const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit);
        return res.status(200).json(recommendations);
      } catch (recommendationError) {
        console.error('Advanced recommendation engine error:', recommendationError);
        
        // Fall back to basic recommendations if the advanced engine fails
        const downloads = await storage.getUserDownloads(userId);
        
        if (downloads.length === 0) {
          // If no download history, return featured videos
          const videos = await storage.getFeaturedVideos({ limit: 8 });
          return res.status(200).json(videos);
        }
        
        // Get categories of downloaded videos
        const downloadedVideos = await Promise.all(
          downloads.map(async d => await storage.getVideo(d.videoId))
        );
        
        const categoryIds = downloadedVideos
          .filter(Boolean)
          .map(v => v!.categoryId);
        
        // Get most common category
        const categoryCounts = categoryIds.reduce((acc, categoryId) => {
          acc[categoryId] = (acc[categoryId] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        if (Object.keys(categoryCounts).length === 0) {
          const videos = await storage.getFeaturedVideos({ limit: 8 });
          return res.status(200).json(videos);
        }
        
        const mostCommonCategoryId = parseInt(
          Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])[0][0]
        );
        
        // Get videos from the most common category
        const { videos } = await storage.getVideosByCategory(mostCommonCategoryId, 1, 8);
        
        // Filter out already downloaded videos
        const recommendedVideos = videos.filter(
          v => !downloads.some(d => d.videoId === v.id)
        );
        
        res.status(200).json(recommendedVideos);
      }
    } catch (error) {
      console.error('Recommendation system error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Generate and stream a preview of a video
  previewVideo: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Generate a preview
      await videoProcessor.streamPreview(video, res);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Download a video
  downloadVideo: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { id } = req.params;
      
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Check if video is premium and user has membership
      if (video.isPremium && !req.user.membershipId) {
        return res.status(403).json({ 
          message: "Premium membership required to download this video" 
        });
      }
      
      // Check if user has downloads remaining
      if (req.user.membershipId && req.user.downloadsRemaining === 0) {
        return res.status(403).json({ 
          message: "You've reached your download limit for this billing cycle" 
        });
      }
      
      // Record the download
      await storage.createDownload({
        userId: req.user.id,
        videoId: parseInt(id)
      });
      
      // Get the full video content
      await videoProcessor.streamDownload(video, res);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get all categories
  getCategories: async (req: Request, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get videos by category
  getCategoryVideos: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 12 } = req.query;
      
      const category = await storage.getCategory(parseInt(id));
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      const result = await storage.getVideosByCategory(
        parseInt(id),
        parseInt(page as string),
        parseInt(limit as string)
      );
      
      res.status(200).json({
        category,
        ...result
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Admin Routes
  
  // Get all videos (admin)
  getAllVideos: async (req: Request, res: Response) => {
    try {
      const {
        search,
        category,
        premium,
        loop,
        sort = "newest",
        page = 1,
        limit = 10
      } = req.query;
      
      // Convert query params to correct types
      const filter = {
        searchTerm: search as string | undefined,
        categoryId: category ? parseInt(category as string) : undefined,
        isPremium: premium ? premium === "true" : undefined,
        isLoop: loop ? loop === "true" : undefined,
        sortBy: sort as string | undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };
      
      const result = await storage.getAllVideos(filter);
      
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get a single video for admin
  getVideoAdmin: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const video = await storage.getVideo(parseInt(id));
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.status(200).json(video);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Create a new video
  createVideo: async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = insertVideoSchema.parse(req.body);
      
      // Check if category exists
      const category = await storage.getCategory(validatedData.categoryId);
      
      if (!category) {
        return res.status(400).json({ message: "Invalid category" });
      }
      
      // Process video file if uploaded (would be implemented in a real app)
      
      // Generate preview (would be implemented in a real app)
      
      // Create video
      const video = await storage.createVideo(validatedData);
      
      res.status(201).json(video);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Update a video
  updateVideo: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Partial validation
      const updateSchema = insertVideoSchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      // Check if category exists if provided
      if (validatedData.categoryId) {
        const category = await storage.getCategory(validatedData.categoryId);
        
        if (!category) {
          return res.status(400).json({ message: "Invalid category" });
        }
      }
      
      // Update video
      const video = await storage.updateVideo(parseInt(id), validatedData);
      
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.status(200).json(video);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Delete a video
  deleteVideo: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const deleted = await storage.deleteVideo(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      res.status(200).json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Admin category routes
  
  // Get all categories (admin)
  getAllCategories: async (req: Request, res: Response) => {
    try {
      const categories = await storage.getAllCategories();
      
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Create a new category
  createCategory: async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = insertCategorySchema.parse(req.body);
      
      // Check if slug already exists
      const existingCategory = await storage.getCategoryBySlug(validatedData.slug);
      
      if (existingCategory) {
        return res.status(400).json({ message: "Category slug already exists" });
      }
      
      // Create category
      const category = await storage.createCategory(validatedData);
      
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Update a category
  updateCategory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Partial validation
      const updateSchema = insertCategorySchema.partial();
      const validatedData = updateSchema.parse(req.body);
      
      // Check if slug already exists if provided
      if (validatedData.slug) {
        const existingCategory = await storage.getCategoryBySlug(validatedData.slug);
        
        if (existingCategory && existingCategory.id !== parseInt(id)) {
          return res.status(400).json({ message: "Category slug already exists" });
        }
      }
      
      // Update category
      const category = await storage.updateCategory(parseInt(id), validatedData);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.status(200).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Delete a category
  deleteCategory: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if category has videos
      const { videos } = await storage.getVideosByCategory(parseInt(id));
      
      if (videos.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete category with videos. Reassign videos first." 
        });
      }
      
      const deleted = await storage.deleteCategory(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.status(200).json({ message: "Category deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};
