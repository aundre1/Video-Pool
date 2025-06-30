import { Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";

// Update profile schema
const updateProfileSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

// Controller for users
export const usersController = {
  // Get user downloads
  getUserDownloads: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const downloads = await storage.getUserDownloads(req.user.id);
      
      res.status(200).json(downloads);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get recent user downloads with video data
  getRecentDownloads: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const downloads = await storage.getRecentUserDownloads(req.user.id, 5);
      
      res.status(200).json(downloads);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get user profile
  getUserProfile: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = req.user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Update user profile
  updateUserProfile: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Validate request body
      const validatedData = updateProfileSchema.parse(req.body);
      
      // Check if username is taken
      if (validatedData.username) {
        const existingUser = await storage.getUserByUsername(validatedData.username);
        
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }
      
      // Check if email is taken
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        
        if (existingUser && existingUser.id !== req.user.id) {
          return res.status(400).json({ message: "Email already registered" });
        }
      }
      
      // In a real app, would hash the password here if provided
      
      // Update user
      const updatedUser = await storage.updateUser(req.user.id, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Admin Routes
  
  // Get admin statistics
  getAdminStatistics: async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStatistics();
      
      res.status(200).json(stats);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get all users (admin)
  getAllUsers: async (req: Request, res: Response) => {
    try {
      const { search, membership, page = "1", limit = "10" } = req.query;
      
      // Convert query params to correct types
      const filter = {
        searchTerm: search as string,
        membershipId: membership ? parseInt(membership as string) : undefined,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };
      
      const result = await storage.getAllUsers(filter);
      
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get a single user (admin)
  getUserById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const user = await storage.getUser(parseInt(id));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get user's download history
      const downloads = await storage.getUserDownloads(parseInt(id));
      
      // Don't return password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json({
        user: userWithoutPassword,
        downloads
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Update a user (admin)
  updateUser: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // For admin, allow updating all fields
      const updateSchema = z.object({
        username: z.string().min(3).optional(),
        email: z.string().email().optional(),
        password: z.string().min(6).optional(),
        role: z.enum(["user", "admin"]).optional(),
        membershipId: z.number().int().nullable().optional(),
        membershipStartDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
        membershipEndDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
        downloadsRemaining: z.number().int().optional(),
        downloadsUsed: z.number().int().optional(),
      });
      
      // Validate request body
      const validatedData = updateSchema.parse(req.body);
      
      // Check if username is taken
      if (validatedData.username) {
        const existingUser = await storage.getUserByUsername(validatedData.username);
        
        if (existingUser && existingUser.id !== parseInt(id)) {
          return res.status(400).json({ message: "Username already taken" });
        }
      }
      
      // Check if email is taken
      if (validatedData.email) {
        const existingUser = await storage.getUserByEmail(validatedData.email);
        
        if (existingUser && existingUser.id !== parseInt(id)) {
          return res.status(400).json({ message: "Email already registered" });
        }
      }
      
      // Check if membership exists if provided
      if (validatedData.membershipId) {
        const membership = await storage.getMembership(validatedData.membershipId);
        
        if (!membership) {
          return res.status(400).json({ message: "Invalid membership" });
        }
      }
      
      // In a real app, would hash the password here if provided
      
      // Update user
      const updatedUser = await storage.updateUser(parseInt(id), validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Delete a user (admin)
  deleteUser: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting self
      if (req.user?.id === parseInt(id)) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(parseInt(id));
      
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  }
};
