import { createReadStream, createWriteStream } from 'fs';
import { access, mkdir, stat, unlink } from 'fs/promises';
import { join, basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { secureStreamingService } from './secureStreamingService';
import { constants } from 'fs';
import { PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import AWS from 'aws-sdk';

// Local storage paths
const UPLOAD_DIR = join(process.cwd(), 'uploads');
const VIDEOS_DIR = join(UPLOAD_DIR, 'videos');
const PREVIEWS_DIR = join(UPLOAD_DIR, 'previews');
const THUMBNAILS_DIR = join(UPLOAD_DIR, 'thumbnails');

// Ensure directories exist
async function ensureDirectoriesExist() {
  console.log('Ensuring video directories exist');
  
  for (const dir of [UPLOAD_DIR, VIDEOS_DIR, PREVIEWS_DIR, THUMBNAILS_DIR]) {
    try {
      await access(dir, constants.F_OK);
    } catch (e) {
      console.log(`Creating directory: ${dir}`);
      await mkdir(dir, { recursive: true });
    }
  }
}

// Initialize directories
ensureDirectoriesExist();

// DigitalOcean Spaces configuration
const DO_SPACES_ENABLED = !!process.env.DO_SPACES_ENDPOINT;
const s3Config = {
  endpoint: process.env.DO_SPACES_ENDPOINT,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  region: process.env.DO_SPACES_REGION || 'us-east-1',
  bucket: process.env.DO_SPACES_BUCKET || 'thevideopool',
};

// Initialize S3 client for DigitalOcean Spaces
const s3Client = DO_SPACES_ENABLED 
  ? new AWS.S3({
      endpoint: s3Config.endpoint,
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
      region: s3Config.region,
    })
  : null;

/**
 * Storage service for video file management
 * Supports both local storage and DigitalOcean Spaces
 */
export const storageService = {
  /**
   * Check if cloud storage is enabled
   */
  isCloudEnabled(): boolean {
    return DO_SPACES_ENABLED;
  },

  /**
   * Get the local file path for a video
   * @param key Video file key
   * @param type Video file type (full, preview, thumbnail)
   */
  getLocalFilePath(key: string, type: 'video' | 'preview' | 'thumbnail' = 'video'): string {
    const dir = type === 'video' ? VIDEOS_DIR : type === 'preview' ? PREVIEWS_DIR : THUMBNAILS_DIR;
    return join(dir, key);
  },

  /**
   * Save an uploaded file
   * @param file File object from multer
   * @param type File type (video, preview, thumbnail)
   * @returns File key
   */
  async saveFile(file: Express.Multer.File, type: 'video' | 'preview' | 'thumbnail' = 'video'): Promise<string> {
    const extension = extname(file.originalname);
    const fileKey = `${uuidv4()}${extension}`;
    
    if (DO_SPACES_ENABLED && s3Client) {
      // Upload to DigitalOcean Spaces
      const folder = type === 'video' ? 'videos' : type === 'preview' ? 'previews' : 'thumbnails';
      const key = `${folder}/${fileKey}`;
      
      await s3Client.upload({
        Bucket: s3Config.bucket,
        Key: key,
        Body: file.buffer,
        ACL: 'private',
        ContentType: file.mimetype,
      }).promise();
      
      return key;
    } else {
      // Save to local filesystem
      const filePath = this.getLocalFilePath(fileKey, type);
      const writeStream = createWriteStream(filePath);
      
      // Create a readable stream from the buffer
      const readStream = new PassThrough();
      readStream.end(file.buffer);
      
      // Pipe the readable stream to the write stream
      await pipeline(readStream, writeStream);
      
      return fileKey;
    }
  },

  /**
   * Get a stream for a video file
   * @param key Video file key
   * @param type File type (video, preview, thumbnail)
   * @returns Readable stream
   */
  async getVideoStream(key: string, type: 'video' | 'preview' | 'thumbnail' = 'video'): Promise<NodeJS.ReadableStream> {
    if (DO_SPACES_ENABLED && s3Client) {
      // Get from DigitalOcean Spaces
      const folder = type === 'video' ? 'videos' : type === 'preview' ? 'previews' : 'thumbnails';
      const s3Key = key.includes(folder) ? key : `${folder}/${key}`;
      
      const params = {
        Bucket: s3Config.bucket,
        Key: s3Key,
      };
      
      try {
        const headResponse = await s3Client.headObject(params).promise();
        const fileSize = headResponse.ContentLength;
        
        const response = s3Client.getObject(params).createReadStream();
        
        // Add metadata to the stream
        (response as any).fileSize = fileSize;
        (response as any).mimeType = headResponse.ContentType;
        (response as any).fileName = basename(key);
        
        return response;
      } catch (error) {
        console.error(`Error getting object from S3: ${error}`);
        throw new Error(`File not found: ${key}`);
      }
    } else {
      // Get from local filesystem
      const filePath = this.getLocalFilePath(key, type);
      
      try {
        await access(filePath, constants.F_OK);
        const fileStat = await stat(filePath);
        const stream = createReadStream(filePath);
        
        // Add metadata to the stream
        (stream as any).fileSize = fileStat.size;
        (stream as any).mimeType = type === 'video' || type === 'preview' 
          ? 'video/mp4' 
          : 'image/jpeg';
        (stream as any).fileName = basename(key);
        
        return stream;
      } catch (error) {
        throw new Error(`File not found: ${key}`);
      }
    }
  },

  /**
   * Delete a video file
   * @param key Video file key
   * @param type File type (video, preview, thumbnail)
   */
  async deleteFile(key: string, type: 'video' | 'preview' | 'thumbnail' = 'video'): Promise<void> {
    if (DO_SPACES_ENABLED && s3Client) {
      // Delete from DigitalOcean Spaces
      const folder = type === 'video' ? 'videos' : type === 'preview' ? 'previews' : 'thumbnails';
      const s3Key = key.includes(folder) ? key : `${folder}/${key}`;
      
      try {
        await s3Client.deleteObject({
          Bucket: s3Config.bucket,
          Key: s3Key,
        }).promise();
      } catch (error) {
        console.error(`Error deleting object from S3: ${error}`);
      }
    } else {
      // Delete from local filesystem
      const filePath = this.getLocalFilePath(key, type);
      
      try {
        await access(filePath, constants.F_OK);
        await unlink(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }
  },

  /**
   * Generate a signed URL for secure access to a video
   * @param videoId Video ID
   * @param userId User ID requesting access
   * @param expirySeconds URL expiry time in seconds (default 1 hour)
   */
  async generateSignedUrl(videoId: number, userId: number, expirySeconds = 3600): Promise<string> {
    const video = await storage.getVideo(videoId);
    
    if (!video) {
      throw new Error('Video not found');
    }
    
    // For cloud storage, generate a pre-signed URL
    if (DO_SPACES_ENABLED && s3Client) {
      const key = video.videoUrl;
      const folder = 'videos';
      const s3Key = key.includes(folder) ? key : `${folder}/${key}`;
      
      try {
        // Check if user has permission for this video
        if (video.isPremium) {
          const user = await storage.getUser(userId);
          if (!user || !user.membershipId || !user.membershipEndDate || new Date(user.membershipEndDate) < new Date()) {
            throw new Error('Premium membership required');
          }
        }
        
        // Generate pre-signed URL
        const signedUrl = s3Client.getSignedUrl('getObject', {
          Bucket: s3Config.bucket,
          Key: s3Key,
          Expires: expirySeconds,
        });
        
        return signedUrl;
      } catch (error) {
        console.error(`Error generating signed URL: ${error}`);
        throw error;
      }
    } else {
      // For local storage, use a secure token-based URL
      try {
        const token = await secureStreamingService.generateStreamingToken(videoId, userId, expirySeconds);
        return `/api/videos/${videoId}/stream?token=${token}`;
      } catch (error) {
        console.error(`Error generating streaming token: ${error}`);
        throw error;
      }
    }
  },

  /**
   * Apply watermark to video frames on the fly
   * @param stream Video stream
   * @param userId User ID for personalized watermark
   */
  async applyWatermark(stream: NodeJS.ReadableStream, userId?: number): Promise<NodeJS.ReadableStream> {
    // This is a simplified implementation
    // In a production environment, you would use ffmpeg to apply watermarks to video frames
    
    // For now, we'll just pass through the stream unchanged
    return stream;
  },

  /**
   * Create a video preview (30 seconds clip)
   * @param sourceKey Source video key
   * @returns Preview file key
   */
  async createVideoPreview(sourceKey: string): Promise<string> {
    // This would use ffmpeg to create a preview
    // For this implementation, we'll just return the source key as a placeholder
    return sourceKey;
  },

  /**
   * Extract a thumbnail from a video
   * @param sourceKey Source video key
   * @returns Thumbnail file key
   */
  async extractThumbnail(sourceKey: string): Promise<string> {
    // This would use ffmpeg to extract a thumbnail
    // For this implementation, we'll just return a placeholder
    return sourceKey;
  }
};