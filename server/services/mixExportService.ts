import { storageService } from './storageService';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { join } from 'path';
import { createWriteStream, writeFileSync } from 'fs';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import archiver from 'archiver';
import { PassThrough } from 'stream';

// Temporary directory for mix exports
const TEMP_DIR = join(process.cwd(), 'temp', 'mixes');

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

interface MixExportOptions {
  name: string;
  videos: number[];
  includeCuesheet: boolean;
  includeMetadata: boolean;
  includeArtwork: boolean;
  format: 'mp4' | 'jpg' | 'both';
  bpm?: number;
  key?: string;
  genre?: string;
  notes?: string;
}

interface CuesheetEntry {
  index: number;
  title: string;
  artist?: string;
  startTime: number; // in seconds
  endTime?: number; // in seconds
  fileName: string;
}

/**
 * Service for DJ Mix exports including cue sheets and metadata
 */
export const mixExportService = {
  /**
   * Export a mix with videos, cue sheets, and metadata
   * @param options Mix export options
   * @param userId User ID requesting the export
   * @returns Object with download info (filename, path)
   */
  async createMixExport(options: MixExportOptions, userId: number): Promise<{ 
    fileName: string; 
    filePath: string;
    tempFilePath: string;
  }> {
    // Validate input
    if (!options.videos || options.videos.length === 0) {
      throw new Error('No videos specified for mix export');
    }
    
    // Check if user has access to all videos
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user has an active membership
    if (!user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date()) {
      throw new Error('Active membership required for mix exports');
    }
    
    // Get videos
    const videos = [];
    let totalDuration = 0;
    for (const videoId of options.videos) {
      const video = await storage.getVideo(videoId);
      if (!video) {
        continue; // Skip videos that don't exist
      }
      
      // Skip premium videos if user doesn't have premium access
      if (video.isPremium && (!user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date())) {
        continue;
      }
      
      videos.push(video);
      totalDuration += video.duration || 0;
    }
    
    if (videos.length === 0) {
      throw new Error('No accessible videos found for mix export');
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
    
    // Create a unique filename for the mix export ZIP
    const sanitizedName = options.name
      .replace(/[^\w\s.-]/g, '') // Remove special chars except spaces, dots, and hyphens
      .replace(/\s+/g, '_');  // Replace spaces with underscores
      
    const zipFileName = `mix-${sanitizedName}-${uuidv4()}.zip`;
    const zipFilePath = join(TEMP_DIR, zipFileName);
    
    // Create a write stream for the ZIP file
    const output = createWriteStream(zipFilePath);
    const archive = archiver('zip', {
      zlib: { level: 5 } // Compression level (1-9)
    });
    
    // Set up the archive
    archive.pipe(output);
    
    // Create cue sheet data
    const cuesheet: CuesheetEntry[] = [];
    let currentTime = 0;
    
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
        
        // Add to cuesheet
        cuesheet.push({
          index: i + 1,
          title: video.title,
          startTime: currentTime,
          endTime: currentTime + (video.duration || 0),
          fileName: filename
        });
        
        // Update current time for next video
        currentTime += video.duration || 0;
        
        // Add video to archive based on format preference
        if (options.format === 'mp4' || options.format === 'both') {
          archive.append(videoStream, { name: `videos/${filename}` });
        }
        
        // If thumbnail is requested, add it too
        if (options.includeArtwork) {
          try {
            const thumbnailStream = await storageService.getVideoStream(video.thumbnailUrl, 'thumbnail');
            const thumbnailExt = video.thumbnailUrl.split('.').pop() || 'jpg';
            archive.append(thumbnailStream, { 
              name: `artwork/${sanitizedTitle}.${thumbnailExt}` 
            });
          } catch (e) {
            console.error(`Error adding thumbnail for ${video.id}:`, e);
            // Continue without thumbnail
          }
        }
        
        // Update download count for each video
        await storage.incrementVideoDownloadCount(video.id);
      } catch (error) {
        console.error(`Error adding video ${video.id} to archive:`, error);
        // Continue with other videos
      }
    }
    
    // Add cue sheet if requested
    if (options.includeCuesheet) {
      let cuesheetContent = `TITLE "${options.name}"\n`;
      if (options.genre) cuesheetContent += `GENRE "${options.genre}"\n`;
      if (options.bpm) cuesheetContent += `COMMENT "BPM: ${options.bpm}"\n`;
      if (options.key) cuesheetContent += `COMMENT "Key: ${options.key}"\n`;
      cuesheetContent += `FILE "${options.name}.mp4" MP4\n`;
      
      // Add track entries
      for (const entry of cuesheet) {
        // Convert seconds to minutes:seconds:frames format (75 frames per second in cue format)
        const startMinutes = Math.floor(entry.startTime / 60);
        const startSeconds = Math.floor(entry.startTime % 60);
        const startFrames = Math.floor((entry.startTime % 1) * 75);
        
        cuesheetContent += `  TRACK ${String(entry.index).padStart(2, '0')} AUDIO\n`;
        cuesheetContent += `    TITLE "${entry.title}"\n`;
        cuesheetContent += `    INDEX 01 ${String(startMinutes).padStart(2, '0')}:${String(startSeconds).padStart(2, '0')}:${String(startFrames).padStart(2, '0')}\n`;
      }
      
      archive.append(cuesheetContent, { name: `${sanitizedName}.cue` });
    }
    
    // Add metadata if requested
    if (options.includeMetadata) {
      const metadata = {
        name: options.name,
        createdAt: new Date().toISOString(),
        totalDuration,
        trackCount: videos.length,
        bpm: options.bpm,
        key: options.key,
        genre: options.genre,
        notes: options.notes,
        tracks: videos.map((video, index) => ({
          index: index + 1,
          title: video.title,
          description: video.description,
          duration: video.duration,
          fileName: cuesheet[index]?.fileName
        }))
      };
      
      archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
      
      // Add a simple HTML viewer
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options.name} - Mix Details</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
    h1 { color: #6200ea; }
    .track { margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #eee; }
    .track-number { font-weight: bold; color: #6200ea; }
    .track-title { font-size: 18px; margin: 5px 0; }
    .track-details { font-size: 14px; color: #666; }
    .mix-info { background: #f7f7f7; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${options.name}</h1>
  <div class="mix-info">
    <p><strong>Duration:</strong> ${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}</p>
    ${options.bpm ? `<p><strong>BPM:</strong> ${options.bpm}</p>` : ''}
    ${options.key ? `<p><strong>Key:</strong> ${options.key}</p>` : ''}
    ${options.genre ? `<p><strong>Genre:</strong> ${options.genre}</p>` : ''}
    ${options.notes ? `<p><strong>Notes:</strong> ${options.notes}</p>` : ''}
  </div>
  
  <h2>Tracks</h2>
  ${videos.map((video, index) => `
    <div class="track">
      <span class="track-number">${index + 1}</span>
      <h3 class="track-title">${video.title}</h3>
      <p class="track-details">
        Duration: ${Math.floor((video.duration || 0) / 60)}:${String(Math.floor((video.duration || 0) % 60)).padStart(2, '0')}
      </p>
      <p>${video.description || ''}</p>
    </div>
  `).join('')}
</body>
</html>`;
      
      archive.append(htmlContent, { name: 'mix-details.html' });
    }
    
    // Add a README file
    const readmeContent = `# ${options.name} - DJ Mix Package

This package was created for DJs using TheVideoPool.com.

## Contents

${options.format === 'mp4' || options.format === 'both' ? '- Video files in /videos folder\n' : ''}
${options.includeArtwork ? '- Artwork images in /artwork folder\n' : ''}
${options.includeCuesheet ? `- Cue sheet file: ${sanitizedName}.cue\n` : ''}
${options.includeMetadata ? '- Metadata in JSON format: metadata.json\n- HTML mix details: mix-details.html\n' : ''}

## Usage Tips

- The videos are numbered in sequence for easy loading into your DJ software
${options.includeCuesheet ? '- The .cue file can be imported into most DJ software to automatically set cue points\n' : ''}
- Files are optimized for DJ performance with high quality video and audio
- Add your custom notes in the metadata.json file if needed

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
      filePath: `/api/mix-exports/${zipFileName}`,
      tempFilePath: zipFilePath
    };
  },
  
  /**
   * Get available mix templates
   * @returns Array of mix templates
   */
  async getMixTemplates(): Promise<any[]> {
    return [
      {
        id: 'club-set',
        name: 'Club DJ Set',
        description: 'Standard club set with video files, cue sheet, and artwork thumbnails',
        includeCuesheet: true,
        includeMetadata: true,
        includeArtwork: true,
        format: 'mp4'
      },
      {
        id: 'wedding-package',
        name: 'Wedding DJ Package',
        description: 'Complete package for wedding DJs with organized playlists for different parts of the event',
        includeCuesheet: true,
        includeMetadata: true,
        includeArtwork: true,
        format: 'both'
      },
      {
        id: 'thumbnail-only',
        name: 'Thumbnails Preview Set',
        description: 'Lightweight package with just thumbnail images for quick review',
        includeCuesheet: false,
        includeMetadata: true,
        includeArtwork: true,
        format: 'jpg'
      },
      {
        id: 'portable',
        name: 'Portable DJ Set',
        description: 'Optimized for portable media players with smaller file sizes',
        includeCuesheet: true,
        includeMetadata: true,
        includeArtwork: true,
        format: 'mp4'
      },
      {
        id: 'streaming',
        name: 'Live Streaming Kit',
        description: 'Organized for live streaming with intros, transitions, and outros',
        includeCuesheet: true,
        includeMetadata: true,
        includeArtwork: true,
        format: 'mp4'
      }
    ];
  },
  
  /**
   * Get a stream for an existing mix export
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
      throw new Error(`Mix export file not found: ${fileName}`);
    }
  },
  
  /**
   * Delete a temporary mix export file
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
   * Generate a standard cue sheet for a list of videos
   * @param name Mix name
   * @param videos Array of videos
   * @param options Additional options (BPM, key, genre)
   * @returns Cue sheet content as a string
   */
  async generateCueSheet(name: string, videos: any[], options: { 
    bpm?: number, 
    key?: string, 
    genre?: string 
  } = {}): Promise<string> {
    let cuesheet = `TITLE "${name}"\n`;
    if (options.genre) cuesheet += `GENRE "${options.genre}"\n`;
    if (options.bpm) cuesheet += `COMMENT "BPM: ${options.bpm}"\n`;
    if (options.key) cuesheet += `COMMENT "Key: ${options.key}"\n`;
    cuesheet += `FILE "${name}.mp4" MP4\n`;
    
    let currentTime = 0;
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      // Convert seconds to minutes:seconds:frames format (75 frames per second in cue format)
      const startMinutes = Math.floor(currentTime / 60);
      const startSeconds = Math.floor(currentTime % 60);
      const startFrames = Math.floor((currentTime % 1) * 75);
      
      cuesheet += `  TRACK ${String(i+1).padStart(2, '0')} AUDIO\n`;
      cuesheet += `    TITLE "${video.title}"\n`;
      cuesheet += `    INDEX 01 ${String(startMinutes).padStart(2, '0')}:${String(startSeconds).padStart(2, '0')}:${String(startFrames).padStart(2, '0')}\n`;
      
      // Update current time for next video
      currentTime += video.duration || 0;
    }
    
    return cuesheet;
  }
};