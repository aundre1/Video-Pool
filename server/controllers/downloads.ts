import { Request, Response } from 'express';
import { downloadService } from '../services/downloadService';

export const downloadsController = {
  /**
   * Get available download formats for a video
   */
  async getAvailableFormats(req: Request, res: Response) {
    try {
      const videoId = parseInt(req.params.id);
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      const formats = await downloadService.getAvailableFormats(videoId);
      res.json(formats);
    } catch (error: any) {
      console.error('Error getting download formats:', error);
      res.status(500).json({ message: error.message || 'Error getting download formats' });
    }
  },
  
  /**
   * Initiate a download (generates token and URL)
   */
  async initiateDownload(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const videoId = parseInt(req.params.id);
      const formatId = req.query.format as string || 'original';
      
      if (isNaN(videoId)) {
        return res.status(400).json({ message: 'Invalid video ID' });
      }
      
      const downloadResult = await downloadService.processDownload(userId, videoId, formatId);
      
      if (!downloadResult.success) {
        return res.status(400).json({ message: downloadResult.message });
      }
      
      res.json(downloadResult);
    } catch (error: any) {
      console.error('Error initiating download:', error);
      res.status(500).json({ message: error.message || 'Error initiating download' });
    }
  },
  
  /**
   * Stream the video file for download
   */
  async downloadVideo(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const videoId = parseInt(req.params.id);
      const formatId = req.params.formatId;
      const token = req.query.token as string;
      
      if (isNaN(videoId) || !token || !formatId) {
        return res.status(400).json({ message: 'Invalid request parameters' });
      }
      
      // Check if token is valid
      const isValidToken = downloadService.verifyResumeToken(token, videoId, userId);
      if (!isValidToken) {
        return res.status(403).json({ message: 'Invalid or expired download token' });
      }
      
      // Handle range requests for resumable downloads
      const range = req.headers.range;
      
      try {
        const {
          stream,
          fileSize,
          fileName,
          mimeType,
          rangeResponse
        } = await downloadService.streamDownload(videoId, userId, formatId, token, range);
        
        // Set headers for the download
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', mimeType);
        
        // If it's a range request, handle it accordingly
        if (range && rangeResponse) {
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Range', `bytes ${rangeResponse.start}-${rangeResponse.end}/${fileSize}`);
          res.setHeader('Content-Length', rangeResponse.length);
          res.status(206); // Partial Content
        } else {
          res.setHeader('Content-Length', fileSize);
        }
        
        // Stream the file
        stream.pipe(res);
      } catch (error: any) {
        console.error('Error streaming video file:', error);
        res.status(500).json({ message: error.message || 'Error streaming video file' });
      }
      
    } catch (error: any) {
      console.error('Error downloading video:', error);
      res.status(500).json({ message: error.message || 'Error downloading video' });
    }
  },
  
  /**
   * Get user's download history
   */
  async getUserDownloads(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: 'Invalid limit parameter' });
      }
      
      // Get recent user downloads with video details
      const userDownloads = await req.storage.getRecentUserDownloads(userId, limit);
      res.json(userDownloads);
      
    } catch (error: any) {
      console.error('Error getting user downloads:', error);
      res.status(500).json({ message: error.message || 'Error getting user downloads' });
    }
  }
};