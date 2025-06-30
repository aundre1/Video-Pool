import { Request, Response } from "express";
import { db } from "../db";
import { 
  emailCampaigns, 
  emailSubscribers, 
  emailSends, 
  users,
  insertEmailCampaignSchema,
  insertEmailSubscriberSchema
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { emailService } from "../services/emailService";
import { z } from "zod";

// Validate import user data
const importUsersSchema = z.object({
  users: z.array(z.object({
    email: z.string().email(),
    username: z.string().optional(),
    isSubscribed: z.boolean().optional()
  }))
});

// Validate campaign creation data
const createCampaignSchema = z.object({
  name: z.string(),
  subject: z.string(),
  htmlContent: z.string(),
  textContent: z.string(),
  sendRate: z.number().optional(),
  scheduledTime: z.string().optional(),
  segmentOptions: z.object({
    membershipId: z.number().nullable().optional(),
    lastLoginDays: z.number().optional(),
    inactiveOnly: z.boolean().optional(),
    downloadsMin: z.number().optional(),
    downloadsMax: z.number().optional()
  }).optional()
});

// Validate AI newsletter generation data
const generateNewsletterSchema = z.object({
  topVideoIds: z.array(z.number()),
  promotionalText: z.string(),
  userSegment: z.string().optional()
});

export const emailController = {
  // Get all email campaigns with pagination
  getCampaigns: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const campaigns = await db.select()
        .from(emailCampaigns)
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${emailCampaigns.createdAt} DESC`);

      const totalCount = await db
        .select({ count: sql`COUNT(*)` })
        .from(emailCampaigns);

      res.status(200).json({
        campaigns,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(Number(totalCount[0].count) / limit),
          totalCount: Number(totalCount[0].count)
        }
      });
    } catch (error) {
      console.error("Error getting campaigns:", error);
      res.status(500).json({ message: "Failed to retrieve email campaigns" });
    }
  },

  // Get a single campaign by ID
  getCampaign: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      const [campaign] = await db.select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));

      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Get campaign stats
      const [stats] = await db
        .select({
          sentCount: sql`COUNT(CASE WHEN ${emailSends.status} = 'sent' THEN 1 END)`,
          openCount: sql`COUNT(CASE WHEN ${emailSends.openedAt} IS NOT NULL THEN 1 END)`,
          clickCount: sql`COUNT(CASE WHEN ${emailSends.clickedAt} IS NOT NULL THEN 1 END)`
        })
        .from(emailSends)
        .where(eq(emailSends.campaignId, parseInt(id)));

      res.status(200).json({
        ...campaign,
        stats
      });
    } catch (error) {
      console.error("Error getting campaign:", error);
      res.status(500).json({ message: "Failed to retrieve email campaign" });
    }
  },

  // Create a new email campaign
  createCampaign: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = createCampaignSchema.parse(req.body);
      
      const [campaign] = await db.insert(emailCampaigns)
        .values({
          name: validatedData.name,
          subject: validatedData.subject,
          htmlContent: validatedData.htmlContent,
          textContent: validatedData.textContent,
          status: "draft",
          sendRate: validatedData.sendRate || 100,
          scheduledTime: validatedData.scheduledTime ? new Date(validatedData.scheduledTime) : null,
          segmentOptions: validatedData.segmentOptions || {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create email campaign" });
    }
  },

  // Update an existing campaign
  updateCampaign: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const validatedData = createCampaignSchema.partial().parse(req.body);
      
      // Check if campaign exists
      const [existingCampaign] = await db.select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));
      
      if (!existingCampaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Prevent updating campaigns that are already sending or complete
      if (existingCampaign.status === "sending" || existingCampaign.status === "complete") {
        return res.status(400).json({ message: "Cannot update a campaign that is already sending or complete" });
      }
      
      const [updatedCampaign] = await db.update(emailCampaigns)
        .set({
          ...validatedData,
          scheduledTime: validatedData.scheduledTime ? new Date(validatedData.scheduledTime) : existingCampaign.scheduledTime,
          updatedAt: new Date()
        })
        .where(eq(emailCampaigns.id, parseInt(id)))
        .returning();

      res.status(200).json(updatedCampaign);
    } catch (error) {
      console.error("Error updating campaign:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update email campaign" });
    }
  },

  // Delete a campaign
  deleteCampaign: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Check if campaign exists
      const [existingCampaign] = await db.select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));
      
      if (!existingCampaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Prevent deleting campaigns that are currently sending
      if (existingCampaign.status === "sending") {
        return res.status(400).json({ message: "Cannot delete a campaign that is currently sending" });
      }

      // Cancel if scheduled
      if (existingCampaign.status === "scheduled") {
        emailService.cancelScheduledCampaign(parseInt(id));
      }
      
      // Delete campaign
      await db.delete(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));

      res.status(200).json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error("Error deleting campaign:", error);
      res.status(500).json({ message: "Failed to delete email campaign" });
    }
  },

  // Schedule a campaign to be sent
  scheduleCampaign: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { scheduledTime, sendRate } = req.body;
      
      if (!scheduledTime) {
        return res.status(400).json({ message: "scheduledTime is required" });
      }
      
      // Check if campaign exists
      const [existingCampaign] = await db.select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));
      
      if (!existingCampaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Update campaign status and scheduled time
      const [updatedCampaign] = await db.update(emailCampaigns)
        .set({
          status: "scheduled",
          scheduledTime: new Date(scheduledTime),
          sendRate: sendRate || existingCampaign.sendRate,
          updatedAt: new Date()
        })
        .where(eq(emailCampaigns.id, parseInt(id)))
        .returning();
      
      // Schedule the campaign
      emailService.scheduleCampaign({
        ...updatedCampaign,
        template: {
          subject: updatedCampaign.subject,
          htmlContent: updatedCampaign.htmlContent,
          textContent: updatedCampaign.textContent
        },
        segmentOptions: updatedCampaign.segmentOptions as any
      });

      res.status(200).json(updatedCampaign);
    } catch (error) {
      console.error("Error scheduling campaign:", error);
      res.status(500).json({ message: "Failed to schedule email campaign" });
    }
  },

  // Send a campaign immediately
  sendCampaignNow: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Check if campaign exists
      const [existingCampaign] = await db.select()
        .from(emailCampaigns)
        .where(eq(emailCampaigns.id, parseInt(id)));
      
      if (!existingCampaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Update campaign status
      const [updatedCampaign] = await db.update(emailCampaigns)
        .set({
          status: "sending",
          updatedAt: new Date()
        })
        .where(eq(emailCampaigns.id, parseInt(id)))
        .returning();
      
      // Get target users based on segment options
      const targetUsers = await emailService.getUsersForCampaign(
        updatedCampaign.segmentOptions as any
      );
      
      // Send the campaign
      emailService.sendBatchWithRateLimit(
        {
          ...updatedCampaign,
          template: {
            subject: updatedCampaign.subject,
            htmlContent: updatedCampaign.htmlContent,
            textContent: updatedCampaign.textContent
          },
          segmentOptions: updatedCampaign.segmentOptions as any
        },
        targetUsers,
        updatedCampaign.sendRate,
        async (sentCount, totalCount) => {
          // Update campaign status if all emails have been sent
          if (sentCount === totalCount) {
            await db.update(emailCampaigns)
              .set({
                status: "complete",
                updatedAt: new Date()
              })
              .where(eq(emailCampaigns.id, parseInt(id)));
          }
        }
      );

      res.status(200).json({
        ...updatedCampaign,
        message: `Campaign is being sent to ${targetUsers.length} recipients at a rate of ${updatedCampaign.sendRate} emails per hour`
      });
    } catch (error) {
      console.error("Error sending campaign:", error);
      res.status(500).json({ message: "Failed to send email campaign" });
    }
  },

  // Import users from external source (MySQL database)
  importUsers: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = importUsersSchema.parse(req.body);
      
      const importedCount = {
        total: validatedData.users.length,
        created: 0,
        updated: 0,
        skipped: 0
      };

      for (const userData of validatedData.users) {
        // Check if user already exists in subscribers
        const [existingSubscriber] = await db.select()
          .from(emailSubscribers)
          .where(eq(emailSubscribers.email, userData.email));
        
        if (existingSubscriber) {
          // Update existing subscriber
          await db.update(emailSubscribers)
            .set({
              isSubscribed: userData.isSubscribed ?? existingSubscriber.isSubscribed,
              updatedAt: new Date()
            })
            .where(eq(emailSubscribers.id, existingSubscriber.id));
          
          importedCount.updated++;
          continue;
        }
        
        // Check if email exists in users table
        const [existingUser] = await db.select()
          .from(users)
          .where(eq(users.email, userData.email));
        
        // Create new subscriber
        await db.insert(emailSubscribers)
          .values({
            email: userData.email,
            userId: existingUser?.id || null,
            isSubscribed: userData.isSubscribed ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        
        importedCount.created++;
      }

      res.status(200).json({
        message: "Users imported successfully",
        importedCount
      });
    } catch (error) {
      console.error("Error importing users:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to import users" });
    }
  },

  // Generate newsletter content with AI
  generateNewsletter: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validatedData = generateNewsletterSchema.parse(req.body);
      
      // Generate newsletter content using emailService
      const template = await emailService.generateNewsletterContent(
        validatedData.topVideoIds,
        validatedData.promotionalText,
        validatedData.userSegment
      );

      res.status(200).json(template);
    } catch (error) {
      console.error("Error generating newsletter:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid newsletter data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to generate newsletter content" });
    }
  },

  // Get all email subscribers with pagination
  getSubscribers: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      const search = req.query.search as string;

      let query = db.select({
        id: emailSubscribers.id,
        email: emailSubscribers.email,
        isSubscribed: emailSubscribers.isSubscribed,
        unsubscribedAt: emailSubscribers.unsubscribedAt,
        createdAt: emailSubscribers.createdAt,
        username: users.username
      })
        .from(emailSubscribers)
        .leftJoin(users, eq(emailSubscribers.userId, users.id))
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${emailSubscribers.createdAt} DESC`);

      if (search) {
        query = query.where(
          sql`${emailSubscribers.email} LIKE ${'%' + search + '%'} OR ${users.username} LIKE ${'%' + search + '%'}`
        );
      }

      const subscribers = await query;

      // Get total count
      let countQuery = db
        .select({ count: sql`COUNT(*)` })
        .from(emailSubscribers);

      if (search) {
        countQuery = countQuery.leftJoin(users, eq(emailSubscribers.userId, users.id))
          .where(
            sql`${emailSubscribers.email} LIKE ${'%' + search + '%'} OR ${users.username} LIKE ${'%' + search + '%'}`
          );
      }

      const totalCount = await countQuery;

      res.status(200).json({
        subscribers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(Number(totalCount[0].count) / limit),
          totalCount: Number(totalCount[0].count)
        }
      });
    } catch (error) {
      console.error("Error getting subscribers:", error);
      res.status(500).json({ message: "Failed to retrieve email subscribers" });
    }
  },

  // Update a subscriber's status
  updateSubscriber: async (req: Request, res: Response) => {
    try {
      if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { isSubscribed } = req.body;
      
      if (isSubscribed === undefined) {
        return res.status(400).json({ message: "isSubscribed field is required" });
      }

      // Check if subscriber exists
      const [existingSubscriber] = await db.select()
        .from(emailSubscribers)
        .where(eq(emailSubscribers.id, parseInt(id)));
      
      if (!existingSubscriber) {
        return res.status(404).json({ message: "Subscriber not found" });
      }

      // Update subscriber
      const [updatedSubscriber] = await db.update(emailSubscribers)
        .set({
          isSubscribed,
          unsubscribedAt: isSubscribed ? null : new Date(),
          updatedAt: new Date()
        })
        .where(eq(emailSubscribers.id, parseInt(id)))
        .returning();

      res.status(200).json(updatedSubscriber);
    } catch (error) {
      console.error("Error updating subscriber:", error);
      res.status(500).json({ message: "Failed to update subscriber" });
    }
  },

  // Bulk unsubscribe route for users to opt-out
  unsubscribe: async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Update subscriber
      const [updatedSubscriber] = await db.update(emailSubscribers)
        .set({
          isSubscribed: false,
          unsubscribedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(emailSubscribers.email, email as string))
        .returning();

      if (!updatedSubscriber) {
        return res.status(404).json({ message: "Email not found in our subscription list" });
      }

      res.status(200).json({ message: "Successfully unsubscribed" });
    } catch (error) {
      console.error("Error unsubscribing:", error);
      res.status(500).json({ message: "Failed to unsubscribe" });
    }
  }
};