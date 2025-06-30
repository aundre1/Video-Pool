import { Request, Response } from 'express';
import { searchService } from '../services/searchService';

export const searchController = {
  // Search videos with filters
  async searchVideos(req: Request, res: Response) {
    try {
      const {
        query,
        categoryId,
        tags,
        bpmRange,
        artist,
        year,
        resolution,
        isPremium,
        isLoop,
        sortBy,
        page,
        limit
      } = req.query;
      
      // Process multiple categoryIds
      let processedCategoryId = categoryId;
      if (categoryId && typeof categoryId === 'string' && categoryId.includes(',')) {
        processedCategoryId = categoryId.split(',').map(id => parseInt(id));
      } else if (categoryId && typeof categoryId === 'string') {
        processedCategoryId = parseInt(categoryId);
      }
      
      // Process tags
      let processedTags;
      if (tags && typeof tags === 'string') {
        processedTags = tags.split(',').map(tag => tag.trim());
      }
      
      // Process BPM range
      let processedBpmRange;
      if (typeof req.query.bpmMin === 'string' && typeof req.query.bpmMax === 'string') {
        processedBpmRange = {
          min: parseInt(req.query.bpmMin),
          max: parseInt(req.query.bpmMax)
        };
      }
      
      // Process year range
      let processedYear;
      if (typeof req.query.yearMin === 'string' && typeof req.query.yearMax === 'string') {
        processedYear = {
          min: parseInt(req.query.yearMin),
          max: parseInt(req.query.yearMax)
        };
      } else if (year && typeof year === 'string') {
        processedYear = parseInt(year);
      }
      
      // Process resolution
      let processedResolution = resolution;
      if (resolution && typeof resolution === 'string' && resolution.includes(',')) {
        processedResolution = resolution.split(',');
      }
      
      // Convert string values to appropriate types
      const filters = {
        query: typeof query === 'string' ? query : undefined,
        categoryId: processedCategoryId,
        tags: processedTags,
        bpmRange: processedBpmRange,
        artist: typeof artist === 'string' ? artist : undefined,
        year: processedYear,
        resolution: processedResolution,
        isPremium: typeof isPremium === 'string' ? isPremium === 'true' : undefined,
        isLoop: typeof isLoop === 'string' ? isLoop === 'true' : undefined,
        sortBy: typeof sortBy === 'string' ? sortBy : undefined,
        page: typeof page === 'string' ? parseInt(page) : 1,
        limit: typeof limit === 'string' ? parseInt(limit) : 20
      };
      
      const results = await searchService.searchVideos(filters);
      res.json(results);
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({ message: error.message || 'Error searching videos' });
    }
  },
  
  // Get autocomplete suggestions
  async getAutocompleteSuggestions(req: Request, res: Response) {
    try {
      const { prefix, limit } = req.query;
      
      if (!prefix || typeof prefix !== 'string') {
        return res.status(400).json({ message: 'Prefix is required' });
      }
      
      const suggestions = await searchService.getAutocompleteSuggestions(
        prefix,
        typeof limit === 'string' ? parseInt(limit) : 10
      );
      
      res.json({ suggestions });
    } catch (error: any) {
      console.error('Autocomplete error:', error);
      res.status(500).json({ message: error.message || 'Error getting suggestions' });
    }
  },
  
  // Get popular search terms
  async getPopularSearchTerms(req: Request, res: Response) {
    try {
      const { limit } = req.query;
      
      const terms = await searchService.getPopularSearchTerms(
        typeof limit === 'string' ? parseInt(limit) : 10
      );
      
      res.json({ terms });
    } catch (error: any) {
      console.error('Popular search terms error:', error);
      res.status(500).json({ message: error.message || 'Error getting popular search terms' });
    }
  }
};