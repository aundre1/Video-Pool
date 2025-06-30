import { MailService } from '@sendgrid/mail';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, lt, and } from 'drizzle-orm';

// Initialize SendGrid client
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');

// Default daily limit for SendGrid free tier is 100 emails per day
// Adjust this based on your SendGrid plan
const DEFAULT_DAILY_LIMIT = 100;

// Rate limiting - recommended max batch size and time between batches
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000; // 1 second delay between batches

interface EmailCampaignOptions {
  subject: string;
  templateId: string;  // SendGrid template ID
  fromEmail: string;
  fromName: string;
  category: string;    // For tracking in SendGrid analytics
  campaignId?: string; // Optional campaign identifier
  testMode?: boolean;  // If true, sends only to test email
  testEmail?: string;  // Test recipient for verification
  dynamicTemplateData?: Record<string, any>; // Template variables
  dailyLimit?: number; // Override default sending limit
  segmentFilters?: {   // Optional user filtering
    membershipType?: number[];
    lastActiveAfter?: Date;
    lastActiveBefore?: Date;
    hasDownloaded?: boolean;
  };
}

export class EmailMarketingService {
  private campaignStatus: Map<string, {
    totalSent: number;
    started: Date;
    completed?: Date;
    error?: string;
  }> = new Map();

  constructor() {
    // Validate API key on initialization
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY environment variable is not set');
    } else if (!process.env.SENDGRID_API_KEY.startsWith('SG.')) {
      console.error('API key does not start with "SG.".');
    }
  }

  /**
   * Starts an automated email campaign to users
   */
  async startEmailCampaign(options: EmailCampaignOptions): Promise<{
    campaignId: string;
    recipientCount: number;
    estimatedCompletionTime: Date;
  }> {
    // Generate a campaign ID if not provided
    const campaignId = options.campaignId || `campaign-${Date.now()}`;

    // Set campaign as started
    this.campaignStatus.set(campaignId, {
      totalSent: 0,
      started: new Date()
    });

    try {
      // Get eligible recipients
      const recipients = await this.getEligibleRecipients(options);

      // If test mode, only send to test email
      const targetRecipients = options.testMode
        ? [{ email: options.testEmail || 'info@thevideopool.com', id: '0' }]
        : recipients;

      console.log(`Starting campaign "${campaignId}" with ${targetRecipients.length} recipients`);

      // Schedule the sending process to run asynchronously
      this.processCampaignInBatches(campaignId, targetRecipients, options);

      // Calculate estimated completion time
      const totalBatches = Math.ceil(targetRecipients.length / BATCH_SIZE);
      const estimatedTimeMs = totalBatches * BATCH_DELAY_MS;
      const estimatedCompletionTime = new Date(Date.now() + estimatedTimeMs);

      return {
        campaignId,
        recipientCount: targetRecipients.length,
        estimatedCompletionTime
      };
    } catch (error) {
      // Update campaign status with error
      const currentStatus = this.campaignStatus.get(campaignId);
      if (currentStatus) {
        this.campaignStatus.set(campaignId, {
          ...currentStatus,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Process campaign sending in batches to respect rate limits
   */
  private async processCampaignInBatches(
    campaignId: string,
    recipients: { email: string; id: string }[],
    options: EmailCampaignOptions
  ): Promise<void> {
    const dailyLimit = options.dailyLimit || DEFAULT_DAILY_LIMIT;
    let totalSent = 0;

    // Process in batches
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      // Check if we've hit the daily limit
      if (totalSent >= dailyLimit) {
        console.log(`Daily limit of ${dailyLimit} emails reached for campaign ${campaignId}`);
        break;
      }

      // Get the current batch
      const batch = recipients.slice(i, Math.min(i + BATCH_SIZE, recipients.length, totalSent + dailyLimit));
      
      try {
        // Process each email in the batch
        await Promise.all(batch.map(recipient => 
          this.sendTemplateEmail(recipient.email, options)
        ));

        // Update counters
        totalSent += batch.length;

        // Update campaign status
        const currentStatus = this.campaignStatus.get(campaignId);
        if (currentStatus) {
          this.campaignStatus.set(campaignId, {
            ...currentStatus,
            totalSent
          });
        }

        console.log(`Campaign ${campaignId}: Sent batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(recipients.length / BATCH_SIZE)} (${totalSent}/${recipients.length} total)`);

        // Delay between batches to respect rate limits
        if (i + BATCH_SIZE < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      } catch (error) {
        console.error(`Error sending batch for campaign ${campaignId}:`, error);
        // Continue with next batch despite errors
      }
    }

    // Mark campaign as completed
    const currentStatus = this.campaignStatus.get(campaignId);
    if (currentStatus) {
      this.campaignStatus.set(campaignId, {
        ...currentStatus,
        completed: new Date()
      });
    }

    console.log(`Campaign ${campaignId} completed. Total sent: ${totalSent}`);
  }

  /**
   * Send an email using a SendGrid template
   */
  private async sendTemplateEmail(
    toEmail: string,
    options: EmailCampaignOptions
  ): Promise<void> {
    try {
      await mailService.send({
        to: toEmail,
        from: {
          email: options.fromEmail,
          name: options.fromName
        },
        subject: options.subject,
        templateId: options.templateId,
        dynamicTemplateData: options.dynamicTemplateData || {},
        categories: [options.category],
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true }
        }
      });
    } catch (error) {
      console.error(`Failed to send email to ${toEmail}:`, error);
      throw error;
    }
  }

  /**
   * Get campaign status
   */
  getCampaignStatus(campaignId: string): {
    totalSent: number;
    started: Date;
    completed?: Date;
    error?: string;
    inProgress: boolean;
  } | null {
    const status = this.campaignStatus.get(campaignId);
    if (!status) return null;

    return {
      ...status,
      inProgress: !status.completed && !status.error
    };
  }

  /**
   * Get all eligible recipients based on filters
   */
  private async getEligibleRecipients(
    options: EmailCampaignOptions
  ): Promise<{ email: string; id: string }[]> {
    // Start building the query
    let query = db.select({
      id: users.id,
      email: users.email
    })
    .from(users)
    .where(and(
      // Only include users with valid emails
      eq(users.emailValid, true),
      // Only include users who have opted in to marketing emails
      eq(users.marketingOptIn, true)
    ));

    // Apply segment filters if provided
    if (options.segmentFilters) {
      const { 
        membershipType, 
        lastActiveAfter, 
        lastActiveBefore,
        hasDownloaded 
      } = options.segmentFilters;

      // Filter by membership type
      if (membershipType && membershipType.length > 0) {
        // Add membership type condition
        query = query.where(eq(users.membershipId, membershipType[0]));
        // We'd need to adjust this for multiple membership types
      }

      // Filter by last active date
      if (lastActiveAfter) {
        query = query.where(lt(users.lastLoginAt, lastActiveAfter));
      }

      // Add more filters based on segmentFilters...
    }

    // Execute the query
    const eligibleUsers = await query;

    // Return only users with valid emails
    return eligibleUsers
      .filter(user => user.email && user.email.includes('@'))
      .map(user => ({
        email: user.email!,
        id: user.id.toString()
      }));
  }

  /**
   * Create recurring campaign scheduler
   * @param schedule cron-like schedule string
   * @param options Email campaign options
   */
  async scheduleRecurringCampaign(
    schedule: string,
    options: EmailCampaignOptions
  ): Promise<string> {
    // In a production system, you'd use a task scheduler like node-cron
    // For simplicity in this example, we'll just return the concept
    const schedulerId = `schedule-${Date.now()}`;
    
    console.log(`Campaign scheduled with ID ${schedulerId} according to schedule: ${schedule}`);
    console.log('In production, this would use a task scheduler or cron job');
    
    return schedulerId;
  }
}

// Export a singleton instance
export const emailMarketingService = new EmailMarketingService();