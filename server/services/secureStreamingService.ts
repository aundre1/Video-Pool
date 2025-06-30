import { createHmac, randomBytes } from 'crypto';
import { createCipheriv, createDecipheriv } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PassThrough } from 'stream';
import { Canvas, loadImage } from 'canvas';

// Secret for token signing and verification
const TOKEN_SECRET = process.env.JWT_SECRET || uuidv4();

// Encryption settings for secure streaming
const CRYPTO_ALGORITHM = 'aes-256-cbc';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 16; // 128 bits

/**
 * Service for secure video streaming, token generation, and watermarking
 */
export const secureStreamingService = {
  /**
   * Generate a secure streaming token for a video
   * @param videoId Video ID
   * @param userId User ID requesting access
   * @param expiry Token expiry time in seconds (default 1 hour)
   * @returns Encrypted and signed token
   */
  async generateStreamingToken(videoId: number, userId: number, expiry = 3600): Promise<string> {
    // Create token payload
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + expiry;
    
    const payload = {
      videoId,
      userId,
      iat: now,
      exp: expiresAt,
      jti: uuidv4(), // Unique token ID to prevent replay attacks
    };
    
    // Convert payload to string
    const payloadStr = JSON.stringify(payload);
    
    // Encrypt payload
    const key = Buffer.from(TOKEN_SECRET.padEnd(KEY_SIZE, '0').slice(0, KEY_SIZE));
    const iv = randomBytes(IV_SIZE);
    
    const cipher = createCipheriv(CRYPTO_ALGORITHM, key, iv);
    let encrypted = cipher.update(payloadStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Create token signature
    const signature = createHmac('sha256', TOKEN_SECRET)
      .update(`${iv.toString('base64')}.${encrypted}`)
      .digest('base64');
    
    // Combine into token (iv.encrypted.signature)
    const token = `${iv.toString('base64')}.${encrypted}.${signature}`;
    
    return token;
  },
  
  /**
   * Verify a streaming token
   * @param token Token to verify
   * @returns Object indicating validity and payload if valid
   */
  verifyStreamingToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      // Split token parts
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' };
      }
      
      const [ivBase64, encrypted, expectedSignature] = parts;
      
      // Verify signature
      const signature = createHmac('sha256', TOKEN_SECRET)
        .update(`${ivBase64}.${encrypted}`)
        .digest('base64');
      
      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid token signature' };
      }
      
      // Decrypt payload
      const key = Buffer.from(TOKEN_SECRET.padEnd(KEY_SIZE, '0').slice(0, KEY_SIZE));
      const iv = Buffer.from(ivBase64, 'base64');
      
      const decipher = createDecipheriv(CRYPTO_ALGORITHM, key, iv);
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse payload
      const payload = JSON.parse(decrypted);
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return { valid: false, error: 'Token expired' };
      }
      
      return { valid: true, payload };
    } catch (error: any) {
      return { valid: false, error: error.message || 'Invalid token' };
    }
  },
  
  /**
   * Apply a watermark to an image
   * @param imageBuffer Image buffer to watermark
   * @param userId Optional user ID to include in watermark
   * @returns Watermarked image buffer
   */
  async applyWatermark(imageBuffer: Buffer, userId?: number): Promise<Buffer> {
    // Load the image
    const image = await loadImage(imageBuffer);
    
    // Create a canvas with the same dimensions
    const canvas = new Canvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the original image
    ctx.drawImage(image, 0, 0);
    
    // Calculate text size based on image dimensions
    const fontSize = Math.max(14, Math.min(26, image.width / 40));
    
    // Apply semi-transparent overlay for text background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, image.height - fontSize * 3, image.width, fontSize * 3);
    
    // Configure text style
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Current date for the watermark
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].substring(0, 8);
    
    // Draw watermark text
    const watermarkText = `TheVideoPool.com - ${date} ${time}`;
    const userText = userId ? `User ID: ${userId}` : '';
    
    ctx.fillText(watermarkText, image.width / 2, image.height - fontSize * 2);
    if (userText) {
      ctx.fillText(userText, image.width / 2, image.height - fontSize);
    }
    
    // Return the watermarked image buffer
    return canvas.toBuffer();
  },
  
  /**
   * Encrypt a video stream on the fly
   * @param stream Video stream to encrypt
   * @param encryptionKey User-specific key for encryption
   * @returns Encrypted stream
   */
  encryptStream(stream: NodeJS.ReadableStream, encryptionKey: string): NodeJS.ReadableStream {
    // This is a simplified implementation
    // In a real-world scenario, you would encrypt chunks of the stream
    // For now, we'll just pass through the stream unchanged
    
    const passThrough = new PassThrough();
    stream.pipe(passThrough);
    
    return passThrough;
  },
  
  /**
   * Decrypt a video stream on the fly
   * @param stream Encrypted video stream
   * @param encryptionKey User-specific key for decryption
   * @returns Decrypted stream
   */
  decryptStream(stream: NodeJS.ReadableStream, encryptionKey: string): NodeJS.ReadableStream {
    // This is a simplified implementation
    // In a real-world scenario, you would decrypt chunks of the stream
    // For now, we'll just pass through the stream unchanged
    
    const passThrough = new PassThrough();
    stream.pipe(passThrough);
    
    return passThrough;
  }
};