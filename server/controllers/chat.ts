import { Request, Response } from 'express';
import { chatService } from '../services/chatService';

export const chatController = {
  // Process a message from the user and return a response
  processMessage: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Valid message is required' });
      }
      
      const response = await chatService.processMessage(req.user.id, message);
      
      return res.json({ response });
    } catch (error) {
      console.error('Error processing chat message:', error);
      return res.status(500).json({ error: 'Failed to process message' });
    }
  },

  // Verify if a user has downloaded a specific video
  verifyDownload: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { videoId } = req.params;
      
      if (!videoId || isNaN(parseInt(videoId))) {
        return res.status(400).json({ error: 'Valid video ID is required' });
      }
      
      const hasDownloaded = await chatService.verifyDownloadClaims(req.user.id, parseInt(videoId));
      
      return res.json({ hasDownloaded });
    } catch (error) {
      console.error('Error verifying download:', error);
      return res.status(500).json({ error: 'Failed to verify download' });
    }
  },

  // Check the membership status of the current user
  checkMembership: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const membershipStatus = await chatService.checkMembershipStatus(req.user.id);
      
      return res.json(membershipStatus);
    } catch (error) {
      console.error('Error checking membership:', error);
      return res.status(500).json({ error: 'Failed to check membership' });
    }
  }
};