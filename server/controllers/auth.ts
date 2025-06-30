import { Request, Response } from "express";
import { storage } from "../storage";
import { insertUserSchema } from "@shared/schema";
import { generateToken } from "../middleware/auth";
import { z } from "zod";

// Login schema
const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Controller for authentication
export const authController = {
  // Register a new user
  register: async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUsername = await storage.getUserByUsername(validatedData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(validatedData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // In a real app, would hash the password here
      
      // Create user
      const user = await storage.createUser({
        ...validatedData,
        role: "user", // Default role
      });
      
      // Generate token
      const token = generateToken(user);
      
      // Set token in cookie
      res.cookie("authToken", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production"
      });
      
      // Don't return password
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Login user
  login: async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = loginSchema.parse(req.body);
      
      // Get user by username
      const user = await storage.getUserByUsername(validatedData.username);
      
      // Check if user exists
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // In a real app, would compare hashed passwords
      if (user.password !== validatedData.password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Generate token
      const token = generateToken(user);
      
      // Set token in cookie
      res.cookie("authToken", token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production"
      });
      
      // Don't return password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json({ user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  },
  
  // Logout user
  logout: async (req: Request, res: Response) => {
    try {
      // Clear auth cookie
      res.clearCookie("authToken");
      
      res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get current user
  getCurrentUser: async (req: Request, res: Response) => {
    try {
      // Get token from cookies or auth header
      const token = req.cookies?.authToken || req.headers.authorization?.split(" ")[1];
      
      if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Verify token
      const decoded = await import("jsonwebtoken").then(jwt => 
        jwt.verify(token, process.env.JWT_SECRET || "videopool_secret_key") as { id: number }
      );
      
      // Get user from storage
      const user = await storage.getUser(decoded.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      // Invalid token
      res.status(401).json({ message: "Invalid or expired token" });
    }
  }
};
