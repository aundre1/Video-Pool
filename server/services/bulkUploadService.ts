import { db } from "../db";
import { 
  bulkUploadSessions, 
  bulkUploadFiles, 
  videos, 
  tags,
  videoTags,
  contentAnalysisResults
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { exec as execCallback } from 'child_process';
import { copyrightService } from "./copyrightService";

// Promisify exec
const exec = util.promisify(execCallback);

// Initialize Anthropic client for content analysis
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface UploadFile {
  originalFilename: string;
  tempFilePath: string;
  fileSize: number;
  mimeType: string;
}

interface VideoMetadata {
  title: string;
  description: string;
  duration: number;
  resolution: string;
  isLoop: boolean;
  isPremium: boolean;
  categoryId: number;
}

export const bulkUploadService = {
  /**
   * Create a new bulk upload session
   */
  async createSession(userId: number, sessionData: {
    name: string;
    defaultCategoryId?: number;
    defaultTags?: string[];
    notes?: string;
  }): Promise<any> {
    const [session] = await db
      .insert(bulkUploadSessions)
      .values({
        userId,
        name: sessionData.name,
        status: "in-progress",
        defaultCategoryId: sessionData.defaultCategoryId,
        defaultTags: sessionData.defaultTags || [],
        notes: sessionData.notes
      })
      .returning();
    
    return session;
  },
  
  /**
   * Add a file to a bulk upload session
   */
  async addFilesToSession(sessionId: number, files: UploadFile[]): Promise<any> {
    // Get the session
    const [session] = await db
      .select()
      .from(bulkUploadSessions)
      .where(eq(bulkUploadSessions.id, sessionId));
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    if (session.status !== "in-progress") {
      throw new Error("Upload session is no longer in progress");
    }
    
    // Update session total files
    await db
      .update(bulkUploadSessions)
      .set({ 
        totalFiles: session.totalFiles + files.length 
      })
      .where(eq(bulkUploadSessions.id, sessionId));
    
    // Add files to the session
    const insertedFiles = [];
    for (const file of files) {
      // Generate a unique filename for storage
      const storageName = `${Date.now()}-${Math.floor(Math.random() * 10000)}-${path.basename(file.originalFilename)}`;
      const targetPath = path.join("uploads", storageName);
      
      // Move file to target location
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(file.tempFilePath, targetPath);
      
      // Insert file record
      const [insertedFile] = await db
        .insert(bulkUploadFiles)
        .values({
          sessionId,
          originalFilename: file.originalFilename,
          processedFilename: targetPath,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          status: "pending"
        })
        .returning();
      
      insertedFiles.push(insertedFile);
    }
    
    return insertedFiles;
  },
  
  /**
   * Process files in a bulk upload session
   */
  async processSessionFiles(sessionId: number): Promise<boolean> {
    // Get the session
    const [session] = await db
      .select()
      .from(bulkUploadSessions)
      .where(eq(bulkUploadSessions.id, sessionId));
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Get pending files in the session
    const pendingFiles = await db
      .select()
      .from(bulkUploadFiles)
      .where(and(
        eq(bulkUploadFiles.sessionId, sessionId),
        eq(bulkUploadFiles.status, "pending")
      ));
    
    if (pendingFiles.length === 0) {
      return false;
    }
    
    // Process each file
    let successCount = 0;
    let failCount = 0;
    
    for (const file of pendingFiles) {
      try {
        // Update file status to processing
        await db
          .update(bulkUploadFiles)
          .set({ 
            status: "processing",
            processingStartedAt: new Date()
          })
          .where(eq(bulkUploadFiles.id, file.id));
        
        // Extract video metadata using ffprobe
        const metadata = await this.extractVideoMetadata(file.processedFilename);
        
        // Generate thumbnails
        const thumbnailPath = await this.generateThumbnail(file.processedFilename);
        
        // Generate a preview segment
        const previewPath = await this.generatePreview(file.processedFilename);
        
        // Generate AI suggested tags
        const suggestedTags = await this.generateAITags(
          path.basename(file.originalFilename, path.extname(file.originalFilename)),
          metadata
        );
        
        // Store the processed metadata
        await db
          .update(bulkUploadFiles)
          .set({
            metadata: {
              ...metadata,
              thumbnailPath,
              previewPath
            },
            suggestedTags,
            status: "completed",
            processingCompletedAt: new Date()
          })
          .where(eq(bulkUploadFiles.id, file.id));
        
        successCount++;
      } catch (error) {
        console.error(`Error processing file ${file.originalFilename}:`, error);
        
        // Update file status to failed
        await db
          .update(bulkUploadFiles)
          .set({ 
            status: "failed",
            errorMessage: error.message,
            processingCompletedAt: new Date()
          })
          .where(eq(bulkUploadFiles.id, file.id));
        
        failCount++;
      }
    }
    
    // Update session status
    await db
      .update(bulkUploadSessions)
      .set({ 
        processedFiles: session.processedFiles + successCount + failCount,
        successfulFiles: session.successfulFiles + successCount,
        failedFiles: session.failedFiles + failCount,
        status: session.totalFiles === (session.processedFiles + successCount + failCount) 
          ? "completed" 
          : "in-progress"
      })
      .where(eq(bulkUploadSessions.id, sessionId));
    
    return true;
  },
  
  /**
   * Extract video metadata using ffprobe
   */
  async extractVideoMetadata(filePath: string): Promise<any> {
    try {
      const { stdout } = await exec(
        `ffprobe -v error -show_format -show_streams -of json "${filePath}"`
      );
      
      const data = JSON.parse(stdout);
      
      // Extract relevant information
      const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
      const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
      
      // Calculate duration in seconds
      const duration = parseFloat(data.format.duration);
      
      // Determine resolution
      let resolution = 'Unknown';
      if (videoStream) {
        const width = videoStream.width;
        const height = videoStream.height;
        
        if (width >= 3840 && height >= 2160) {
          resolution = '4K';
        } else if (width >= 1920 && height >= 1080) {
          resolution = 'HD';
        } else if (width >= 1280 && height >= 720) {
          resolution = '720p';
        } else {
          resolution = `${width}x${height}`;
        }
      }
      
      // Extract other metadata
      const metadata = {
        duration,
        resolution,
        width: videoStream?.width,
        height: videoStream?.height,
        framerate: videoStream?.r_frame_rate 
          ? eval(videoStream.r_frame_rate).toFixed(2) 
          : undefined,
        bitrate: data.format.bit_rate 
          ? parseInt(data.format.bit_rate) / 1000 
          : undefined,
        hasAudio: !!audioStream,
        format: data.format.format_name,
        size: parseInt(data.format.size)
      };
      
      return metadata;
    } catch (error) {
      console.error('Error extracting video metadata:', error);
      throw new Error('Failed to extract video metadata');
    }
  },
  
  /**
   * Generate a thumbnail image for the video
   */
  async generateThumbnail(filePath: string): Promise<string> {
    try {
      const thumbnailDir = 'uploads/thumbnails';
      await fs.promises.mkdir(thumbnailDir, { recursive: true });
      
      const thumbnailName = `${path.basename(filePath, path.extname(filePath))}_thumb.jpg`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailName);
      
      // Generate thumbnail at 15% into the video
      await exec(
        `ffmpeg -i "${filePath}" -ss 00:00:15 -vframes 1 -vf "scale=500:-1" -q:v 2 "${thumbnailPath}"`
      );
      
      return thumbnailPath;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      throw new Error('Failed to generate thumbnail');
    }
  },
  
  /**
   * Generate a preview clip (30 seconds) of the video
   */
  async generatePreview(filePath: string): Promise<string> {
    try {
      const previewDir = 'uploads/previews';
      await fs.promises.mkdir(previewDir, { recursive: true });
      
      const previewName = `${path.basename(filePath, path.extname(filePath))}_preview.mp4`;
      const previewPath = path.join(previewDir, previewName);
      
      // Generate a 30-second preview starting at 10% of the duration
      await exec(
        `ffmpeg -i "${filePath}" -ss 00:00:10 -t 00:00:30 -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "${previewPath}"`
      );
      
      return previewPath;
    } catch (error) {
      console.error('Error generating preview:', error);
      throw new Error('Failed to generate preview');
    }
  },
  
  /**
   * Generate AI-suggested tags for a video
   */
  async generateAITags(title: string, metadata: any): Promise<string[]> {
    try {
      // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1024,
        system: `You are a DJ video tagging expert assistant. Your task is to analyze video metadata and suggest appropriate tags for DJ visuals.
        
        Consider:
        1. Common DJ and VJ genres (house, techno, hip-hop, EDM, ambient, etc.)
        2. Visual aesthetics (neon, abstract, geometric, cosmic, psychedelic, minimal, etc.)
        3. Moods (energetic, chill, dark, bright, euphoric, etc.)
        4. Technical aspects (loop, seamless, colorful, monochrome, etc.)
        
        Output should be an array of 5-10 relevant tags as JSON.`,
        messages: [
          {
            role: "user",
            content: `Please suggest tags for this DJ video:
            
            Title: ${title}
            Duration: ${metadata.duration} seconds
            Resolution: ${metadata.resolution}
            Has Audio: ${metadata.hasAudio ? 'Yes' : 'No'}
            
            Return only a JSON array of tags with no explanations.`
          }
        ]
      });

      // Extract and parse JSON array of tags
      const content = response.content[0].text;
      try {
        // Extract JSON from response which might have additional text
        const jsonMatch = content.match(/\[.*\]/s);
        if (jsonMatch) {
          const tags = JSON.parse(jsonMatch[0]);
          return tags.filter((tag: any) => typeof tag === 'string').slice(0, 15); // Limit to 15 tags max
        }
        return [];
      } catch (parseError) {
        console.error("Error parsing AI tags:", parseError);
        return [];
      }
    } catch (error) {
      console.error("Error generating AI tags:", error);
      return [];
    }
  },
  
  /**
   * Create a video from a processed file
   */
  async createVideoFromProcessedFile(fileId: number, videoData: VideoMetadata, userId: number): Promise<any> {
    // Get the processed file
    const [file] = await db
      .select()
      .from(bulkUploadFiles)
      .where(eq(bulkUploadFiles.id, fileId));
    
    if (!file || file.status !== "completed") {
      throw new Error("File not found or not completely processed");
    }
    
    // Insert the video
    const [video] = await db
      .insert(videos)
      .values({
        title: videoData.title,
        description: videoData.description,
        thumbnailUrl: file.metadata.thumbnailPath,
        videoUrl: file.processedFilename,
        previewUrl: file.metadata.previewPath,
        categoryId: videoData.categoryId,
        duration: videoData.duration || file.metadata.duration,
        resolution: videoData.resolution || file.metadata.resolution,
        isLoop: videoData.isLoop,
        isPremium: videoData.isPremium,
        isNew: true,
        downloadCount: 0
      })
      .returning();
    
    // Update the file with the created video ID
    await db
      .update(bulkUploadFiles)
      .set({ videoId: video.id })
      .where(eq(bulkUploadFiles.id, fileId));
    
    // Process suggested tags if they exist
    if (file.suggestedTags && Array.isArray(file.suggestedTags)) {
      for (const tagName of file.suggestedTags) {
        // Look for existing tag or create a new one
        let tagId: number;
        
        const existingTag = await db
          .select()
          .from(tags)
          .where(eq(tags.name, tagName))
          .limit(1);
        
        if (existingTag.length > 0) {
          tagId = existingTag[0].id;
          
          // Increment usage count
          await db
            .update(tags)
            .set({ usageCount: existingTag[0].usageCount + 1 })
            .where(eq(tags.id, tagId));
        } else {
          // Create new tag
          const slug = tagName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          
          const [newTag] = await db
            .insert(tags)
            .values({
              name: tagName,
              slug,
              categoryId: videoData.categoryId,
              usageCount: 1
            })
            .returning();
          
          tagId = newTag.id;
        }
        
        // Add tag to video
        await db
          .insert(videoTags)
          .values({
            videoId: video.id,
            tagId,
            addedById: userId
          });
      }
    }
    
    // Run copyright check in the background
    setTimeout(async () => {
      try {
        await copyrightService.checkCopyright(video.id);
      } catch (error) {
        console.error(`Copyright check error for video ${video.id}:`, error);
      }
    }, 100);
    
    return video;
  },
  
  /**
   * Get active upload sessions for a user
   */
  async getUserSessions(userId: number): Promise<any[]> {
    const sessions = await db
      .select()
      .from(bulkUploadSessions)
      .where(eq(bulkUploadSessions.userId, userId))
      .orderBy(desc(bulkUploadSessions.startedAt));
    
    return sessions;
  },
  
  /**
   * Get session details including files
   */
  async getSessionDetails(sessionId: number, userId: number): Promise<any> {
    // Get the session
    const [session] = await db
      .select()
      .from(bulkUploadSessions)
      .where(and(
        eq(bulkUploadSessions.id, sessionId),
        eq(bulkUploadSessions.userId, userId)
      ));
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Get all files in the session
    const files = await db
      .select()
      .from(bulkUploadFiles)
      .where(eq(bulkUploadFiles.sessionId, sessionId))
      .orderBy(bulkUploadFiles.id);
    
    return {
      ...session,
      files
    };
  },
  
  /**
   * Cancel a session and clean up any unprocessed files
   */
  async cancelSession(sessionId: number, userId: number): Promise<boolean> {
    // Get the session
    const [session] = await db
      .select()
      .from(bulkUploadSessions)
      .where(and(
        eq(bulkUploadSessions.id, sessionId),
        eq(bulkUploadSessions.userId, userId)
      ));
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Get all files that aren't associated with videos
    const pendingFiles = await db
      .select()
      .from(bulkUploadFiles)
      .where(and(
        eq(bulkUploadFiles.sessionId, sessionId),
        sql`${bulkUploadFiles.videoId} IS NULL`
      ));
    
    // Delete the files from the filesystem
    for (const file of pendingFiles) {
      try {
        if (file.processedFilename) {
          await fs.promises.unlink(file.processedFilename);
        }
        
        // Also delete thumbnail and preview if they exist
        if (file.metadata && file.metadata.thumbnailPath) {
          await fs.promises.unlink(file.metadata.thumbnailPath);
        }
        
        if (file.metadata && file.metadata.previewPath) {
          await fs.promises.unlink(file.metadata.previewPath);
        }
      } catch (error) {
        console.error(`Error deleting file ${file.originalFilename}:`, error);
      }
    }
    
    // Update session status
    await db
      .update(bulkUploadSessions)
      .set({ status: "failed" })
      .where(eq(bulkUploadSessions.id, sessionId));
    
    return true;
  },
  
  /**
   * Auto-generate a video based on file metadata and session defaults
   */
  async autoGenerateVideo(fileId: number, userId: number): Promise<any> {
    // Get the file
    const [file] = await db
      .select()
      .from(bulkUploadFiles)
      .where(eq(bulkUploadFiles.id, fileId));
    
    if (!file || file.status !== "completed") {
      throw new Error("File not found or not completely processed");
    }
    
    // Get the session for default values
    const [session] = await db
      .select()
      .from(bulkUploadSessions)
      .where(eq(bulkUploadSessions.id, file.sessionId));
    
    if (!session) {
      throw new Error("Upload session not found");
    }
    
    // Generate title from filename
    const title = path.basename(file.originalFilename, path.extname(file.originalFilename))
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    // Auto-generate a description using AI
    const description = await this.generateVideoDescription(title, file.metadata, file.suggestedTags);
    
    // Determine if it's likely a loop
    const isLoop = file.metadata.duration < 60 && title.toLowerCase().includes('loop');
    
    // Create the video
    const video = await this.createVideoFromProcessedFile(
      fileId,
      {
        title,
        description,
        duration: file.metadata.duration,
        resolution: file.metadata.resolution,
        isLoop,
        isPremium: true, // Default to premium
        categoryId: session.defaultCategoryId || 1 // Default to first category if none set
      },
      userId
    );
    
    return video;
  },
  
  /**
   * Generate a video description using AI
   */
  async generateVideoDescription(title: string, metadata: any, tags: string[] = []): Promise<string> {
    try {
      // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 1024,
        system: `You are a DJ video description writer. Your task is to create compelling, informative descriptions for DJ visuals and loops.
        
        Write descriptions that:
        1. Are professional but engaging
        2. Mention key technical aspects (resolution, duration, loop status)
        3. Include suggested uses for DJs and VJs
        4. Incorporate tags and themes from the metadata
        
        Keep descriptions between 2-4 sentences total.`,
        messages: [
          {
            role: "user",
            content: `Write a professional description for this DJ video:
            
            Title: ${title}
            Duration: ${metadata.duration} seconds
            Resolution: ${metadata.resolution}
            Tags: ${tags.join(', ')}
            
            Make it concise, professional, and appealing to DJs.`
          }
        ]
      });

      return response.content[0].text.trim();
    } catch (error) {
      console.error("Error generating video description:", error);
      return `${title} - ${metadata.resolution} video for DJs. Duration: ${metadata.duration} seconds.`;
    }
  }
};