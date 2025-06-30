import { db } from '../db';
import { WebSocket, WebSocketServer } from 'ws';
import { users, videos, releases, notifications } from '@shared/schema';
import { eq, and, gt, desc } from 'drizzle-orm';
import { storage } from '../storage';

// In-memory store of active connections (in production this would be Redis)
interface UserConnection {
  userId: number;
  socket: WebSocket;
  deviceId?: string;
}

// Key: user ID, Value: array of active connections for that user
const activeConnections = new Map<number, UserConnection[]>();

// Release calendar data structure
interface CalendarEvent {
  id: number;
  title: string;
  date: Date;
  type: 'new-video' | 'featured' | 'event' | 'promotion';
  description?: string;
  imageUrl?: string;
  link?: string;
}

export const notificationService = {
  /**
   * Initialize WebSocket server
   */
  initialize(wss: WebSocketServer): void {
    wss.on('connection', (socket, request) => {
      const userId = this.parseUserFromRequest(request);
      const deviceId = this.parseDeviceFromRequest(request);
      
      if (!userId) {
        socket.close(4001, 'Unauthorized');
        return;
      }
      
      this.registerConnection(userId, socket, deviceId);
      
      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(userId, data, socket);
        } catch (error) {
          console.error('Error handling client message:', error);
        }
      });
      
      socket.on('close', () => {
        this.unregisterConnection(userId, socket);
      });
      
      // Send welcome message and pending notifications
      this.sendWelcomeMessage(userId, socket);
      this.sendPendingNotifications(userId, socket);
    });
    
    console.log('Notification service initialized');
  },
  
  /**
   * Parse user ID from request (from authentication)
   * In a real implementation, this would validate the token and extract the user ID
   */
  parseUserFromRequest(request: any): number | null {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      return null;
    }
    
    try {
      // In a real implementation, verify the token and extract the user ID
      // For demo, we'll just extract the user ID from the token
      return parseInt(token, 10);
    } catch (error) {
      console.error('Error parsing user token:', error);
      return null;
    }
  },
  
  /**
   * Parse device ID from request
   */
  parseDeviceFromRequest(request: any): string | undefined {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    return url.searchParams.get('deviceId') || undefined;
  },
  
  /**
   * Register a new WebSocket connection for a user
   */
  registerConnection(userId: number, socket: WebSocket, deviceId?: string): void {
    const existingConnections = activeConnections.get(userId) || [];
    activeConnections.set(userId, [...existingConnections, { userId, socket, deviceId }]);
    
    console.log(`User ${userId} connected. Total connections: ${existingConnections.length + 1}`);
  },
  
  /**
   * Remove a WebSocket connection when closed
   */
  unregisterConnection(userId: number, socket: WebSocket): void {
    const existingConnections = activeConnections.get(userId) || [];
    const remainingConnections = existingConnections.filter(conn => conn.socket !== socket);
    
    if (remainingConnections.length === 0) {
      activeConnections.delete(userId);
    } else {
      activeConnections.set(userId, remainingConnections);
    }
    
    console.log(`User ${userId} disconnected. Remaining connections: ${remainingConnections.length}`);
  },
  
  /**
   * Send a welcome message when a user connects
   */
  sendWelcomeMessage(userId: number, socket: WebSocket): void {
    const message = {
      type: 'welcome',
      message: 'Connected to TheVideoPool notifications',
      timestamp: new Date().toISOString()
    };
    
    socket.send(JSON.stringify(message));
  },
  
  /**
   * Send pending notifications when a user connects
   */
  async sendPendingNotifications(userId: number, socket: WebSocket): Promise<void> {
    try {
      // In a real implementation, fetch unread notifications from the database
      const unreadNotifications = await db
        .select()
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        ))
        .orderBy(desc(notifications.createdAt))
        .limit(10);
      
      if (unreadNotifications.length > 0) {
        const message = {
          type: 'pending-notifications',
          count: unreadNotifications.length,
          notifications: unreadNotifications,
          timestamp: new Date().toISOString()
        };
        
        socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending pending notifications:', error);
    }
  },
  
  /**
   * Handle messages from clients
   */
  async handleClientMessage(userId: number, data: any, socket: WebSocket): Promise<void> {
    const { type, payload } = data;
    
    switch (type) {
      case 'mark-read':
        await this.markNotificationsAsRead(userId, payload.notificationIds);
        break;
        
      case 'get-calendar':
        const calendarEvents = await this.getCalendarEvents(
          payload.startDate, 
          payload.endDate
        );
        socket.send(JSON.stringify({
          type: 'calendar-events',
          events: calendarEvents
        }));
        break;
        
      case 'subscribe-category':
        await this.subscribeToCategory(userId, payload.categoryId);
        socket.send(JSON.stringify({
          type: 'subscription-updated',
          message: 'Subscribed to category updates'
        }));
        break;
        
      default:
        console.log(`Unknown message type: ${type}`);
    }
  },
  
  /**
   * Mark notifications as read
   */
  async markNotificationsAsRead(userId: number, notificationIds: number[]): Promise<void> {
    try {
      await db
        .update(notifications)
        .set({ read: true, readAt: new Date() })
        .where(and(
          eq(notifications.userId, userId),
          notificationIds.length > 0 
            ? db.in(notifications.id, notificationIds) 
            : eq(notifications.read, false)
        ));
      
      console.log(`Marked ${notificationIds.length || 'all'} notifications as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  },
  
  /**
   * Send a notification to a specific user
   */
  async sendNotification(
    userId: number, 
    title: string, 
    message: string, 
    type: string, 
    data?: any
  ): Promise<void> {
    try {
      // Store in database
      const [notification] = await db
        .insert(notifications)
        .values({
          userId,
          title,
          message,
          type,
          data: data ? JSON.stringify(data) : null,
          read: false,
          createdAt: new Date()
        })
        .returning();
      
      // Send to all active connections for this user
      const userConnections = activeConnections.get(userId) || [];
      if (userConnections.length > 0) {
        const notificationData = {
          type: 'notification',
          notification: {
            id: notification.id,
            title,
            message,
            type,
            data,
            timestamp: notification.createdAt?.toISOString()
          }
        };
        
        userConnections.forEach(({ socket }) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(notificationData));
          }
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  },
  
  /**
   * Broadcast a notification to all users or a filtered subset
   */
  async broadcastNotification(
    title: string, 
    message: string, 
    type: string, 
    data?: any,
    filter?: (userId: number) => boolean
  ): Promise<void> {
    try {
      // Insert notifications for all active users
      const allUsers = await storage.getAllUsers();
      
      for (const user of allUsers.users) {
        if (filter && !filter(user.id)) {
          continue;
        }
        
        // Store notification in database
        const [notification] = await db
          .insert(notifications)
          .values({
            userId: user.id,
            title,
            message,
            type,
            data: data ? JSON.stringify(data) : null,
            read: false,
            createdAt: new Date()
          })
          .returning();
        
        // Send to all active connections for this user
        const userConnections = activeConnections.get(user.id) || [];
        if (userConnections.length > 0) {
          const notificationData = {
            type: 'notification',
            notification: {
              id: notification.id,
              title,
              message,
              type,
              data,
              timestamp: notification.createdAt?.toISOString()
            }
          };
          
          userConnections.forEach(({ socket }) => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(notificationData));
            }
          });
        }
      }
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  },
  
  /**
   * Notify users about a new video
   */
  async notifyNewVideo(videoId: number): Promise<void> {
    try {
      const video = await storage.getVideo(videoId);
      if (!video) {
        throw new Error(`Video with ID ${videoId} not found`);
      }
      
      const category = await storage.getCategory(video.categoryId);
      if (!category) {
        throw new Error(`Category with ID ${video.categoryId} not found`);
      }
      
      // Store in releases calendar
      await db
        .insert(releases)
        .values({
          title: video.title,
          description: video.description,
          releaseDate: new Date(),
          type: 'new-video',
          imageUrl: video.thumbnailUrl,
          link: `/video/${video.id}`,
          videoId: video.id,
          categoryId: video.categoryId
        });
      
      // Broadcast to all users who have subscribed to this category
      this.broadcastNotification(
        'New Video Added',
        `"${video.title}" has been added to ${category.name}`,
        'new-video',
        {
          videoId: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          categoryId: video.categoryId,
          categoryName: category.name
        }
      );
    } catch (error) {
      console.error('Error notifying about new video:', error);
    }
  },
  
  /**
   * Get calendar events for a given date range
   */
  async getCalendarEvents(startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
    try {
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date();
      
      // Move end date to the end of the day
      end.setHours(23, 59, 59, 999);
      
      // If no end date specified, default to 30 days from start
      if (!endDate) {
        end.setDate(start.getDate() + 30);
      }
      
      // Fetch releases from the database
      const releaseEvents = await db
        .select()
        .from(releases)
        .where(and(
          gt(releases.releaseDate, start),
          gt(end, releases.releaseDate)
        ))
        .orderBy(releases.releaseDate);
      
      // Convert to CalendarEvent format
      return releaseEvents.map(release => ({
        id: release.id,
        title: release.title,
        date: release.releaseDate as Date,
        type: release.type as any,
        description: release.description || undefined,
        imageUrl: release.imageUrl || undefined,
        link: release.link || undefined
      }));
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  },
  
  /**
   * Subscribe a user to a category for notifications
   */
  async subscribeToCategory(userId: number, categoryId: number): Promise<void> {
    // In a real implementation, store subscription in database
    console.log(`User ${userId} subscribed to category ${categoryId}`);
  },
  
  /**
   * Schedule an event for the release calendar
   */
  async scheduleEvent(event: {
    title: string;
    date: Date;
    type: 'new-video' | 'featured' | 'event' | 'promotion';
    description?: string;
    imageUrl?: string;
    link?: string;
    videoId?: number;
    categoryId?: number;
  }): Promise<void> {
    try {
      await db
        .insert(releases)
        .values({
          title: event.title,
          description: event.description || null,
          releaseDate: event.date,
          type: event.type,
          imageUrl: event.imageUrl || null,
          link: event.link || null,
          videoId: event.videoId || null,
          categoryId: event.categoryId || null
        });
      
      console.log(`Scheduled event "${event.title}" for ${event.date.toISOString()}`);
    } catch (error) {
      console.error('Error scheduling event:', error);
    }
  }
};