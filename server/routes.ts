import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from 'ws';
import { storage } from "./storage";
import { authController } from "./controllers/auth";
import { videosController } from "./controllers/videos";
import { membershipsController } from "./controllers/memberships";
import { usersController } from "./controllers/users";
import { chatController } from "./controllers/chat";
import { emailController } from "./controllers/email";
import { searchController } from "./controllers/search";
import { recommendationsController } from "./controllers/recommendations";
import { downloadsController } from "./controllers/downloads";
import { libraryController } from "./controllers/library";
import { storageController } from "./controllers/storageController";
import { analyticsController } from "./controllers/analyticsController";
import { authenticateJWT, isAdmin } from "./middleware/auth";
import { downloadService } from "./services/downloadService";
import { bulkDownloadService } from "./services/bulkDownloadService";
import { secureStreamingService } from "./services/secureStreamingService";
import { notificationService } from "./services/notificationService";
import { storageService } from "./services/storageService";
import { mixExportService } from "./services/mixExportService";

export async function registerRoutes(app: Express): Promise<Server> {
  // No need to explicitly initialize storage directories
  // Storage service initializes directories on import
  
  // Auth routes
  app.post("/api/auth/register", authController.register);
  app.post("/api/auth/login", authController.login);
  app.post("/api/auth/logout", authController.logout);
  app.get("/api/auth/me", authController.getCurrentUser);
  
  // Video routes - public
  app.get("/api/videos", videosController.getVideos);
  app.get("/api/videos/featured", videosController.getFeaturedVideos);
  app.get("/api/videos/:id", videosController.getVideo);
  app.get("/api/videos/related/:id", videosController.getRelatedVideos);
  app.get("/api/videos/recommended", authenticateJWT, videosController.getRecommendedVideos);
  
  // Storage service routes
  app.get("/api/videos/stream/:id", authenticateJWT, storageController.streamVideo);
  app.get("/api/videos/preview/:key", storageController.streamPreview);
  app.get("/api/videos/thumbnail/:key", storageController.serveThumbnail);
  app.get("/api/videos/:id/download", authenticateJWT, storageController.downloadVideo);
  
  // Legacy preview route
  app.get("/api/videos/:id/preview", videosController.previewVideo);
  
  // Video download - authenticated (legacy route)
  app.post("/api/videos/:id/download", authenticateJWT, videosController.downloadVideo);
  
  // Categories routes
  app.get("/api/categories", videosController.getCategories);
  app.get("/api/categories/:id", videosController.getCategoryVideos);
  
  // Memberships routes
  app.get("/api/memberships", membershipsController.getMemberships);
  app.get("/api/memberships/:id", membershipsController.getMembership);
  app.post("/api/memberships/subscribe", authenticateJWT, membershipsController.subscribeMembership);
  
  // User routes - authenticated
  app.get("/api/user/downloads", authenticateJWT, usersController.getUserDownloads);
  app.get("/api/user/downloads/recent", authenticateJWT, usersController.getRecentDownloads);
  app.get("/api/user/profile", authenticateJWT, usersController.getUserProfile);
  app.put("/api/user/profile", authenticateJWT, usersController.updateUserProfile);
  
  // Chat support routes
  app.post("/api/chat/message", authenticateJWT, chatController.processMessage);
  app.get("/api/chat/verify-download/:videoId", authenticateJWT, chatController.verifyDownload);
  app.get("/api/chat/membership-status", authenticateJWT, chatController.checkMembership);
  
  // Admin routes - admin only
  app.get("/api/admin/statistics", authenticateJWT, isAdmin, usersController.getAdminStatistics);
  
  // Analytics routes - admin only
  app.get("/api/admin/analytics/dashboard", authenticateJWT, isAdmin, analyticsController.getDashboardMetrics);
  app.get("/api/admin/analytics/top-content", authenticateJWT, isAdmin, analyticsController.getTopContent);
  app.get("/api/admin/analytics/categories", authenticateJWT, isAdmin, analyticsController.getCategoryAnalytics);
  app.get("/api/admin/analytics/engagement", authenticateJWT, isAdmin, analyticsController.getUserEngagement);
  
  // Admin user management
  app.get("/api/admin/users", authenticateJWT, isAdmin, usersController.getAllUsers);
  app.get("/api/admin/users/:id", authenticateJWT, isAdmin, usersController.getUserById);
  app.put("/api/admin/users/:id", authenticateJWT, isAdmin, usersController.updateUser);
  app.delete("/api/admin/users/:id", authenticateJWT, isAdmin, usersController.deleteUser);
  
  // Admin video management
  app.get("/api/admin/videos", authenticateJWT, isAdmin, videosController.getAllVideos);
  app.get("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.getVideoAdmin);
  app.post("/api/admin/videos", authenticateJWT, isAdmin, videosController.createVideo);
  app.put("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.updateVideo);
  app.delete("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.deleteVideo);
  
  // Admin batch video operations
  app.post("/api/admin/videos/batch/delete", authenticateJWT, isAdmin, videosController.batchDeleteVideos);
  app.post("/api/admin/videos/batch/update-category", authenticateJWT, isAdmin, videosController.batchUpdateVideoCategory);
  app.post("/api/admin/videos/batch/update-premium", authenticateJWT, isAdmin, videosController.batchUpdateVideoPremiumStatus);
  app.post("/api/admin/videos/batch/update-featured", authenticateJWT, isAdmin, videosController.batchUpdateVideoFeaturedStatus);
  
  // Admin user management
  app.put("/api/admin/users/:id", authenticateJWT, isAdmin, usersController.updateUser);
  app.delete("/api/admin/users/:id", authenticateJWT, isAdmin, usersController.deleteUser);
  
  // Admin video management
  app.get("/api/admin/videos", authenticateJWT, isAdmin, videosController.getAllVideos);
  app.post("/api/admin/videos", authenticateJWT, isAdmin, videosController.createVideo);
  app.get("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.getVideoAdmin);
  app.put("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.updateVideo);
  app.delete("/api/admin/videos/:id", authenticateJWT, isAdmin, videosController.deleteVideo);
  
  // Admin category management
  app.get("/api/admin/categories", authenticateJWT, isAdmin, videosController.getAllCategories);
  app.post("/api/admin/categories", authenticateJWT, isAdmin, videosController.createCategory);
  app.put("/api/admin/categories/:id", authenticateJWT, isAdmin, videosController.updateCategory);
  app.delete("/api/admin/categories/:id", authenticateJWT, isAdmin, videosController.deleteCategory);
  
  // Email marketing routes - admin only
  app.get("/api/admin/email/campaigns", authenticateJWT, isAdmin, emailController.getCampaigns);
  app.get("/api/admin/email/campaigns/:id", authenticateJWT, isAdmin, emailController.getCampaign);
  app.post("/api/admin/email/campaigns", authenticateJWT, isAdmin, emailController.createCampaign);
  app.put("/api/admin/email/campaigns/:id", authenticateJWT, isAdmin, emailController.updateCampaign);
  app.delete("/api/admin/email/campaigns/:id", authenticateJWT, isAdmin, emailController.deleteCampaign);
  app.post("/api/admin/email/campaigns/:id/schedule", authenticateJWT, isAdmin, emailController.scheduleCampaign);
  app.post("/api/admin/email/campaigns/:id/send", authenticateJWT, isAdmin, emailController.sendCampaignNow);
  app.post("/api/admin/email/generate-newsletter", authenticateJWT, isAdmin, emailController.generateNewsletter);
  app.get("/api/admin/email/subscribers", authenticateJWT, isAdmin, emailController.getSubscribers);
  app.put("/api/admin/email/subscribers/:id", authenticateJWT, isAdmin, emailController.updateSubscriber);
  app.post("/api/admin/email/import-users", authenticateJWT, isAdmin, emailController.importUsers);
  
  // Public unsubscribe route
  app.get("/api/email/unsubscribe", emailController.unsubscribe);
  
  // Search routes
  app.get("/api/search", searchController.searchVideos);
  app.get("/api/search/autocomplete", searchController.getAutocompleteSuggestions);
  app.get("/api/search/popular", searchController.getPopularSearchTerms);
  
  // Recommendation routes
  app.get("/api/recommendations/related/:id", recommendationsController.getRelatedVideos);
  app.get("/api/recommendations/personalized", authenticateJWT, recommendationsController.getPersonalizedRecommendations);
  app.get("/api/recommendations/trending", recommendationsController.getTrendingVideos);
  app.get("/api/recommendations/popular", recommendationsController.getPopularVideos);
  app.get("/api/recommendations/new-releases", recommendationsController.getNewReleases);
  app.get("/api/recommendations/curated/:theme", recommendationsController.getCuratedSets);
  app.get("/api/recommendations/similar/:id", recommendationsController.getSimilarVideos);
  app.get("/api/recommendations/you-might-like", recommendationsController.getYouMightAlsoLike);
  
  // Download routes
  app.get("/api/videos/:id/formats", downloadsController.getAvailableFormats);
  app.get("/api/videos/:id/download", authenticateJWT, downloadsController.initiateDownload);
  app.get("/api/videos/:id/download/:formatId", authenticateJWT, downloadsController.downloadVideo);
  app.get("/api/downloads/history", authenticateJWT, downloadsController.getUserDownloads);
  
  // Cloud Library routes (My Crate/Favorites)
  app.post("/api/favorites/:id", authenticateJWT, libraryController.addToFavorites);
  app.delete("/api/favorites/:id", authenticateJWT, libraryController.removeFromFavorites);
  app.get("/api/favorites", authenticateJWT, libraryController.getFavorites);
  app.get("/api/favorites/check/:id", authenticateJWT, libraryController.isFavorite);
  
  // Playlist routes
  app.post("/api/playlists", authenticateJWT, libraryController.createPlaylist);
  app.get("/api/playlists", authenticateJWT, libraryController.getPlaylists);
  app.get("/api/playlists/:id", libraryController.getPlaylist);
  app.put("/api/playlists/:id", authenticateJWT, libraryController.updatePlaylist);
  app.delete("/api/playlists/:id", authenticateJWT, libraryController.deletePlaylist);
  app.post("/api/playlists/:id/videos", authenticateJWT, libraryController.addToPlaylist);
  app.delete("/api/playlists/:id/videos/:itemId", authenticateJWT, libraryController.removeFromPlaylist);
  app.put("/api/playlists/:id/reorder", authenticateJWT, libraryController.reorderPlaylist);
  app.get("/api/shared-playlist/:token", libraryController.getSharedPlaylist);
  
  // Bulk download route
  app.post("/api/bulk-download", authenticateJWT, async (req, res) => {
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
  });
  
  // DJ Mix Export Tools
  app.post("/api/mix-export", authenticateJWT, async (req, res) => {
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
  });
  
  app.get("/api/mix-templates", authenticateJWT, async (req, res) => {
    try {
      const templates = await mixExportService.getMixTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('Error getting mix templates:', error);
      res.status(500).json({ error: error.message || 'Failed to get mix templates' });
    }
  });
  
  app.post("/api/mix-export/with-cuesheet", authenticateJWT, async (req, res) => {
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
  });
  
  // Secure streaming & DRM routes
  app.get("/api/secure-stream/:token", authenticateJWT, async (req, res) => {
    const token = req.params.token;
    const secureToken = secureStreamingService.verifySecureToken(token);
    
    if (!secureToken) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    
    try {
      const video = await storage.getVideo(secureToken.videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      const stream = require('fs').createReadStream(video.videoUrl);
      
      // Apply watermark if needed
      const finalStream = secureToken.watermarked 
        ? await secureStreamingService.applyWatermark(stream, secureToken.userId) 
        : stream;
      
      // Set appropriate headers
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `inline; filename="${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4"`);
      
      // Stream the video
      finalStream.pipe(res);
    } catch (error) {
      console.error("Error streaming video:", error);
      res.status(500).json({ error: "Failed to stream video" });
    }
  });
  
  // DJ Mix Download Routes
  app.get("/api/downloads/bulk/:fileName", authenticateJWT, async (req, res) => {
    try {
      const fileName = req.params.fileName;
      const stream = await bulkDownloadService.getDownloadStream(fileName);
      
      // Set download headers
      res.setHeader('Content-Type', (stream as any).mimeType || 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${(stream as any).fileName || fileName}"`);
      
      if ((stream as any).fileSize) {
        res.setHeader('Content-Length', (stream as any).fileSize);
      }
      
      // Pipe the file stream to the response
      (stream as any).stream?.pipe(res) || stream.pipe(res);
      
      // Clean up the temp file after download (async)
      setTimeout(() => {
        bulkDownloadService.cleanupTempFile(fileName).catch(console.error);
      }, 5000);
      
    } catch (error: any) {
      console.error('Error serving bulk download:', error);
      res.status(404).json({ error: error.message || 'File not found' });
    }
  });
  
  app.get("/api/mix-exports/:fileName", authenticateJWT, async (req, res) => {
    try {
      const fileName = req.params.fileName;
      const stream = await mixExportService.getDownloadStream(fileName);
      
      // Set download headers
      res.setHeader('Content-Type', (stream as any).mimeType || 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${(stream as any).fileName || fileName}"`);
      
      if ((stream as any).fileSize) {
        res.setHeader('Content-Length', (stream as any).fileSize);
      }
      
      // Pipe the file stream to the response
      (stream as any).stream?.pipe(res) || stream.pipe(res);
      
      // Clean up the temp file after download (async)
      setTimeout(() => {
        mixExportService.cleanupTempFile(fileName).catch(console.error);
      }, 5000);
      
    } catch (error: any) {
      console.error('Error serving mix export:', error);
      res.status(404).json({ error: error.message || 'File not found' });
    }
  });
  
  app.get("/api/secure-download/:token", async (req, res) => {
    const token = req.params.token;
    
    // Verify token (custom implementation)
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8');
      const [jsonStr, signature] = tokenData.split(':');
      
      // Verify signature
      const hmac = require('crypto').createHmac('sha256', process.env.JWT_SECRET || 'development-secret');
      hmac.update(jsonStr);
      const expectedSignature = hmac.digest('hex');
      
      if (signature !== expectedSignature) {
        return res.status(403).json({ error: "Invalid signature" });
      }
      
      const data = JSON.parse(jsonStr);
      
      // Check expiry
      if (new Date(data.expires) < new Date()) {
        return res.status(403).json({ error: "Link expired" });
      }
      
      // Get the video
      const video = await storage.getVideo(data.videoId);
      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }
      
      // Stream the file
      const fs = require('fs');
      const stream = fs.createReadStream(video.videoUrl);
      
      // Set headers for download
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${video.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4"`);
      
      // Start streaming
      stream.pipe(res);
    } catch (error) {
      console.error("Error processing secure download:", error);
      res.status(500).json({ error: "Failed to process download" });
    }
  });
  
  // Bulk download routes
  app.get("/api/downloads/bulk/:batchId/download", authenticateJWT, async (req, res) => {
    const { batchId } = req.params;
    
    try {
      const zipData = await bulkDownloadService.getDownloadStream(batchId);
      
      if (!zipData) {
        return res.status(404).json({ error: "Bulk download not found or expired" });
      }
      
      // Set appropriate headers
      res.setHeader('Content-Type', zipData.mimeType);
      res.setHeader('Content-Length', zipData.fileSize);
      res.setHeader('Content-Disposition', `attachment; filename="${zipData.fileName}"`);
      
      // Stream the zip file
      zipData.stream.pipe(res);
    } catch (error) {
      console.error("Error streaming bulk download:", error);
      res.status(500).json({ error: "Failed to download files" });
    }
  });
  
  app.get("/api/downloads/bulk/:batchId/status", authenticateJWT, async (req, res) => {
    const { batchId } = req.params;
    
    try {
      const status = await bulkDownloadService.getBulkDownloadStatus(batchId);
      
      if (!status) {
        return res.status(404).json({ error: "Bulk download not found" });
      }
      
      res.json(status);
    } catch (error) {
      console.error("Error getting bulk download status:", error);
      res.status(500).json({ error: "Failed to get download status" });
    }
  });
  
  // Notification and calendar routes
  app.get("/api/notifications", authenticateJWT, async (req, res) => {
    try {
      const notifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, req.user!.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });
  
  app.post("/api/notifications/mark-read", authenticateJWT, async (req, res) => {
    const { notificationIds } = req.body;
    
    try {
      await notificationService.markNotificationsAsRead(req.user!.id, notificationIds || []);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });
  
  app.get("/api/calendar", authenticateJWT, async (req, res) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    
    try {
      const events = await notificationService.getCalendarEvents(startDate, endDate);
      res.json({ events });
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });
  
  app.post("/api/categories/:id/subscribe", authenticateJWT, async (req, res) => {
    const categoryId = parseInt(req.params.id);
    
    try {
      await notificationService.subscribeToCategory(req.user!.id, categoryId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error subscribing to category:", error);
      res.status(500).json({ error: "Failed to subscribe to category" });
    }
  });
  
  // Device management for notifications
  app.post("/api/devices/register", authenticateJWT, async (req, res) => {
    const { deviceId, name, type, token } = req.body;
    
    try {
      // Save device to database
      await db
        .insert(devices)
        .values({
          userId: req.user!.id,
          deviceId,
          name: name || "Unknown Device",
          type: type || "browser",
          token: token || null,
          lastActive: new Date()
        })
        .onConflictDoUpdate({
          target: [devices.userId, devices.deviceId],
          set: {
            name: name || devices.name,
            type: type || devices.type,
            token: token || devices.token,
            lastActive: new Date()
          }
        });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error registering device:", error);
      res.status(500).json({ error: "Failed to register device" });
    }
  });
  
  app.get("/api/devices", authenticateJWT, async (req, res) => {
    try {
      const userDevices = secureStreamingService.getUserDevices(req.user!.id);
      res.json({ devices: userDevices });
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ error: "Failed to fetch devices" });
    }
  });
  
  app.delete("/api/devices/:deviceId", authenticateJWT, async (req, res) => {
    const { deviceId } = req.params;
    
    try {
      const success = secureStreamingService.removeUserDevice(req.user!.id, deviceId);
      
      if (!success) {
        return res.status(404).json({ error: "Device not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing device:", error);
      res.status(500).json({ error: "Failed to remove device" });
    }
  });
  
  // Add services to request object
  app.use((req, res, next) => {
    req.downloadService = downloadService;
    next();
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time notifications
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Initialize notification service with WebSocket server
  notificationService.initialize(wss);
  
  return httpServer;
}
