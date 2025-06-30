import { Request, Response } from 'express';
import { db } from '../db';
import { storage } from '../storage';
import { 
  favorites, 
  playlists, 
  playlistItems, 
  videos
} from '@shared/schema';
import { createInsertSchema } from "drizzle-zod";
import { and, eq, count, desc, asc, sql, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { z } from 'zod';

export const libraryController = {
  // ---- Favorites ("My Crate") ----
  
  /**
   * Add a video to user's favorites
   */
  async addToFavorites(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const videoId = parseInt(req.params.id);
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      
      // Check if already in favorites
      const [existingFavorite] = await db
        .select()
        .from(favorites)
        .where(and(
          eq(favorites.userId, userId),
          eq(favorites.videoId, videoId)
        ));
      
      if (existingFavorite) {
        return res.status(409).json({ 
          message: 'Video already in favorites',
          favorite: existingFavorite
        });
      }
      
      // Add to favorites
      const [favorite] = await db
        .insert(favorites)
        .values({
          userId,
          videoId,
          addedAt: new Date()
        })
        .returning();
      
      res.status(201).json(favorite);
    } catch (error: any) {
      console.error('Error adding to favorites:', error);
      res.status(500).json({ message: error.message || 'Error adding to favorites' });
    }
  },
  
  /**
   * Remove a video from user's favorites
   */
  async removeFromFavorites(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const videoId = parseInt(req.params.id);
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      // Remove from favorites
      const result = await db
        .delete(favorites)
        .where(and(
          eq(favorites.userId, userId),
          eq(favorites.videoId, videoId)
        ))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ message: 'Video not found in favorites' });
      }
      
      res.json({ success: true, removed: result[0] });
    } catch (error: any) {
      console.error('Error removing from favorites:', error);
      res.status(500).json({ message: error.message || 'Error removing from favorites' });
    }
  },
  
  /**
   * Get user's favorite videos
   */
  async getFavorites(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      
      // Get favorites with video details
      const userFavorites = await db
        .select({
          favorite: favorites,
          video: videos
        })
        .from(favorites)
        .innerJoin(videos, eq(favorites.videoId, videos.id))
        .where(eq(favorites.userId, userId))
        .orderBy(desc(favorites.addedAt));
      
      res.json(userFavorites);
    } catch (error: any) {
      console.error('Error getting favorites:', error);
      res.status(500).json({ message: error.message || 'Error getting favorites' });
    }
  },
  
  /**
   * Check if a video is in user's favorites
   */
  async isFavorite(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const videoId = parseInt(req.params.id);
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      // Check if in favorites
      const [favorite] = await db
        .select()
        .from(favorites)
        .where(and(
          eq(favorites.userId, userId),
          eq(favorites.videoId, videoId)
        ));
      
      res.json({ isFavorite: !!favorite, favorite });
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
      res.status(500).json({ message: error.message || 'Error checking favorite status' });
    }
  },
  
  // ---- Playlists ----
  
  /**
   * Create a new playlist
   */
  async createPlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      
      // Validate request body
      const validatedData = insertPlaylistSchema.parse({
        ...req.body,
        userId
      });
      
      // Generate share token if playlist is public
      let shareToken = null;
      if (validatedData.isPublic) {
        shareToken = randomBytes(16).toString('hex');
      }
      
      // Create playlist
      const [playlist] = await db
        .insert(playlists)
        .values({
          ...validatedData,
          shareToken,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      res.status(201).json(playlist);
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      res.status(500).json({ message: error.message || 'Error creating playlist' });
    }
  },
  
  /**
   * Get user's playlists
   */
  async getPlaylists(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      
      // Get playlists with item count
      const userPlaylists = await db
        .select({
          playlist: playlists,
          itemCount: count(playlistItems.id)
        })
        .from(playlists)
        .leftJoin(playlistItems, eq(playlists.id, playlistItems.playlistId))
        .where(eq(playlists.userId, userId))
        .groupBy(playlists.id)
        .orderBy(desc(playlists.updatedAt));
      
      res.json(userPlaylists);
    } catch (error: any) {
      console.error('Error getting playlists:', error);
      res.status(500).json({ message: error.message || 'Error getting playlists' });
    }
  },
  
  /**
   * Get a specific playlist by ID
   */
  async getPlaylist(req: Request, res: Response) {
    try {
      const playlistId = parseInt(req.params.id);
      
      if (isNaN(playlistId)) {
        return res.status(400).json({ message: 'Invalid playlist ID' });
      }
      
      // Get playlist
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      // Check permissions - must be owner or playlist must be public
      if (!playlist.isPublic && (!req.user || req.user.id !== playlist.userId)) {
        return res.status(403).json({ message: 'You do not have permission to view this playlist' });
      }
      
      // Get playlist items with video details
      const playlistItemsWithVideos = await db
        .select({
          item: playlistItems,
          video: videos
        })
        .from(playlistItems)
        .innerJoin(videos, eq(playlistItems.videoId, videos.id))
        .where(eq(playlistItems.playlistId, playlistId))
        .orderBy(asc(playlistItems.position));
      
      res.json({
        playlist,
        items: playlistItemsWithVideos
      });
    } catch (error: any) {
      console.error('Error getting playlist:', error);
      res.status(500).json({ message: error.message || 'Error getting playlist' });
    }
  },
  
  /**
   * Update a playlist
   */
  async updatePlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const playlistId = parseInt(req.params.id);
      
      if (isNaN(playlistId)) {
        return res.status(400).json({ message: 'Invalid playlist ID' });
      }
      
      // Get existing playlist
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      // Check ownership
      if (playlist.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to update this playlist' });
      }
      
      // Validate update data
      const updateSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional().nullable(),
        isPublic: z.boolean().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      // Generate share token if becoming public
      let shareToken = playlist.shareToken;
      if (validatedData.isPublic === true && !playlist.isPublic) {
        shareToken = randomBytes(16).toString('hex');
      }
      
      // Update playlist
      const [updatedPlaylist] = await db
        .update(playlists)
        .set({
          ...validatedData,
          shareToken,
          updatedAt: new Date()
        })
        .where(eq(playlists.id, playlistId))
        .returning();
      
      res.json(updatedPlaylist);
    } catch (error: any) {
      console.error('Error updating playlist:', error);
      res.status(500).json({ message: error.message || 'Error updating playlist' });
    }
  },
  
  /**
   * Delete a playlist
   */
  async deletePlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const playlistId = parseInt(req.params.id);
      
      if (isNaN(playlistId)) {
        return res.status(400).json({ message: 'Invalid playlist ID' });
      }
      
      // Get existing playlist
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      // Check ownership
      if (playlist.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to delete this playlist' });
      }
      
      // Delete playlist (cascade will delete playlist items)
      await db
        .delete(playlists)
        .where(eq(playlists.id, playlistId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      res.status(500).json({ message: error.message || 'Error deleting playlist' });
    }
  },
  
  /**
   * Add a video to a playlist
   */
  async addToPlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const playlistId = parseInt(req.params.id);
      const { videoId } = req.body;
      
      if (isNaN(playlistId) || isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid ID parameters' });
      }
      
      // Check if playlist exists and user owns it
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      if (playlist.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to modify this playlist' });
      }
      
      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      
      // Check if video is already in playlist
      const [existingItem] = await db
        .select()
        .from(playlistItems)
        .where(and(
          eq(playlistItems.playlistId, playlistId),
          eq(playlistItems.videoId, videoId)
        ));
      
      if (existingItem) {
        return res.status(409).json({ 
          message: 'Video already in playlist',
          item: existingItem
        });
      }
      
      // Get highest position to add to end
      const [{ maxPosition }] = await db
        .select({
          maxPosition: sql<number>`COALESCE(MAX(position), 0)`
        })
        .from(playlistItems)
        .where(eq(playlistItems.playlistId, playlistId));
      
      // Add video to playlist
      const [item] = await db
        .insert(playlistItems)
        .values({
          playlistId,
          videoId,
          position: maxPosition + 1,
          addedAt: new Date()
        })
        .returning();
      
      // Update playlist updated_at
      await db
        .update(playlists)
        .set({ updatedAt: new Date() })
        .where(eq(playlists.id, playlistId));
      
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error adding to playlist:', error);
      res.status(500).json({ message: error.message || 'Error adding to playlist' });
    }
  },
  
  /**
   * Remove a video from a playlist
   */
  async removeFromPlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const playlistId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      
      if (isNaN(playlistId) || isNaN(itemId)) {
        return res.status(400).json({ message: 'Invalid ID parameters' });
      }
      
      // Check if playlist exists and user owns it
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      if (playlist.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to modify this playlist' });
      }
      
      // Remove item
      const [removedItem] = await db
        .delete(playlistItems)
        .where(and(
          eq(playlistItems.id, itemId),
          eq(playlistItems.playlistId, playlistId)
        ))
        .returning();
      
      if (!removedItem) {
        return res.status(404).json({ message: 'Item not found in playlist' });
      }
      
      // Reorder remaining items
      await db.execute(sql`
        WITH ranked AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY position) AS new_position
          FROM playlist_items
          WHERE playlist_id = ${playlistId}
        )
        UPDATE playlist_items pi
        SET position = r.new_position
        FROM ranked r
        WHERE pi.id = r.id
      `);
      
      // Update playlist updated_at
      await db
        .update(playlists)
        .set({ updatedAt: new Date() })
        .where(eq(playlists.id, playlistId));
      
      res.json({ success: true, removed: removedItem });
    } catch (error: any) {
      console.error('Error removing from playlist:', error);
      res.status(500).json({ message: error.message || 'Error removing from playlist' });
    }
  },
  
  /**
   * Reorder items in a playlist
   */
  async reorderPlaylist(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const playlistId = parseInt(req.params.id);
      const { itemIds } = req.body;
      
      if (isNaN(playlistId) || !Array.isArray(itemIds)) {
        return res.status(400).json({ message: 'Invalid request parameters' });
      }
      
      // Check if playlist exists and user owns it
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, playlistId));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      
      if (playlist.userId !== userId) {
        return res.status(403).json({ message: 'You do not have permission to modify this playlist' });
      }
      
      // Verify all items belong to the playlist
      const playlistItemCount = await db
        .select({ count: count() })
        .from(playlistItems)
        .where(eq(playlistItems.playlistId, playlistId));
      
      if (itemIds.length !== playlistItemCount[0].count) {
        return res.status(400).json({ message: 'Item count mismatch' });
      }
      
      // Update positions in bulk
      for (let i = 0; i < itemIds.length; i++) {
        await db
          .update(playlistItems)
          .set({ position: i + 1 })
          .where(and(
            eq(playlistItems.id, itemIds[i]),
            eq(playlistItems.playlistId, playlistId)
          ));
      }
      
      // Update playlist updated_at
      await db
        .update(playlists)
        .set({ updatedAt: new Date() })
        .where(eq(playlists.id, playlistId));
      
      // Get updated items
      const items = await db
        .select()
        .from(playlistItems)
        .where(eq(playlistItems.playlistId, playlistId))
        .orderBy(asc(playlistItems.position));
      
      res.json(items);
    } catch (error: any) {
      console.error('Error reordering playlist:', error);
      res.status(500).json({ message: error.message || 'Error reordering playlist' });
    }
  },
  
  /**
   * Get a playlist by share token (public access)
   */
  async getSharedPlaylist(req: Request, res: Response) {
    try {
      const token = req.params.token;
      
      if (!token) {
        return res.status(400).json({ message: 'Invalid token' });
      }
      
      // Get playlist by share token
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(and(
          eq(playlists.shareToken, token),
          eq(playlists.isPublic, true)
        ));
      
      if (!playlist) {
        return res.status(404).json({ message: 'Shared playlist not found' });
      }
      
      // Get playlist items with video details
      const playlistItemsWithVideos = await db
        .select({
          item: playlistItems,
          video: videos
        })
        .from(playlistItems)
        .innerJoin(videos, eq(playlistItems.videoId, videos.id))
        .where(eq(playlistItems.playlistId, playlist.id))
        .orderBy(asc(playlistItems.position));
      
      // Get playlist owner details
      const owner = await storage.getUser(playlist.userId);
      
      res.json({
        playlist,
        owner: owner ? { id: owner.id, username: owner.username } : null,
        items: playlistItemsWithVideos
      });
    } catch (error: any) {
      console.error('Error getting shared playlist:', error);
      res.status(500).json({ message: error.message || 'Error getting shared playlist' });
    }
  },
  
  /**
   * Bulk download playlist or favorites
   */
  async bulkDownload(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const { type, id, format } = req.body;
      
      if (!type || (type !== 'playlist' && type !== 'favorites')) {
        return res.status(400).json({ message: 'Invalid download type' });
      }
      
      if (type === 'playlist' && (!id || isNaN(parseInt(id)))) {
        return res.status(400).json({ message: 'Invalid playlist ID' });
      }
      
      // Get list of videos to download
      let videoIds: number[] = [];
      
      if (type === 'playlist') {
        const playlistId = parseInt(id);
        
        // Check playlist ownership
        const [playlist] = await db
          .select()
          .from(playlists)
          .where(eq(playlists.id, playlistId));
        
        if (!playlist) {
          return res.status(404).json({ message: 'Playlist not found' });
        }
        
        if (playlist.userId !== userId) {
          return res.status(403).json({ message: 'You do not have permission to download this playlist' });
        }
        
        // Get video IDs from playlist
        const items = await db
          .select()
          .from(playlistItems)
          .where(eq(playlistItems.playlistId, playlistId))
          .orderBy(asc(playlistItems.position));
        
        videoIds = items.map(item => item.videoId);
      } else {
        // Get video IDs from favorites
        const userFavorites = await db
          .select()
          .from(favorites)
          .where(eq(favorites.userId, userId));
        
        videoIds = userFavorites.map(fav => fav.videoId);
      }
      
      if (videoIds.length === 0) {
        return res.status(404).json({ message: 'No videos found to download' });
      }
      
      // Process download for each video
      const downloadResults = await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            // Get video
            const video = await storage.getVideo(videoId);
            if (!video) {
              return { videoId, success: false, message: 'Video not found' };
            }
            
            // Process download
            const downloadResult = await req.downloadService.processDownload(userId, videoId, format || 'original');
            return { videoId, ...downloadResult };
          } catch (error: any) {
            return { videoId, success: false, message: error.message || 'Error processing download' };
          }
        })
      );
      
      // Return download URLs and results
      res.json({
        success: true,
        count: videoIds.length,
        results: downloadResults
      });
    } catch (error: any) {
      console.error('Error processing bulk download:', error);
      res.status(500).json({ message: error.message || 'Error processing bulk download' });
    }
  }
};