import { MailService } from '@sendgrid/mail';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Initialize SendGrid client
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');

interface ABTestVariant {
  id: string;
  name: string;
  subject: string;
  templateId: string;
  previewText?: string;
  dynamicTemplateData?: Record<string, any>;
}

interface ABTestCampaign {
  id: string;
  name: string;
  variants: ABTestVariant[];
  winningCriteria: 'opens' | 'clicks' | 'conversions';
  audiencePercentage: number; // 0-100, percentage of total audience to use for testing
  testDuration: number; // hours before determining winner
  segment?: UserSegment;
}

interface UserSegment {
  // Core demographics
  ageRange?: [number, number]; // min and max age
  membershipTypes?: number[]; // array of membership IDs
  signupDateRange?: [Date, Date]; // signup date between
  
  // Activity-based
  activeInLastDays?: number;
  inactiveForDays?: number;
  minDownloads?: number;
  maxDownloads?: number;
  downloadedGenres?: string[];
  viewedCategories?: string[];
  
  // Engagement
  openedEmailsLastDays?: number;
  clickedEmailsLastDays?: number;
  completedPurchase?: boolean;
  abandonedCart?: boolean;
  
  // Video behavior
  preferredResolution?: string[];
  watchedVideoTypes?: string[];
  
  // Custom metadata
  hasCustomMetadata?: Record<string, any>;
  
  // Geographic
  countries?: string[];
  regions?: string[];
  timezones?: string[];
  
  // Platform
  devices?: ('mobile' | 'desktop' | 'tablet')[];
  browsers?: string[];
  
  // Behavioral scores (calculated elsewhere)
  engagementScore?: [number, number]; // min and max score
  churnRiskScore?: [number, number]; // min and max score
  lifetimeValueScore?: [number, number]; // min and max score
}

// Track A/B test results
interface ABTestResults {
  campaignId: string;
  variantResults: {
    variantId: string;
    recipients: number;
    opens: number;
    clicks: number;
    conversions: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  }[];
  winningVariantId?: string;
  status: 'running' | 'completed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
}

export class EmailABTestingService {
  private activeTests: Map<string, ABTestCampaign> = new Map();
  private testResults: Map<string, ABTestResults> = new Map();
  
  constructor() {
    // Check for SendGrid API key
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY environment variable is not set');
    }
  }
  
  /**
   * Create a new A/B test campaign
   */
  async createABTest(campaign: ABTestCampaign): Promise<string> {
    // Validate campaign has at least 2 variants
    if (!campaign.variants || campaign.variants.length < 2) {
      throw new Error('A/B test requires at least 2 variants');
    }
    
    // Store the campaign
    this.activeTests.set(campaign.id, campaign);
    
    // Initialize results tracking
    this.testResults.set(campaign.id, {
      campaignId: campaign.id,
      variantResults: campaign.variants.map(variant => ({
        variantId: variant.id,
        recipients: 0,
        opens: 0,
        clicks: 0,
        conversions: 0,
        openRate: 0,
        clickRate: 0,
        conversionRate: 0
      })),
      status: 'running',
      startedAt: new Date()
    });
    
    // Schedule the test to run
    await this.runABTest(campaign.id);
    
    // Schedule the winner selection after test duration
    setTimeout(() => {
      this.selectWinningVariant(campaign.id);
    }, campaign.testDuration * 60 * 60 * 1000); // Convert hours to milliseconds
    
    return campaign.id;
  }
  
  /**
   * Run an A/B test campaign by sending emails to segmented users
   */
  private async runABTest(campaignId: string): Promise<void> {
    const campaign = this.activeTests.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }
    
    // Get eligible recipients based on segmentation
    const recipients = await this.getSegmentedUsers(campaign.segment);
    console.log(`Found ${recipients.length} eligible recipients for A/B test ${campaignId}`);
    
    // Calculate how many users to include in test
    const testGroupSize = Math.floor(recipients.length * (campaign.audiencePercentage / 100));
    const testRecipients = recipients.slice(0, testGroupSize);
    
    // Split recipients evenly among variants
    const variantCount = campaign.variants.length;
    const recipientsPerVariant = Math.floor(testRecipients.length / variantCount);
    
    // Send emails for each variant
    for (let i = 0; i < variantCount; i++) {
      const variant = campaign.variants[i];
      const startIdx = i * recipientsPerVariant;
      const endIdx = i === variantCount - 1 
        ? testRecipients.length 
        : (i + 1) * recipientsPerVariant;
      
      const variantRecipients = testRecipients.slice(startIdx, endIdx);
      await this.sendVariantEmails(campaignId, variant, variantRecipients);
      
      // Update results with recipient count
      const results = this.testResults.get(campaignId);
      if (results) {
        const variantResult = results.variantResults.find(r => r.variantId === variant.id);
        if (variantResult) {
          variantResult.recipients = variantRecipients.length;
        }
      }
    }
    
    console.log(`A/B test ${campaignId} has been started with ${testRecipients.length} recipients`);
  }
  
  /**
   * Send emails for a specific variant
   */
  private async sendVariantEmails(
    campaignId: string,
    variant: ABTestVariant, 
    recipients: { email: string; id: string }[]
  ): Promise<void> {
    const campaign = this.activeTests.get(campaignId);
    if (!campaign) return;
    
    console.log(`Sending ${variant.name} to ${recipients.length} recipients`);
    
    // Process in batches to respect rate limits
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, Math.min(i + BATCH_SIZE, recipients.length));
      
      // Create custom tracking parameters for this variant
      const customTracking = {
        campaign_id: campaignId,
        variant_id: variant.id,
        ab_test: 'true'
      };
      
      // Send emails in parallel for the batch
      await Promise.all(batch.map(async recipient => {
        try {
          await mailService.send({
            to: recipient.email,
            from: {
              email: 'marketing@thevideopool.com',
              name: 'TheVideoPool'
            },
            subject: variant.subject,
            templateId: variant.templateId,
            dynamicTemplateData: {
              ...(variant.dynamicTemplateData || {}),
              recipient_id: recipient.id,
              unsubscribe_url: `https://thevideopool.com/unsubscribe?uid=${recipient.id}&campaign=${campaignId}`
            },
            customArgs: customTracking,
            trackingSettings: {
              clickTracking: { enable: true },
              openTracking: { enable: true },
              subscriptionTracking: { enable: true }
            }
          });
        } catch (error) {
          console.error(`Failed to send variant ${variant.id} to ${recipient.email}:`, error);
        }
      }));
      
      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  /**
   * Get segmented users based on criteria
   */
  private async getSegmentedUsers(segment?: UserSegment): Promise<{ email: string; id: string }[]> {
    // Start with a basic query
    let query = db.select({
      id: users.id,
      email: users.email
    })
    .from(users)
    .where(
      // Only include users with valid emails
      sql`json_extract(${users.metadata}, '$.emailValid') IS NULL OR json_extract(${users.metadata}, '$.emailValid') = 'true'`
    );
    
    // We're making a simplified version here - in a real implementation,
    // you would add all the segment conditions from the UserSegment interface
    if (segment) {
      // Example: Filter by membership type
      if (segment.membershipTypes && segment.membershipTypes.length > 0) {
        query = query.where(sql`${users.membershipId} IN (${segment.membershipTypes.join(',')})`);
      }
      
      // Example: Filter by active users
      if (segment.activeInLastDays) {
        const activeDate = new Date();
        activeDate.setDate(activeDate.getDate() - segment.activeInLastDays);
        query = query.where(sql`${users.lastLogin} >= ${activeDate.toISOString()}`);
      }
      
      // Add more segment filters based on your schema
    }
    
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
   * Process event webhook from SendGrid
   */
  async processEventWebhook(events: any[]): Promise<void> {
    for (const event of events) {
      // Extract campaign and variant info from custom args
      const campaignId = event.campaign_id;
      const variantId = event.variant_id;
      
      if (!campaignId || !variantId || event.ab_test !== 'true') {
        continue; // Not an A/B test event
      }
      
      // Update metrics based on event type
      switch (event.event) {
        case 'open':
          await this.recordOpen(campaignId, variantId);
          break;
        case 'click':
          await this.recordClick(campaignId, variantId);
          break;
        case 'purchase':
        case 'conversion':
          await this.recordConversion(campaignId, variantId);
          break;
      }
    }
  }
  
  /**
   * Record an email open event
   */
  private async recordOpen(campaignId: string, variantId: string): Promise<void> {
    const results = this.testResults.get(campaignId);
    if (!results) return;
    
    const variantResult = results.variantResults.find(r => r.variantId === variantId);
    if (variantResult) {
      variantResult.opens++;
      variantResult.openRate = variantResult.opens / variantResult.recipients;
    }
  }
  
  /**
   * Record a link click event
   */
  private async recordClick(campaignId: string, variantId: string): Promise<void> {
    const results = this.testResults.get(campaignId);
    if (!results) return;
    
    const variantResult = results.variantResults.find(r => r.variantId === variantId);
    if (variantResult) {
      variantResult.clicks++;
      variantResult.clickRate = variantResult.clicks / variantResult.recipients;
    }
  }
  
  /**
   * Record a conversion event
   */
  private async recordConversion(campaignId: string, variantId: string): Promise<void> {
    const results = this.testResults.get(campaignId);
    if (!results) return;
    
    const variantResult = results.variantResults.find(r => r.variantId === variantId);
    if (variantResult) {
      variantResult.conversions++;
      variantResult.conversionRate = variantResult.conversions / variantResult.recipients;
    }
  }
  
  /**
   * Select the winning variant based on test results
   */
  async selectWinningVariant(campaignId: string): Promise<string | undefined> {
    const campaign = this.activeTests.get(campaignId);
    const results = this.testResults.get(campaignId);
    
    if (!campaign || !results) {
      return undefined;
    }
    
    // Determine which metric to use for selecting the winner
    const winningCriteria = campaign.winningCriteria;
    
    // Sort variants by the winning criteria
    results.variantResults.sort((a, b) => {
      if (winningCriteria === 'opens') {
        return b.openRate - a.openRate;
      } else if (winningCriteria === 'clicks') {
        return b.clickRate - a.clickRate;
      } else { // conversions
        return b.conversionRate - a.conversionRate;
      }
    });
    
    // The winner is the first in the sorted list
    const winner = results.variantResults[0];
    
    // Update the test results
    results.winningVariantId = winner.variantId;
    results.status = 'completed';
    results.completedAt = new Date();
    
    console.log(`A/B test ${campaignId} completed. Winner: ${winner.variantId}`);
    
    // Return the ID of the winning variant
    return winner.variantId;
  }
  
  /**
   * Get the results of an A/B test
   */
  getTestResults(campaignId: string): ABTestResults | undefined {
    return this.testResults.get(campaignId);
  }
}

// Export a singleton instance
export const emailABTestingService = new EmailABTestingService();