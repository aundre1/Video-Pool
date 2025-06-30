import { videos, downloads, users } from '@shared/schema';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

export interface DownloadFormat {
  id: string;
  name: string;
  extension: string;
  resolution: string;
  filesize: number; // in bytes
  bitrate: number; // in kbps
}

export interface DownloadResponse {
  success: boolean;
  downloadUrl?: string;
  message?: string;
  downloadId?: number;
  resumeToken?: string;
}

export const downloadService = {
  /**
   * Get available download formats for a video
   */
  async getAvailableFormats(videoId: number): Promise<DownloadFormat[]> {
    // Get the original video to determine available formats
    const [video] = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId));
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    // In a real implementation, this would come from a transcoding service
    // that generates multiple versions of each video
    const formats: DownloadFormat[] = [
      {
        id: 'original',
        name: 'Original Quality',
        extension: 'mp4',
        resolution: video.resolution,
        filesize: 450 * 1024 * 1024, // ~450MB for original quality
        bitrate: 8500
      },
      {
        id: 'high',
        name: 'High Quality',
        extension: 'mp4',
        resolution: '1080p',
        filesize: 250 * 1024 * 1024, // ~250MB
        bitrate: 5000
      },
      {
        id: 'medium',
        name: 'Medium Quality',
        extension: 'mp4',
        resolution: '720p',
        filesize: 125 * 1024 * 1024, // ~125MB
        bitrate: 2500
      },
      {
        id: 'low',
        name: 'Low Quality (Mobile)',
        extension: 'mp4',
        resolution: '480p',
        filesize: 60 * 1024 * 1024, // ~60MB
        bitrate: 1200
      },
      {
        id: 'webm',
        name: 'WebM Format',
        extension: 'webm',
        resolution: '720p',
        filesize: 110 * 1024 * 1024, // ~110MB
        bitrate: 2200
      },
      {
        id: 'looped-mp4',
        name: 'MP4 (30 Second Loop)',
        extension: 'mp4',
        resolution: '720p',
        filesize: 35 * 1024 * 1024, // ~35MB
        bitrate: 2500
      }
    ];
    
    return formats;
  },
  
  /**
   * Process download request from a user
   */
  async processDownload(userId: number, videoId: number, formatId: string = 'original'): Promise<DownloadResponse> {
    try {
      // 1. Verify the user exists and has download permissions
      const user = await storage.getUser(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      // 2. Verify video exists and is accessible to the user
      const video = await storage.getVideo(videoId);
      if (!video) {
        return { success: false, message: 'Video not found' };
      }
      
      // 3. Check if the video is premium and if the user has membership
      if (video.isPremium && (!user.membershipId || user.downloadsRemaining === 0)) {
        return { 
          success: false, 
          message: user.membershipId 
            ? 'You have used all your download credits for this period'
            : 'This video requires a premium membership'
        };
      }
      
      // 4. Get the available formats
      const formats = await this.getAvailableFormats(videoId);
      const selectedFormat = formats.find(f => f.id === formatId);
      if (!selectedFormat) {
        return { success: false, message: 'Invalid format selected' };
      }
      
      // 5. Record the download in the database
      const downloadRecord = await storage.createDownload({
        userId,
        videoId,
        downloadedAt: new Date(),
        format: formatId,
        ipAddress: '127.0.0.1', // Would be the actual IP in production
        userAgent: 'API Client', // Would be the actual UA in production
      });
      
      // 6. Increment video download count
      await storage.incrementVideoDownloadCount(videoId);
      
      // 7. Update user's download quota if premium video
      if (video.isPremium && user.downloadsRemaining !== null) {
        await storage.updateUser(userId, {
          downloadsRemaining: Math.max(0, user.downloadsRemaining - 1),
          downloadsUsed: (user.downloadsUsed || 0) + 1
        });
      }
      
      // 8. Generate a signed download URL with a resume token
      // In production, this would be a signed URL with expiration
      const resumeToken = this.generateResumeToken(videoId, userId, formatId);
      const downloadUrl = `/api/videos/${videoId}/download/${formatId}?token=${resumeToken}`;
      
      return {
        success: true,
        downloadUrl,
        downloadId: downloadRecord.id,
        resumeToken
      };
    } catch (error) {
      console.error('Error processing download:', error);
      return { success: false, message: 'An error occurred processing your download' };
    }
  },
  
  /**
   * Generate a secure token for resumable downloads
   */
  generateResumeToken(videoId: number, userId: number, formatId: string): string {
    // In a real implementation, this would be a signed JWT or similar
    // For this demo, we'll just use a simple encoded string
    const timestamp = Date.now();
    const tokenData = `${videoId}:${userId}:${formatId}:${timestamp}`;
    
    // In production, encrypt and sign this token
    return Buffer.from(tokenData).toString('base64');
  },
  
  /**
   * Verify a resume token is valid
   */
  verifyResumeToken(token: string, videoId: number, userId: number): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [tokenVideoId, tokenUserId, formatId, timestamp] = decoded.split(':');
      
      // Check that the token is for the right video and user
      if (Number(tokenVideoId) !== videoId || Number(tokenUserId) !== userId) {
        return false;
      }
      
      // Check that the token hasn't expired (2 hours)
      const tokenTime = Number(timestamp);
      const expiry = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      if (Date.now() - tokenTime > expiry) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  },
  
  /**
   * Stream a video file for download with support for range requests
   */
  async streamDownload(videoId: number, userId: number, formatId: string, token: string, range?: string): Promise<{
    stream: fs.ReadStream;
    fileSize: number;
    fileName: string;
    mimeType: string;
    rangeResponse?: {
      start: number;
      end: number;
      length: number;
    };
  }> {
    // 1. Verify the token
    const isValidToken = this.verifyResumeToken(token, videoId, userId);
    if (!isValidToken) {
      throw new Error('Invalid or expired download token');
    }
    
    // 2. Get the video 
    const video = await storage.getVideo(videoId);
    if (!video) {
      throw new Error('Video not found');
    }
    
    // 3. Get the format details
    const formats = await this.getAvailableFormats(videoId);
    const format = formats.find(f => f.id === formatId);
    if (!format) {
      throw new Error('Invalid format selected');
    }
    
    // 4. Generate file path
    // In production, this would be a path in cloud storage or similar
    // Here we're simulating it with the video URL as the file path
    const filePath = video.videoUrl;
    
    // In a real implementation, you would check if the file exists
    // For this demo, we'll assume it does
    const fileSize = format.filesize;
    
    // 5. Set up the file name for download
    const fileName = `${video.title.replace(/[^\w\s]/gi, '')}_${format.resolution}.${format.extension}`;
    
    // 6. Determine mime type based on extension
    const mimeType = format.extension === 'mp4' 
      ? 'video/mp4' 
      : format.extension === 'webm'
        ? 'video/webm'
        : 'application/octet-stream';
    
    // 7. Handle range requests for resumable downloads
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      // In a real implementation, this would create a read stream from the actual file
      // For this demo, we're simulating it
      const stream = fs.createReadStream(filePath, { start, end });
      
      return {
        stream,
        fileSize,
        fileName,
        mimeType,
        rangeResponse: {
          start,
          end, 
          length: chunkSize
        }
      };
    }
    
    // 8. Full file download (no range)
    const stream = fs.createReadStream(filePath);
    
    return {
      stream,
      fileSize,
      fileName,
      mimeType
    };
  }
};