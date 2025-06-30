import Anthropic from '@anthropic-ai/sdk';
import { User, Download, Video } from '@shared/schema';
import { storage } from '../storage';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatService {
  private anthropic: Anthropic;
  private userConversations: Map<number, ChatMessage[]> = new Map();
  
  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Missing required environment variable: ANTHROPIC_API_KEY");
      throw new Error("Missing required environment variable: ANTHROPIC_API_KEY");
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  private getConversation(userId: number): ChatMessage[] {
    if (!this.userConversations.has(userId)) {
      this.userConversations.set(userId, []);
    }
    return this.userConversations.get(userId) || [];
  }
  
  private addMessage(userId: number, message: ChatMessage): void {
    const conversation = this.getConversation(userId);
    conversation.push(message);
    
    // Keep conversation history at a reasonable length (last 20 messages)
    if (conversation.length > 20) {
      this.userConversations.set(userId, conversation.slice(conversation.length - 20));
    }
  }
  
  async processMessage(userId: number, message: string): Promise<string> {
    // Add user message to conversation history
    this.addMessage(userId, { role: 'user', content: message });
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if the message requires any backend verification or actions
      await this.handleActions(userId, message);
      
      // Create a system prompt with user context - this now fetches additional data
      const systemPrompt = await this.createSystemPrompt(user);
      
      // Get conversation history
      const conversation = this.getConversation(userId);
      
      // Call Claude AI with the conversation history
      const response = await this.anthropic.messages.create({
        model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        system: systemPrompt,
        max_tokens: 1000,
        messages: conversation.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
      });
      
      // Extract the response content
      let aiResponse = "I couldn't generate a proper response. Please try again.";
      
      // Check if we have content and it's text
      if (response.content && response.content.length > 0 && response.content[0].type === 'text') {
        aiResponse = response.content[0].text;
      }
      
      // Add AI response to conversation history
      this.addMessage(userId, { role: 'assistant', content: aiResponse });
      
      return aiResponse;
    } catch (error) {
      console.error('Error processing chat message:', error);
      return "I'm sorry, I encountered an error while processing your request. Please try again later or contact our support team directly if the issue persists.";
    }
  }
  
  private async createSystemPrompt(user: User): Promise<string> {
    // Fetch additional user data for more context
    const membershipInfo = user.membershipId ? await storage.getMembership(user.membershipId) : null;
    const recentDownloads = await storage.getRecentUserDownloads(user.id, 3);
    
    // Format recent downloads if any exist
    let recentDownloadsText = "No recent downloads.";
    if (recentDownloads && recentDownloads.length > 0) {
      recentDownloadsText = "Recent downloads:\n" + recentDownloads.map(download => 
        `- ${download.video.title} (${new Date(download.createdAt).toLocaleDateString()})`
      ).join("\n");
    }
    
    // Create a rich context for the AI
    return `You are a customer support assistant for TheVideoPool, a premium video content marketplace for DJs. The domain is thevideopool.com and the official support email is info@thevideopool.com.

USER INFORMATION:
- Username: ${user.username}
- Email: ${user.email}
- Account type: ${user.role}
- Membership: ${membershipInfo ? membershipInfo.name : 'None'} 
- Membership duration: ${user.membershipStartDate ? `From ${new Date(user.membershipStartDate).toLocaleDateString()} to ${new Date(user.membershipEndDate || '').toLocaleDateString()}` : 'N/A'}
- Downloads used this period: ${user.downloadsUsed || 0}
- Downloads remaining: ${user.downloadsRemaining || 0}
- Download limit per period: ${membershipInfo ? membershipInfo.downloadLimit : 'N/A'}
${recentDownloadsText}

AVAILABLE MEMBERSHIP TIERS:
- Monthly ($34.99/month): 200 downloads per month
- Quarterly ($99.99/quarter): 250 downloads per month
- Annual ($299.99/year): 300 downloads per month

YOUR ROLE:
Your primary job is to assist users with their TheVideoPool account and answer questions about the service. You should verify user claims against the account data provided above and never simply trust what users tell you about their account status.

HANDLING COMMON ISSUES:
1. LOGIN PROBLEMS: 
   - Ask users to try password reset through the login page
   - Confirm they're using the correct email address
   - Verify they're going to https://thevideopool.com to log in

2. PASSWORD RESETS:
   - Direct users to the "Forgot Password" link on the login page
   - Explain they'll receive an email with reset instructions
   - If they haven't received the email, suggest checking spam/junk folders

3. MEMBERSHIP CHANGES:
   - Explain available plans and their benefits
   - Let users know they can upgrade anytime from their account page
   - Clarify that downgrading takes effect at the end of the current billing period

4. DOWNLOAD ISSUES:
   - Verify user has download credits remaining (reference the data above)
   - Check if the user is trying to download premium content without a membership
   - Suggest trying a different browser or clearing cache if downloads are stalling

5. DOWNLOAD LIMITS:
   - Explain the specific limits for the user's membership tier
   - Clarify when their download count resets (monthly, based on signup date)
   - Note that unused downloads don't roll over to the next period

6. CONTENT QUALITY:
   - Confirm all videos are minimum 1080p with some in 4K
   - Explain that video previews are shorter, lower quality samples
   - Premium content includes exclusive, higher quality videos

7. REFUNDS:
   - Do not make promises about refunds
   - Explain that refund requests must be submitted to info@thevideopool.com
   - Note the refund policy allows refunds within 14 days of purchase if no downloads were made

RESPONSE GUIDELINES:
- Verify all claims against the user data provided above
- Be friendly but factual - don't invent information not provided in this prompt
- When users report technical issues, report them to administrators
- For account-specific actions, verify identity before proceeding
- If a question falls outside your knowledge, suggest contacting info@thevideopool.com
- Never reveal sensitive account details like passwords or payment information
- Do not provide any unauthorized download links or bypass subscription requirements
- When users claim they've downloaded videos, check against their recent download history

The system automatically logs suspicious claims for administrator review, so maintain accuracy in your responses.`;
  }
  
  private async handleActions(userId: number, message: string): Promise<void> {
    // Check for possible action keywords in the message
    const lowerMessage = message.toLowerCase();
    
    // Extract potential video IDs from the message using regex
    const videoIdMatches = message.match(/video\s+#?(\d+)|video\s+id\s+#?(\d+)|video\s+(\d+)/gi);
    let videoIds: number[] = [];
    
    if (videoIdMatches) {
      videoIdMatches.forEach(match => {
        const id = match.replace(/\D/g, '');
        if (id) videoIds.push(parseInt(id));
      });
    }
    
    // Handle download verification claims
    if (lowerMessage.includes('downloaded') || lowerMessage.includes('download credit') || 
        lowerMessage.includes('used download') || lowerMessage.includes('download limit')) {
      
      // If specific videos are mentioned, verify download claims
      for (const videoId of videoIds) {
        const hasDownloaded = await this.verifyDownloadClaims(userId, videoId);
        const videoInfo = await this.checkVideoStatus(videoId);
        
        if (!hasDownloaded && videoInfo.exists) {
          const alertText = `User ${userId} incorrectly claimed to have downloaded video #${videoId} (${videoInfo.title})`;
          await this.logAdminAlert(userId, alertText);
        }
      }
      
      // Check download credit claims
      if (lowerMessage.includes('download credit') || lowerMessage.includes('download limit')) {
        const user = await storage.getUser(userId);
        if (user) {
          // Log suspicious claims about download credits
          const remainingDownloads = user.downloadsRemaining || 0;
          
          // Check for claims about download credits that don't match system data
          if ((lowerMessage.includes('unlimited downloads') || 
               lowerMessage.includes('infinite downloads')) && 
              remainingDownloads < 1000) {
            const alertText = `User ${userId} claimed to have unlimited downloads but has ${remainingDownloads} remaining`;
            await this.logAdminAlert(userId, alertText);
          }
        }
      }
    }
    
    // Handle membership verification claims
    if (lowerMessage.includes('membership') || lowerMessage.includes('subscription') || 
        lowerMessage.includes('paid for') || lowerMessage.includes('premium')) {
      
      const membershipStatus = await this.checkMembershipStatus(userId);
      
      // Check for any false premium claims
      if (lowerMessage.includes('premium') && !membershipStatus.hasMembership) {
        const alertText = `User ${userId} claimed premium status but has no active membership`;
        await this.logAdminAlert(userId, alertText);
      }
      
      // Look for refund requests
      if (lowerMessage.includes('refund') || lowerMessage.includes('money back')) {
        const alertText = `User ${userId} requested refund or chargeback: ${message.substring(0, 100)}...`;
        await this.logAdminAlert(userId, alertText);
      }
    }
    
    // Handle password reset requests
    if (lowerMessage.includes('reset password') || lowerMessage.includes('forgot password') ||
        lowerMessage.includes('change password') || lowerMessage.includes('cant login') ||
        lowerMessage.includes('can\'t login') || lowerMessage.includes('unable to login')) {
      const alertText = `User ${userId} requested password assistance: ${message.substring(0, 100)}...`;
      await this.logAdminAlert(userId, alertText);
    }
    
    // Handle potential admin alert issues
    if (lowerMessage.includes('bug') || lowerMessage.includes('broken') || 
        lowerMessage.includes('doesn\'t work') || lowerMessage.includes('not working') ||
        lowerMessage.includes('error') || lowerMessage.includes('issue') ||
        lowerMessage.includes('problem with') || lowerMessage.includes('trouble with')) {
      const alertText = `Potential issue reported by user ${userId}: ${message.substring(0, 100)}...`;
      await this.logAdminAlert(userId, alertText);
    }
  }
  
  private async logAdminAlert(userId: number, alertText: string): Promise<void> {
    // In a full implementation, this would create an entry in an admin alerts database
    // For now, we'll just log to console
    console.log(`[ADMIN ALERT] ${new Date().toISOString()}: ${alertText}`);
  }
  
  async verifyDownloadClaims(userId: number, videoId: number): Promise<boolean> {
    try {
      // Get the user's download history
      const downloads = await storage.getUserDownloads(userId);
      
      // Check if the video is in the user's download history
      return downloads.some(download => download.videoId === videoId);
    } catch (error) {
      console.error('Error verifying download claims:', error);
      return false;
    }
  }
  
  async checkMembershipStatus(userId: number): Promise<{
    hasMembership: boolean;
    membershipName?: string;
    expirationDate?: Date | null;
    downloadsRemaining?: number | null;
  }> {
    try {
      const user = await storage.getUser(userId);
      
      if (!user || !user.membershipId) {
        return { hasMembership: false };
      }
      
      const membership = await storage.getMembership(user.membershipId);
      
      if (!membership) {
        return { hasMembership: false };
      }
      
      return {
        hasMembership: true,
        membershipName: membership.name,
        expirationDate: user.membershipEndDate,
        downloadsRemaining: user.downloadsRemaining
      };
    } catch (error) {
      console.error('Error checking membership status:', error);
      return { hasMembership: false };
    }
  }
  
  async checkVideoStatus(videoId: number): Promise<{
    exists: boolean;
    title?: string;
    isPremium?: boolean | null;
  }> {
    try {
      const video = await storage.getVideo(videoId);
      
      if (!video) {
        return { exists: false };
      }
      
      return {
        exists: true,
        title: video.title,
        isPremium: video.isPremium
      };
    } catch (error) {
      console.error('Error checking video status:', error);
      return { exists: false };
    }
  }
}

export const chatService = new ChatService();