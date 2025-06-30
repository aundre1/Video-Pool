import { Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { addMonths } from "date-fns";

// Subscribe schema
const subscribeSchema = z.object({
  membershipId: z.number().int().positive(),
  paymentMethod: z.string().min(1),
  paymentToken: z.string().optional(),
});

// Controller for memberships
export const membershipsController = {
  // Get all memberships
  getMemberships: async (req: Request, res: Response) => {
    try {
      const memberships = await storage.getAllMemberships();
      
      res.status(200).json(memberships);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Get a single membership
  getMembership: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const membership = await storage.getMembership(parseInt(id));
      
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      res.status(200).json(membership);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  },
  
  // Subscribe to a membership
  subscribeMembership: async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Validate request body
      const validatedData = subscribeSchema.parse(req.body);
      
      // Get membership
      const membership = await storage.getMembership(validatedData.membershipId);
      
      if (!membership) {
        return res.status(404).json({ message: "Membership not found" });
      }
      
      // Process payment (would be implemented in a real app)
      
      // Calculate membership dates and download limits
      const now = new Date();
      let endDate: Date;
      
      switch (membership.billingCycle) {
        case "monthly":
          endDate = addMonths(now, 1);
          break;
        case "quarterly":
          endDate = addMonths(now, 3);
          break;
        case "annual":
          endDate = addMonths(now, 12);
          break;
        default:
          endDate = addMonths(now, 1); // Default to monthly
      }
      
      // Update user with membership details
      const updatedUser = await storage.updateUser(req.user.id, {
        membershipId: membership.id,
        membershipStartDate: now,
        membershipEndDate: endDate,
        downloadsRemaining: membership.downloadLimit,
      });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json({
        message: "Subscription successful",
        user: userWithoutPassword,
        membership
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  }
};
