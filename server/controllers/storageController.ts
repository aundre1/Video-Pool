import { Request, Response } from 'express';
import { storageService } from '../services/storageService';
import { storage } from '../storage';
import { basename } from 'path';
import { Readable } from 'stream';

export const storageController = {
  /**
   * Stream a video file
   */
  async streamVideo(req: Request, res: Response) {
    try {
      const videoId = parseInt(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Get video details
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      
      // Check if the user has permission to access the video
      // For premium videos, check if the user has an active membership
      if (video.isPremium) {
        const user = await storage.getUser(userId);
        if (!user?.membershipId || !user?.membershipEndDate || new Date(user.membershipEndDate) < new Date()) {
          return res.status(403).json({ message: 'Premium membership required to access this video' });
        }
      }
      
      // Generate secure access URL
      const videoUrl = await storageService.generateSignedUrl(videoId, userId);
      
      // If using cloud storage with CDN, redirect to the signed URL
      if (storageService.isCloudEnabled() && !videoUrl.startsWith('/api/')) {
        return res.redirect(videoUrl);
      }
      
      // For local storage, stream the video
      const key = basename(video.videoUrl);
      const stream = await storageService.getVideoStream(key);
      
      // Handle range requests for streaming
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : undefined;
        
        // Set headers for partial content
        res.status(206);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Range', `bytes ${start}-${end || ''}/`);
        
        // Create a slice of the stream
        if (stream instanceof Readable) {
          const slicedStream = stream;
          // Forward the stream
          slicedStream.pipe(res);
        } else {
          res.status(500).json({ message: 'Stream error' });
        }
      } else {
        // Stream the entire file
        res.setHeader('Content-Type', 'video/mp4');
        if (stream instanceof Readable) {
          stream.pipe(res);
        } else {
          res.status(500).json({ message: 'Stream error' });
        }
      }
    } catch (error: any) {
      console.error('Error streaming video:', error);
      res.status(500).json({ message: error.message || 'Error streaming video' });
    }
  },
  
  /**
   * Stream a video preview - anyone can access preview (no auth required)
   */
  async streamPreview(req: Request, res: Response) {
    try {
      const previewKey = req.params.key;
      
      // Stream the preview
      const stream = await storageService.getPreviewStream(previewKey);
      
      res.setHeader('Content-Type', 'video/mp4');
      if (stream instanceof Readable) {
        stream.pipe(res);
      } else {
        res.status(500).json({ message: 'Stream error' });
      }
    } catch (error: any) {
      console.error('Error streaming preview:', error);
      res.status(500).json({ message: error.message || 'Error streaming preview' });
    }
  },
  
  /**
   * Serve a thumbnail image - anyone can access thumbnail (no auth required)
   */
  async serveThumbnail(req: Request, res: Response) {
    try {
      const thumbnailKey = req.params.key;
      
      // Stream the thumbnail
      const stream = await storageService.getThumbnailStream(thumbnailKey);
      
      res.setHeader('Content-Type', 'image/jpeg');
      if (stream instanceof Readable) {
        stream.pipe(res);
      } else {
        res.status(500).json({ message: 'Stream error' });
      }
    } catch (error: any) {
      console.error('Error serving thumbnail:', error);
      res.status(500).json({ message: error.message || 'Error serving thumbnail' });
    }
  },
  
  /**
   * Download a video file (authenticated, tracks download quota)
   */
  async downloadVideo(req: Request, res: Response) {
    try {
      const videoId = parseInt(req.params.id);
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Get video details
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
      
      // Check if the user has permission to download the video
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Check if the user has an active membership for premium content
      if (video.isPremium && (!user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date())) {
        return res.status(403).json({ message: 'Premium membership required to download this video' });
      }
      
      // Check download limits
      // This assumes the user object has properties: downloadsUsed and downloadsRemaining
      if (user.downloadsRemaining <= 0) {
        return res.status(403).json({ message: 'Download limit reached' });
      }
      
      // Generate secure access URL
      const videoUrl = await storageService.generateSignedUrl(videoId, userId);
      
      // Track the download
      await storage.createDownload({
        userId,
        videoId,
        downloadedAt: new Date()
      });
      
      // Increment the download count for the video
      await storage.incrementVideoDownloadCount(videoId);
      
      // Update user's download count (adjust based on your actual storage interface)
      // This might need to be implemented in your storage.ts file
      if (typeof storage.updateUserDownloadCount === 'function') {
        await storage.updateUserDownloadCount(userId, 1);
      }
      
      // If using cloud storage with CDN, redirect to the signed URL
      if (storageService.isCloudEnabled() && !videoUrl.startsWith('/api/')) {
        // Set download headers
        res.setHeader('Content-Disposition', `attachment; filename="${video.title.replace(/[^a-zA-Z0-9.-]/g, '_')}.mp4"`);
        return res.redirect(videoUrl);
      }
      
      // For local storage, stream the file for download
      const key = basename(video.videoUrl);
      const stream = await storageService.getVideoStream(key);
      
      // Set download headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${video.title.replace(/[^a-zA-Z0-9.-]/g, '_')}.mp4"`);
      
      if (stream instanceof Readable) {
        stream.pipe(res);
      } else {
        res.status(500).json({ message: 'Download error' });
      }
    } catch (error: any) {
      console.error('Error downloading video:', error);
      res.status(500).json({ message: error.message || 'Error downloading video' });
    }
  }
};