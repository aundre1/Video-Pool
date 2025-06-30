import { MailService } from '@sendgrid/mail';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Initialize SendGrid Mail Service
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface EmailCampaign {
  id?: number;
  name: string;
  template: EmailTemplate;
  segmentOptions?: {
    membershipId?: number | null;
    lastLoginDays?: number;
    inactiveOnly?: boolean;
    downloadsMin?: number;
    downloadsMax?: number;
  };
  status: 'draft' | 'scheduled' | 'sending' | 'complete';
  sendRate?: number; // emails per hour
  scheduledTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
  };
}

export class EmailService {
  // Rate limiting variables
  private currentHourSentCount: number = 0;
  private lastSendTimestamp: number = Date.now();
  private activeJobs: Map<number, NodeJS.Timeout> = new Map();

  // Check if we should send more emails based on rate limits
  private shouldSendEmail(rateLimit: number): boolean {
    const now = Date.now();
    const hourInMs = 3600000;
    
    // Reset counter if it's been more than an hour since we started sending
    if (now - this.lastSendTimestamp > hourInMs) {
      this.currentHourSentCount = 0;
      this.lastSendTimestamp = now;
    }
    
    return this.currentHourSentCount < rateLimit;
  }

  // Get users based on segment options
  async getUsersForCampaign(options?: EmailCampaign['segmentOptions']): Promise<{ id: number; email: string; username: string }[]> {
    if (!options) {
      // Get all users with valid emails
      const allUsers = await db.select({
        id: users.id,
        email: users.email,
        username: users.username
      }).from(users);
      
      return allUsers.filter(user => user.email && user.email.includes('@'));
    }

    let query = db.select({
      id: users.id,
      email: users.email,
      username: users.username
    }).from(users);

    // Add filters based on options
    if (options.membershipId !== undefined) {
      if (options.membershipId === null) {
        query = query.where(sql`${users.membershipId} IS NULL`);
      } else {
        query = query.where(eq(users.membershipId, options.membershipId));
      }
    }

    if (options.lastLoginDays) {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - options.lastLoginDays);
      // Note: This would require a lastLogin field in the users table
      // query = query.where(sql`${users.lastLogin} <= ${dateThreshold.toISOString()}`);
    }

    if (options.downloadsMin !== undefined) {
      query = query.where(sql`${users.downloadsUsed} >= ${options.downloadsMin}`);
    }

    if (options.downloadsMax !== undefined) {
      query = query.where(sql`${users.downloadsUsed} <= ${options.downloadsMax}`);
    }

    const filteredUsers = await query;
    return filteredUsers.filter(user => user.email && user.email.includes('@'));
  }

  // Send a single email
  async sendEmail(to: string, template: EmailTemplate, fromEmail: string = 'info@thevideopool.com', fromName: string = 'TheVideoPool'): Promise<boolean> {
    try {
      await mailService.send({
        to,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Send a batch of emails with rate limiting
  async sendBatchWithRateLimit(
    campaign: EmailCampaign,
    userEmails: { id: number; email: string; username: string }[],
    ratePerHour: number = 100,
    onProgress?: (sentCount: number, totalCount: number) => void
  ): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
    let sentCount = 0;
    let failedCount = 0;
    const totalEmails = userEmails.length;
    
    // Calculate how many milliseconds to wait between emails to achieve the desired rate
    const delayBetweenEmails = Math.ceil(3600000 / ratePerHour);
    
    const sendWithDelay = (index: number) => {
      if (index >= userEmails.length) {
        // All emails have been sent
        if (onProgress) onProgress(sentCount, totalEmails);
        return;
      }
      
      const user = userEmails[index];
      
      // Personalize the email for this user
      const personalizedTemplate = this.personalizeTemplate(campaign.template, user);
      
      this.sendEmail(user.email, personalizedTemplate)
        .then(success => {
          if (success) {
            sentCount++;
            this.currentHourSentCount++;
          } else {
            failedCount++;
          }
          
          if (onProgress) onProgress(sentCount, totalEmails);
          
          // Schedule the next email
          const jobId = setTimeout(() => sendWithDelay(index + 1), delayBetweenEmails);
          if (campaign.id) {
            this.activeJobs.set(campaign.id, jobId);
          }
        });
    };
    
    // Start the sending process
    sendWithDelay(0);
    
    return { success: true, sentCount, failedCount };
  }

  // Replace placeholders in template with user data
  private personalizeTemplate(
    template: EmailTemplate, 
    user: { id: number; email: string; username: string }
  ): EmailTemplate {
    const personalized = { ...template };
    
    // Simple replacements
    const replacements: Record<string, string> = {
      '{{username}}': user.username,
      '{{email}}': user.email,
      '{{user_id}}': user.id.toString(),
      '{{current_date}}': new Date().toLocaleDateString(),
      '{{unsubscribe_link}}': `https://thevideopool.com/unsubscribe?email=${encodeURIComponent(user.email)}`
    };
    
    // Apply replacements to both HTML and text content
    Object.entries(replacements).forEach(([placeholder, value]) => {
      personalized.htmlContent = personalized.htmlContent.replace(new RegExp(placeholder, 'g'), value);
      personalized.textContent = personalized.textContent.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return personalized;
  }

  // Schedule a campaign to be sent at a specific time
  scheduleCampaign(campaign: EmailCampaign): void {
    if (!campaign.scheduledTime) {
      throw new Error('Cannot schedule campaign without a scheduledTime');
    }
    
    const now = new Date();
    const scheduledTime = new Date(campaign.scheduledTime);
    const delayMs = scheduledTime.getTime() - now.getTime();
    
    if (delayMs <= 0) {
      console.error('Scheduled time is in the past');
      return;
    }
    
    const jobId = setTimeout(async () => {
      // Get users for this campaign
      const targetUsers = await this.getUsersForCampaign(campaign.segmentOptions);
      
      // Send the campaign
      this.sendBatchWithRateLimit(
        campaign,
        targetUsers,
        campaign.sendRate || 100
      );
    }, delayMs);
    
    if (campaign.id) {
      this.activeJobs.set(campaign.id, jobId);
    }
  }

  // Cancel a scheduled campaign
  cancelScheduledCampaign(campaignId: number): boolean {
    const jobId = this.activeJobs.get(campaignId);
    if (jobId) {
      clearTimeout(jobId);
      this.activeJobs.delete(campaignId);
      return true;
    }
    return false;
  }

  // Generate a newsletter using AI-enhanced content
  async generateNewsletterContent(
    topVideoIds: number[],
    promotionalText: string,
    userSegment?: string
  ): Promise<EmailTemplate> {
    // In a real implementation, this would call an AI service or OpenAI to generate content
    // For now, we'll create a template with placeholders
    
    // This method would fetch video data and generate content based on it
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TheVideoPool - Latest Updates</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #8a2be2; padding-bottom: 20px; }
        .logo { max-width: 200px; }
        h1 { color: #8a2be2; }
        .content { margin-bottom: 30px; }
        .footer { text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        .button { display: inline-block; background: linear-gradient(135deg, #8a2be2, #ff1493); color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-weight: bold; }
        .video-section { margin: 20px 0; }
        .video-item { margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://thevideopool.com/wp-content/uploads/2019/02/logo.png" alt="TheVideoPool Logo" class="logo">
        <h1>DJ Video Content Update</h1>
        ${userSegment ? `<p>Special selection for our ${userSegment} members</p>` : ''}
      </div>
      
      <div class="content">
        <p>Hello {{username}},</p>
        
        <p>${promotionalText}</p>
        
        <div class="video-section">
          <h2>Featured Videos This Week</h2>
          <!-- Video content would be generated dynamically -->
          <div class="video-item">
            <h3>New Trending Music Videos</h3>
            <p>Check out the hottest new video content for your sets!</p>
          </div>
        </div>
        
        <p>Don't miss out on our latest additions. Log in now to browse and download!</p>
        
        <p style="text-align: center;">
          <a href="https://thevideopool.com/login" class="button">LOG IN NOW</a>
        </p>
      </div>
      
      <div class="footer">
        <p>© ${new Date().getFullYear()} TheVideoPool. All rights reserved.</p>
        <p>
          <a href="https://thevideopool.com/terms">Terms of Service</a> | 
          <a href="https://thevideopool.com/privacy">Privacy Policy</a> | 
          <a href="{{unsubscribe_link}}">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
    `;
    
    const textContent = `
    TheVideoPool - Latest Updates
    
    Hello {{username}},
    
    ${promotionalText}
    
    Featured Videos This Week:
    - New trending music videos
    - Check out the hottest new video content for your sets!
    
    Don't miss out on our latest additions. Log in now to browse and download!
    
    Visit: https://thevideopool.com/login
    
    © ${new Date().getFullYear()} TheVideoPool. All rights reserved.
    
    Terms of Service: https://thevideopool.com/terms
    Privacy Policy: https://thevideopool.com/privacy
    Unsubscribe: {{unsubscribe_link}}
    `;
    
    return {
      subject: `TheVideoPool - New DJ Videos Available${userSegment ? ` for ${userSegment}` : ''}`,
      htmlContent,
      textContent
    };
  }
}

export const emailService = new EmailService();