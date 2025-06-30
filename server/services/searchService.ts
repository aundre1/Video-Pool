import { db } from '../db';
import { sql } from 'drizzle-orm';
import { videos, categories } from '@shared/schema';
import { eq, like, and, or, inArray } from 'drizzle-orm';

interface SearchFilters {
  query?: string;
  categoryId?: number | number[];
  tags?: string[];
  bpmRange?: { min: number; max: number };
  artist?: string;
  year?: number | { min: number; max: number };
  resolution?: string | string[];
  isPremium?: boolean;
  isLoop?: boolean;
  sortBy?: string;
  page?: number;
  limit?: number;
}

interface SearchResult {
  videos: any[];
  total: number;
  facets?: {
    categories?: { id: number; name: string; count: number }[];
    tags?: { tag: string; count: number }[];
    resolutions?: { resolution: string; count: number }[];
    years?: { year: number; count: number }[];
    artists?: { artist: string; count: number }[];
  };
}

// Convert array of tags string to normalized array
function normalizeTags(tagsString: string | null): string[] {
  if (!tagsString) return [];
  return tagsString.split(',').map(tag => tag.trim().toLowerCase());
}

// Extract year from a date or return null
function extractYear(date: Date | null): number | null {
  if (!date) return null;
  return new Date(date).getFullYear();
}

// Extract numeric BPM from string or return null
function extractBPM(bpmString: string | null): number | null {
  if (!bpmString) return null;
  const match = bpmString.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export const searchService = {
  // Search videos with advanced filtering
  async searchVideos(filters: SearchFilters): Promise<SearchResult> {
    const {
      query = '',
      categoryId,
      tags,
      bpmRange,
      artist,
      year,
      resolution,
      isPremium,
      isLoop,
      sortBy = 'relevance',
      page = 1,
      limit = 20
    } = filters;

    // Build WHERE conditions
    let conditions = [];
    
    // Text search
    if (query) {
      conditions.push(
        or(
          like(videos.title, `%${query}%`),
          like(videos.description, `%${query}%`)
        )
      );
    }
    
    // Category filter
    if (categoryId) {
      if (Array.isArray(categoryId)) {
        conditions.push(inArray(videos.categoryId, categoryId));
      } else {
        conditions.push(eq(videos.categoryId, categoryId));
      }
    }
    
    // Tags filter using Postgres array contains
    if (tags && tags.length > 0) {
      // This will need custom SQL as Drizzle doesn't have array contains
      // We'll use the metadata column for tags in our implementation
      const tagConditions = tags.map(tag => 
        sql`metadata->>'tags' LIKE ${`%${tag}%`}`
      );
      conditions.push(or(...tagConditions));
    }
    
    // BPM range filter
    if (bpmRange) {
      // Assuming BPM is stored in metadata
      conditions.push(sql`
        (metadata->>'bpm')::int >= ${bpmRange.min} AND 
        (metadata->>'bpm')::int <= ${bpmRange.max}
      `);
    }
    
    // Artist filter
    if (artist) {
      conditions.push(sql`metadata->>'artist' LIKE ${`%${artist}%`}`);
    }
    
    // Year filter
    if (year) {
      if (typeof year === 'number') {
        conditions.push(sql`EXTRACT(YEAR FROM "createdAt") = ${year}`);
      } else {
        conditions.push(
          sql`EXTRACT(YEAR FROM "createdAt") >= ${year.min} AND EXTRACT(YEAR FROM "createdAt") <= ${year.max}`
        );
      }
    }
    
    // Resolution filter
    if (resolution) {
      if (Array.isArray(resolution)) {
        const resolutionConditions = resolution.map(r => eq(videos.resolution, r));
        conditions.push(or(...resolutionConditions));
      } else {
        conditions.push(eq(videos.resolution, resolution));
      }
    }
    
    // Premium filter
    if (isPremium !== undefined) {
      conditions.push(eq(videos.isPremium, isPremium));
    }
    
    // Loop filter
    if (isLoop !== undefined) {
      conditions.push(eq(videos.isLoop, isLoop));
    }
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build ORDER BY clause
    let orderBy;
    switch (sortBy) {
      case 'newest':
        orderBy = sql`"createdAt" DESC`;
        break;
      case 'oldest':
        orderBy = sql`"createdAt" ASC`;
        break;
      case 'popular':
        orderBy = sql`"downloadCount" DESC NULLS LAST`;
        break;
      case 'title_asc':
        orderBy = sql`"title" ASC`;
        break;
      case 'title_desc':
        orderBy = sql`"title" DESC`;
        break;
      case 'relevance':
      default:
        // If query is provided, use relevance based on text match
        orderBy = query 
          ? sql`
              CASE 
                WHEN "title" ILIKE ${`%${query}%`} THEN 1
                WHEN "description" ILIKE ${`%${query}%`} THEN 2
                ELSE 3
              END ASC, 
              "downloadCount" DESC NULLS LAST
            ` 
          : sql`"createdAt" DESC`;
        break;
    }
    
    // Prepare the where condition
    const whereClause = conditions.length > 0 
      ? and(...conditions) 
      : undefined;
    
    // Execute the query with pagination
    const videosResult = await db
      .select()
      .from(videos)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
    
    // Count total results for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(videos)
      .where(whereClause);
    
    // Get facets for filtering UI
    const facets = await this.getFacets(whereClause);
    
    return {
      videos: videosResult,
      total: Number(count),
      facets
    };
  },
  
  // Get autocomplete suggestions for search
  async getAutocompleteSuggestions(prefix: string, limit = 10): Promise<string[]> {
    if (!prefix || prefix.length < 2) {
      return [];
    }
    
    // Get suggestions from video titles
    const titleResults = await db
      .select({ title: videos.title })
      .from(videos)
      .where(like(videos.title, `${prefix}%`))
      .limit(limit);
    
    // Get suggestions from category names
    const categoryResults = await db
      .select({ name: categories.name })
      .from(categories)
      .where(like(categories.name, `${prefix}%`))
      .limit(limit);
    
    // Get suggestions from metadata (artists, tags)
    const metadataResults = await db
      .execute(sql`
        SELECT DISTINCT jsonb_object_keys(metadata) as key, metadata->jsonb_object_keys(metadata) as value
        FROM videos
        WHERE 
          metadata->>'artist' LIKE ${`${prefix}%`} OR
          metadata->>'tags' LIKE ${`%${prefix}%`}
        LIMIT ${limit}
      `);
    
    // Combine and deduplicate results
    const suggestions = [
      ...titleResults.map(r => r.title),
      ...categoryResults.map(r => r.name),
      ...metadataResults.map(r => String(r.value)).filter(Boolean)
    ];
    
    return [...new Set(suggestions)].slice(0, limit);
  },
  
  // Get popular search terms
  async getPopularSearchTerms(limit = 10): Promise<string[]> {
    // In a real implementation, you would track search terms in a dedicated table
    // For now, we'll return popular video titles as a proxy
    const popularTitles = await db
      .select({ title: videos.title })
      .from(videos)
      .orderBy(sql`"downloadCount" DESC NULLS LAST`)
      .limit(limit);
    
    return popularTitles.map(r => r.title);
  },
  
  // Get facets for filtering UI
  async getFacets(whereClause: any): Promise<SearchResult['facets']> {
    // Get category facets
    const categoryFacets = await db
      .select({
        id: categories.id,
        name: categories.name,
        count: sql<number>`count(*)`
      })
      .from(videos)
      .leftJoin(categories, eq(videos.categoryId, categories.id))
      .where(whereClause)
      .groupBy(categories.id, categories.name)
      .orderBy(sql`count(*) DESC`);
    
    // Get resolution facets
    const resolutionFacets = await db
      .select({
        resolution: videos.resolution,
        count: sql<number>`count(*)`
      })
      .from(videos)
      .where(whereClause)
      .groupBy(videos.resolution)
      .orderBy(sql`count(*) DESC`);
    
    // Get year facets
    const yearFacets = await db
      .select({
        year: sql<number>`EXTRACT(YEAR FROM "createdAt")`,
        count: sql<number>`count(*)`
      })
      .from(videos)
      .where(whereClause)
      .groupBy(sql`EXTRACT(YEAR FROM "createdAt")`)
      .orderBy(sql`EXTRACT(YEAR FROM "createdAt") DESC`);
    
    // For tags and artists, we would need more complex queries to extract from metadata
    // This is a simplified implementation
    
    return {
      categories: categoryFacets,
      resolutions: resolutionFacets.map(r => ({
        resolution: r.resolution || 'Unknown',
        count: Number(r.count)
      })),
      years: yearFacets.map(r => ({
        year: Number(r.year),
        count: Number(r.count)
      }))
    };
  }
};