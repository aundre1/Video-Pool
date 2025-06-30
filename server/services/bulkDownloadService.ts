import { storageService } from './storageService';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { access, mkdir, unlink } from 'fs/promises';
import { constants } from 'fs';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// Temporary directory for bulk downloads
const TEMP_DIR = join(process.cwd(), 'temp', 'bulk-downloads');

// Ensure temp directory exists
async function ensureTempDirExists() {
  try {
    await access(TEMP_DIR, constants.F_OK);
  } catch (e) {
    await mkdir(TEMP_DIR, { recursive: true });
  }
}

// Initialize temp directory
ensureTempDirExists();

/**
 * Service for handling bulk video downloads
 */
export const bulkDownloadService = {
  /**
   * Create a bulk download ZIP with multiple videos
   * @param videoIds Array of video IDs to include in the download
   * @param userId User ID requesting the download
   * @returns Object with download info (filename, path)
   */
  async createBulkDownload(videoIds: number[], userId: number): Promise<{ 
    fileName: string; 
    filePath: string;
    tempFilePath: string;
  }> {
    // Validate input
    if (!videoIds || videoIds.length === 0) {
      throw new Error('No videos specified for bulk download');
    }
    
    // Check if user has access to all videos
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has an active membership
    if (!user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date()) {
      throw new Error('Active membership required for bulk downloads');
    }
    
    // Get videos
    const videos = [];
    for (const videoId of videoIds) {
      const video = await storage.getVideo(videoId);
      if (!video) {
        continue; // Skip videos that don't exist
      }
      
      // Skip premium videos if user doesn't have premium access
      if (video.isPremium && (!user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date())) {
        continue;
      }
      
      videos.push(video);
    }
    
    if (videos.length === 0) {
      throw new Error('No accessible videos found for bulk download');
    }
    
    // Check if user has enough download credits
    const membership = await storage.getMembership(user.membershipId);
    if (!membership) {
      throw new Error('Membership not found');
    }
    
    const downloadsUsed = user.downloadsUsed || 0;
    const downloadsRemaining = membership.downloadLimit - downloadsUsed;
    
    if (downloadsRemaining < videos.length) {
      throw new Error(`Not enough download credits. You need ${videos.length} credits but have ${downloadsRemaining} remaining.`);
    }
    
    // Create a unique filename for the bulk download ZIP
    const zipFileName = `bulk-download-${uuidv4()}.zip`;
    const zipFilePath = join(TEMP_DIR, zipFileName);
    
    // Create a write stream for the ZIP file
    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level (1-9)
    });
    
    // Set up the archive
    archive.pipe(output);
    
    // Add videos to the archive
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      try {
        // Get video stream
        let videoStream;
        try {
          videoStream = await storageService.getVideoStream(video.videoUrl);
        } catch (e) {
          console.error(`Error getting video stream for ${video.id}:`, e);
          continue;
        }
        
        // Create sanitized filename
        const sanitizedTitle = video.title
          .replace(/[^\w\s.-]/g, '') // Remove special chars except spaces, dots, and hyphens
          .replace(/\s+/g, '_');  // Replace spaces with underscores
        
        const fileExtension = video.videoUrl.split('.').pop() || 'mp4';
        const filename = `${String(i+1).padStart(2, '0')}_${sanitizedTitle}.${fileExtension}`;
        
        // Add video to archive
        archive.append(videoStream, { name: filename });
        
        // Update download count for each video
        await storage.incrementVideoDownloadCount(video.id);
      } catch (error) {
        console.error(`Error adding video ${video.id} to archive:`, error);
        // Continue with other videos
      }
    }
    
    // Add a README file
    const readmeContent = `# Bulk Download from TheVideoPool.com

This download package contains the following videos:
${videos.map((video, index) => `${index + 1}. ${video.title}`).join('\n')}

Files are organized by number for easy sorting and playback.

For support, contact info@thevideopool.com

© ${new Date().getFullYear()} TheVideoPool.com - All rights reserved
`;
    
    archive.append(readmeContent, { name: 'README.txt' });
    
    // Finalize the archive
    await new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        resolve();
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
      
      archive.finalize();
    });
    
    // Update user's download count
    const newDownloadCount = downloadsUsed + videos.length;
    await storage.updateUser(userId, { 
      downloadsUsed: newDownloadCount 
    });
    
    // Record the downloads
    for (const video of videos) {
      await storage.createDownload({
        userId,
        videoId: video.id,
        downloadedAt: new Date(),
      });
    }
    
    // Return info about the generated ZIP file
    return {
      fileName: zipFileName,
      filePath: `/api/downloads/bulk/${zipFileName}`,
      tempFilePath: zipFilePath
    };
  },
  
  /**
   * Get a stream for an existing bulk download
   * @param fileName Name of the ZIP file
   * @returns Readable stream of the ZIP file
   */
  async getDownloadStream(fileName: string): Promise<NodeJS.ReadableStream> {
    const filePath = join(TEMP_DIR, fileName);
    
    try {
      // Check if file exists
      await access(filePath, constants.F_OK);
      
      // Create a read stream
      const readStream = Readable.from(await import('fs').then(fs => fs.readFileSync(filePath)));
      
      // Create a pass-through stream with metadata
      const stream = new PassThrough();
      
      // Add metadata to the stream
      const stats = await import('fs/promises').then(fs => fs.stat(filePath));
      (stream as any).fileSize = stats.size;
      (stream as any).mimeType = 'application/zip';
      (stream as any).fileName = fileName;
      
      // Pipe the read stream to the pass-through stream
      readStream.pipe(stream);
      
      return stream;
    } catch (error) {
      throw new Error(`Bulk download file not found: ${fileName}`);
    }
  },
  
  /**
   * Delete a temporary bulk download file
   * @param fileName Name of the ZIP file to delete
   */
  async cleanupTempFile(fileName: string): Promise<void> {
    const filePath = join(TEMP_DIR, fileName);
    
    try {
      await access(filePath, constants.F_OK);
      await unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  },
  
  /**
   * Clean up old temporary bulk download files
   * @param maxAgeHours Maximum age in hours before files are deleted (default: 24)
   */
  async cleanupOldTempFiles(maxAgeHours: number = 24): Promise<number> {
    try {
      const files = await import('fs/promises').then(fs => fs.readdir(TEMP_DIR));
      const now = new Date();
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = join(TEMP_DIR, file);
        const stats = await import('fs/promises').then(fs => fs.stat(filePath));
        
        // Skip if not a file or doesn't match our pattern
        if (!stats.isFile() || !file.startsWith('bulk-download-')) {
          continue;
        }
        
        // Calculate file age in hours
        const fileAge = (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60);
        
        // Delete if older than max age
        if (fileAge > maxAgeHours) {
          await unlink(filePath);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old bulk download files:', error);
      return 0;
    }
  }
};