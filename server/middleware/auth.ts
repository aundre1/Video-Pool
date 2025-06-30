import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";
import { User } from "@shared/schema";

// Secret for JWT
const JWT_SECRET = process.env.JWT_SECRET || "videopool_secret_key";

// Interface to extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Generate JWT token
export const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};

// Middleware to authenticate JWT
export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from cookies or auth header
    const token = req.cookies?.authToken || req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    
    // Get user from storage
    const user = await storage.getUser(decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware to check admin role
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admin permission required" });
  }
  
  next();
};
