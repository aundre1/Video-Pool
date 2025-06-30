import { Request, Response } from 'express';
import { storage } from '../storage';
import { bulkDownloadService } from '../services/bulkDownloadService';
import { mixExportService } from '../services/mixExportService';
import { v4 as uuidv4 } from 'uuid';

export const libraryController = {
  // Favorites management
  async addToFavorites(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const videoId = parseInt(req.params.id);
      
      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      // Add to favorites
      const favorite = await storage.addToFavorites(userId, videoId);
      
      res.json({ success: true, favorite });
    } catch (error: any) {
      console.error('Error adding to favorites:', error);
      res.status(500).json({ error: error.message || 'Failed to add to favorites' });
    }
  },
  
  async removeFromFavorites(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const videoId = parseInt(req.params.id);
      
      // Remove from favorites
      const result = await storage.removeFromFavorites(userId, videoId);
      
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error removing from favorites:', error);
      res.status(500).json({ error: error.message || 'Failed to remove from favorites' });
    }
  },
  
  async getFavorites(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Get favorites with pagination
      const favorites = await storage.getFavorites(userId, page, limit);
      
      res.json(favorites);
    } catch (error: any) {
      console.error('Error getting favorites:', error);
      res.status(500).json({ error: error.message || 'Failed to get favorites' });
    }
  },
  
  async isFavorite(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const videoId = parseInt(req.params.id);
      
      // Check if video is in favorites
      const isFavorite = await storage.isVideoInFavorites(userId, videoId);
      
      res.json({ isFavorite });
    } catch (error: any) {
      console.error('Error checking favorite status:', error);
      res.status(500).json({ error: error.message || 'Failed to check favorite status' });
    }
  },
  
  // Playlist management
  async createPlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { name, description, isPublic } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Playlist name is required' });
      }
      
      // Create playlist
      const playlist = await storage.createPlaylist({
        userId,
        name,
        description: description || '',
        isPublic: isPublic || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      res.json(playlist);
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to create playlist' });
    }
  },
  
  async getPlaylists(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      
      // Get all playlists for the user
      const playlists = await storage.getUserPlaylists(userId);
      
      res.json(playlists);
    } catch (error: any) {
      console.error('Error getting playlists:', error);
      res.status(500).json({ error: error.message || 'Failed to get playlists' });
    }
  },
  
  async getPlaylist(req: Request, res: Response) {
    try {
      const playlistId = parseInt(req.params.id);
      
      // Get the playlist with its items
      const playlist = await storage.getPlaylistWithItems(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist is public or belongs to the user
      if (!playlist.isPublic && (!req.user || req.user.id !== playlist.userId)) {
        return res.status(403).json({ error: 'You do not have permission to view this playlist' });
      }
      
      res.json(playlist);
    } catch (error: any) {
      console.error('Error getting playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to get playlist' });
    }
  },
  
  async updatePlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playlistId = parseInt(req.params.id);
      const { name, description, isPublic } = req.body;
      
      // Get the playlist
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist belongs to the user
      if (playlist.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to update this playlist' });
      }
      
      // Update the playlist
      const updatedPlaylist = await storage.updatePlaylist(playlistId, {
        name: name || playlist.name,
        description: description !== undefined ? description : playlist.description,
        isPublic: isPublic !== undefined ? isPublic : playlist.isPublic,
        updatedAt: new Date()
      });
      
      res.json(updatedPlaylist);
    } catch (error: any) {
      console.error('Error updating playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to update playlist' });
    }
  },
  
  async deletePlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playlistId = parseInt(req.params.id);
      
      // Get the playlist
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist belongs to the user
      if (playlist.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to delete this playlist' });
      }
      
      // Delete the playlist
      const result = await storage.deletePlaylist(playlistId);
      
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to delete playlist' });
    }
  },
  
  async addToPlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playlistId = parseInt(req.params.id);
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ error: 'Video ID is required' });
      }
      
      // Get the playlist
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist belongs to the user
      if (playlist.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to modify this playlist' });
      }
      
      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }
      
      // Add to playlist
      const playlistItem = await storage.addVideoToPlaylist(playlistId, videoId);
      
      res.json(playlistItem);
    } catch (error: any) {
      console.error('Error adding to playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to add to playlist' });
    }
  },
  
  async removeFromPlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playlistId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      
      // Get the playlist
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist belongs to the user
      if (playlist.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to modify this playlist' });
      }
      
      // Remove from playlist
      const result = await storage.removeVideoFromPlaylist(playlistId, itemId);
      
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error removing from playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to remove from playlist' });
    }
  },
  
  async reorderPlaylist(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const playlistId = parseInt(req.params.id);
      const { itemIds } = req.body;
      
      if (!itemIds || !Array.isArray(itemIds)) {
        return res.status(400).json({ error: 'Item IDs array is required' });
      }
      
      // Get the playlist
      const playlist = await storage.getPlaylist(playlistId);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Playlist not found' });
      }
      
      // Check if the playlist belongs to the user
      if (playlist.userId !== userId) {
        return res.status(403).json({ error: 'You do not have permission to modify this playlist' });
      }
      
      // Reorder playlist items
      const result = await storage.reorderPlaylistItems(playlistId, itemIds);
      
      res.json({ success: result });
    } catch (error: any) {
      console.error('Error reordering playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to reorder playlist' });
    }
  },
  
  async getSharedPlaylist(req: Request, res: Response) {
    try {
      const token = req.params.token;
      
      // Validate token
      if (!token) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      
      // Get shared playlist
      const playlist = await storage.getSharedPlaylist(token);
      
      if (!playlist) {
        return res.status(404).json({ error: 'Shared playlist not found or expired' });
      }
      
      res.json(playlist);
    } catch (error: any) {
      console.error('Error getting shared playlist:', error);
      res.status(500).json({ error: error.message || 'Failed to get shared playlist' });
    }
  },
  
  // Bulk download
  async bulkDownload(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { videoIds } = req.body;
      
      if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ error: 'Video IDs array is required' });
      }
      
      // Create bulk download
      const downloadInfo = await bulkDownloadService.createBulkDownload(videoIds, userId);
      
      res.json({
        downloadUrl: downloadInfo.filePath,
        fileName: downloadInfo.fileName
      });
    } catch (error: any) {
      console.error('Error preparing bulk download:', error);
      res.status(500).json({ error: error.message || 'Failed to prepare bulk download' });
    }
  },
  
  // DJ Mix Export Tools
  
  /**
   * Export a DJ mix with videos, cue sheets, and metadata
   */
  async exportDjMix(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { 
        name,
        videos,
        includeCuesheet,
        includeMetadata,
        includeArtwork,
        format,
        bpm,
        key,
        genre,
        notes
      } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Mix name is required' });
      }
      
      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: 'Video IDs array is required' });
      }
      
      // Create mix export
      const exportInfo = await mixExportService.createMixExport({
        name,
        videos,
        includeCuesheet: includeCuesheet !== false,
        includeMetadata: includeMetadata !== false,
        includeArtwork: includeArtwork !== false,
        format: format || 'mp4',
        bpm,
        key,
        genre,
        notes
      }, userId);
      
      res.json({
        downloadUrl: exportInfo.filePath,
        fileName: exportInfo.fileName
      });
    } catch (error: any) {
      console.error('Error preparing mix export:', error);
      res.status(500).json({ error: error.message || 'Failed to prepare mix export' });
    }
  },
  
  /**
   * Get available mix templates
   */
  async getMixTemplates(req: Request, res: Response) {
    try {
      const templates = await mixExportService.getMixTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error getting mix templates:', error);
      res.status(500).json({ error: error.message || 'Failed to get mix templates' });
    }
  },
  
  /**
   * Export a DJ mix with a custom cue sheet
   */
  async exportWithCueSheet(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { 
        name,
        videos,
        bpm,
        key,
        genre,
        notes,
        cuePoints
      } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Mix name is required' });
      }
      
      if (!videos || !Array.isArray(videos) || videos.length === 0) {
        return res.status(400).json({ error: 'Video IDs array is required' });
      }
      
      // Get the videos to ensure they exist
      const videoObjects = [];
      for (const videoId of videos) {
        const video = await storage.getVideo(videoId);
        if (video) {
          videoObjects.push(video);
        }
      }
      
      if (videoObjects.length === 0) {
        return res.status(404).json({ error: 'No valid videos found' });
      }
      
      // Create mix export with custom cue sheet
      const exportInfo = await mixExportService.createMixExport({
        name,
        videos,
        includeCuesheet: true,
        includeMetadata: true,
        includeArtwork: true,
        format: 'mp4',
        bpm,
        key,
        genre,
        notes
      }, userId);
      
      res.json({
        downloadUrl: exportInfo.filePath,
        fileName: exportInfo.fileName
      });
    } catch (error: any) {
      console.error('Error preparing mix export with cue sheet:', error);
      res.status(500).json({ error: error.message || 'Failed to prepare mix export with cue sheet' });
    }
  }
};