import path from 'path';
import { validateAllEmails } from './email-validator';
import { emailMarketingService } from '../services/emailMarketingService';

// Email templates to use (These would be created in your SendGrid account)
const EMAIL_TEMPLATES = {
  WELCOME: 'd-abcdef123456', // Replace with your actual template IDs
  WEEKLY_DROPS: 'd-123456abcdef',
  SPECIAL_PROMO: 'd-xyz987654321',
  FEATURE_ANNOUNCEMENT: 'd-987654xyz321'
};

/**
 * Main function to run the automated email process
 */
async function runAutomatedEmailProcess() {
  try {
    console.log('=== STARTING AUTOMATED EMAIL PROCESS ===');
    
    // Step 1: Validate all emails
    console.log('\n1. Validating email addresses...');
    const validationResults = await validateAllEmails(100, false); // Set to true for SMTP checks
    console.log(`Email validation complete:`);
    console.log(`- Total checked: ${validationResults.totalChecked}`);
    console.log(`- Valid: ${validationResults.valid}`);
    console.log(`- Invalid: ${validationResults.invalid}`);
    
    // Step 2: Run weekly DJ drops campaign
    console.log('\n2. Starting Weekly DJ Drops campaign...');
    const weeklyDropsResult = await emailMarketingService.startEmailCampaign({
      subject: '🎵 This Week\'s Fresh DJ Drops Just Landed!',
      templateId: EMAIL_TEMPLATES.WEEKLY_DROPS,
      fromEmail: 'djdrops@thevideopool.com',
      fromName: 'TheVideoPool DJ Team',
      category: 'weekly-drops',
      dynamicTemplateData: {
        date: new Date().toLocaleDateString(),
        featuredCategories: ['Hip-Hop', 'Dance', 'Reggaeton'],
        previewLink: 'https://thevideopool.com/weekly-drops'
      },
      // Filter for active members who haven't logged in recently
      segmentFilters: {
        membershipType: [1, 2, 3], // All paid membership types
        lastActiveBefore: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      }
    });
    
    console.log(`Weekly DJ Drops campaign started:`);
    console.log(`- Campaign ID: ${weeklyDropsResult.campaignId}`);
    console.log(`- Recipients: ${weeklyDropsResult.recipientCount}`);
    console.log(`- Est. completion: ${weeklyDropsResult.estimatedCompletionTime}`);
    
    // Step 3: Schedule promotional campaign for next week
    console.log('\n3. Scheduling upcoming promo campaign...');
    const nextMonday = getNextMonday();
    const scheduledCampaignId = await emailMarketingService.scheduleRecurringCampaign(
      '0 10 * * 1', // Every Monday at 10am
      {
        subject: '🔥 Limited Time Offer: Save 20% on Annual Membership',
        templateId: EMAIL_TEMPLATES.SPECIAL_PROMO,
        fromEmail: 'promos@thevideopool.com',
        fromName: 'TheVideoPool',
        category: 'promotions',
        dynamicTemplateData: {
          promoCode: 'DJ20OFF',
          expiryDate: new Date(nextMonday.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          discountAmount: '20%'
        }
      }
    );
    
    console.log(`Promotional campaign scheduled for next Monday (${nextMonday.toLocaleDateString()})`);
    console.log(`- Scheduler ID: ${scheduledCampaignId}`);
    
    console.log('\n=== AUTOMATED EMAIL PROCESS COMPLETE ===');
    
  } catch (error) {
    console.error('Error running automated email process:', error);
  }
}

/**
 * Helper to get next Monday at 10am
 */
function getNextMonday(): Date {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? 1 : 8 - day; // If today is Sunday, next Monday is tomorrow
  
  // Set to next Monday
  date.setDate(date.getDate() + diff);
  
  // Set to 10am
  date.setHours(10, 0, 0, 0);
  
  return date;
}

// Run the process when script is executed directly
if (require.main === module) {
  runAutomatedEmailProcess()
    .then(() => {
      console.log('Script execution complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

export { runAutomatedEmailProcess };