#!/usr/bin/env tsx

import { emailABTestingService } from '../services/emailABTestingService';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to prompt for user input
function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper to prompt for yes/no
async function confirmPrompt(question: string): Promise<boolean> {
  const answer = await prompt(`${question} [y/N] `);
  return answer.toLowerCase() === 'y';
}

/**
 * Run interactive A/B test campaign creation
 */
async function createABTestCampaign(): Promise<void> {
  console.log('======================================');
  console.log('       CREATE A/B TEST CAMPAIGN       ');
  console.log('======================================');
  
  // Campaign basics
  const campaignName = await prompt('Enter campaign name: ');
  const campaignId = `campaign-${uuidv4().substring(0, 8)}`;
  
  console.log('\n--- DEFINE VARIANTS ---');
  console.log('You will need to define at least 2 different variants to test');
  
  // Create variants
  const variants = [];
  let variantCount = 0;
  
  while (true) {
    variantCount++;
    console.log(`\n-- Variant ${variantCount} --`);
    
    const variantName = await prompt(`Enter name for variant ${variantCount}: `);
    const variantSubject = await prompt('Enter email subject line: ');
    const variantTemplateId = await prompt('Enter SendGrid template ID: ');
    const variantPreviewText = await prompt('Enter preview text (optional): ');
    
    variants.push({
      id: `variant-${uuidv4().substring(0, 8)}`,
      name: variantName,
      subject: variantSubject,
      templateId: variantTemplateId,
      previewText: variantPreviewText || undefined
    });
    
    // Check if we have at least 2 variants and if user wants to add more
    if (variants.length >= 2) {
      const addMore = await confirmPrompt('Add another variant?');
      if (!addMore) break;
    }
  }
  
  console.log('\n--- TEST PARAMETERS ---');
  
  // Choose winning criteria
  console.log('\nSelect winning criteria:');
  console.log('1. Open Rate');
  console.log('2. Click Rate');
  console.log('3. Conversion Rate');
  
  let criteriaChoice = await prompt('Enter choice (1-3): ');
  let winningCriteria: 'opens' | 'clicks' | 'conversions' = 'opens';
  
  switch (criteriaChoice) {
    case '1': winningCriteria = 'opens'; break;
    case '2': winningCriteria = 'clicks'; break;
    case '3': winningCriteria = 'conversions'; break;
    default: winningCriteria = 'opens';
  }
  
  // Test audience size
  let audiencePercentage = 10; // Default 10%
  const audienceInput = await prompt('Enter percentage of audience to test (1-100) [default: 10]: ');
  if (audienceInput && !isNaN(parseInt(audienceInput))) {
    audiencePercentage = Math.min(100, Math.max(1, parseInt(audienceInput)));
  }
  
  // Test duration
  let testDuration = 24; // Default 24 hours
  const durationInput = await prompt('Enter test duration in hours [default: 24]: ');
  if (durationInput && !isNaN(parseInt(durationInput))) {
    testDuration = Math.max(1, parseInt(durationInput));
  }
  
  console.log('\n--- AUDIENCE SEGMENTATION ---');
  console.log('Now we\'ll define who receives this campaign');
  
  // Build segmentation
  const segment: any = {};
  
  // Membership type segmentation
  const includeAllMembers = await confirmPrompt('Include all membership types?');
  if (!includeAllMembers) {
    console.log('\nSelect membership types to include:');
    console.log('1. Monthly');
    console.log('2. Quarterly');
    console.log('3. Annual');
    console.log('Enter numbers separated by commas (e.g., 1,3)');
    
    const membershipInput = await prompt('Membership types: ');
    if (membershipInput) {
      const membershipIds = membershipInput.split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id) && id >= 1 && id <= 3);
      
      if (membershipIds.length > 0) {
        segment.membershipTypes = membershipIds;
      }
    }
  }
  
  // Activity segmentation
  const segmentByActivity = await confirmPrompt('Segment by user activity?');
  if (segmentByActivity) {
    const activityDays = await prompt('Include users active within how many days? (leave empty to skip): ');
    if (activityDays && !isNaN(parseInt(activityDays))) {
      segment.activeInLastDays = parseInt(activityDays);
    }
    
    const inactiveDays = await prompt('Include users inactive for how many days? (leave empty to skip): ');
    if (inactiveDays && !isNaN(parseInt(inactiveDays))) {
      segment.inactiveForDays = parseInt(inactiveDays);
    }
  }
  
  // Genre preference segmentation
  const segmentByGenre = await confirmPrompt('Segment by genre preferences?');
  if (segmentByGenre) {
    console.log('\nEnter genre preferences (comma separated):');
    console.log('e.g., Hip-Hop,Dance,Pop');
    
    const genreInput = await prompt('Genres: ');
    if (genreInput) {
      const genres = genreInput.split(',').map(g => g.trim()).filter(g => g);
      if (genres.length > 0) {
        segment.downloadedGenres = genres;
      }
    }
  }
  
  // Engagement segmentation
  const segmentByEngagement = await confirmPrompt('Segment by previous email engagement?');
  if (segmentByEngagement) {
    const openedWithinDays = await prompt('Include users who opened emails within how many days? (leave empty to skip): ');
    if (openedWithinDays && !isNaN(parseInt(openedWithinDays))) {
      segment.openedEmailsLastDays = parseInt(openedWithinDays);
    }
  }
  
  console.log('\n--- REVIEW & CONFIRM ---');
  console.log(`Campaign Name: ${campaignName}`);
  console.log(`Campaign ID: ${campaignId}`);
  console.log(`Variants: ${variants.length}`);
  variants.forEach((v, i) => {
    console.log(`  ${i+1}. ${v.name} - Subject: ${v.subject}`);
  });
  console.log(`Winning Criteria: ${winningCriteria}`);
  console.log(`Test Audience: ${audiencePercentage}%`);
  console.log(`Test Duration: ${testDuration} hours`);
  console.log('Segmentation:');
  console.log(JSON.stringify(segment, null, 2));
  
  const confirmStart = await confirmPrompt('\nStart this A/B test campaign?');
  if (!confirmStart) {
    console.log('Campaign cancelled.');
    rl.close();
    return;
  }
  
  // Create and start the campaign
  try {
    const result = await emailABTestingService.createABTest({
      id: campaignId,
      name: campaignName,
      variants,
      winningCriteria,
      audiencePercentage,
      testDuration,
      segment
    });
    
    console.log('\n======================================');
    console.log('       CAMPAIGN STARTED SUCCESSFULLY     ');
    console.log('======================================');
    console.log(`Campaign ID: ${result}`);
    console.log(`Test will complete in approximately ${testDuration} hours`);
    console.log('\nAfter the test completes, the winning variant will be selected');
    console.log('and can be used for the remainder of your audience.');
  } catch (error) {
    console.error('Error starting campaign:', error);
  }
  
  rl.close();
}

// Create A/B test with pre-defined options for DJ Essentials Mix Visuals promotion
async function createQuickABTest(): Promise<void> {
  try {
    console.log('Creating predefined A/B test for DJ Essentials Mix Visuals promotion...');
    
    const campaignId = `campaign-${uuidv4().substring(0, 8)}`;
    const result = await emailABTestingService.createABTest({
      id: campaignId,
      name: 'DJ Essentials Mix Visuals Promotion',
      variants: [
        {
          id: `variant-a-${uuidv4().substring(0, 8)}`,
          name: 'Price Focused',
          subject: '🎵 40% OFF: Premium DJ Visuals This Weekend Only',
          templateId: 'd-abcdef123456', // Replace with actual template ID
          previewText: 'Limited time discount on DJ visuals - Save 40% now!'
        },
        {
          id: `variant-b-${uuidv4().substring(0, 8)}`,
          name: 'Quality Focused',
          subject: '🎬 Elevate Your Sets with Premium DJ Visuals',
          templateId: 'd-xyz987654321', // Replace with actual template ID
          previewText: 'Pro-quality visuals to transform your DJ sets'
        }
      ],
      winningCriteria: 'clicks',
      audiencePercentage: 20,
      testDuration: 24,
      segment: {
        // Target active members
        membershipTypes: [1, 2, 3], // All membership tiers
        activeInLastDays: 30, // Active in last month
        // Target users interested in specific genres
        downloadedGenres: ['Hip-Hop', 'Dance', 'Electronic']
      }
    });
    
    console.log('Predefined A/B test created successfully!');
    console.log(`Campaign ID: ${result}`);
    
  } catch (error) {
    console.error('Error creating predefined A/B test:', error);
  }
}

// Main function
async function main(): Promise<void> {
  console.log('======================================');
  console.log('       A/B TEST CAMPAIGN TOOL         ');
  console.log('======================================');
  console.log('1. Create custom A/B test campaign');
  console.log('2. Run predefined A/B test (DJ Essentials Mix Visuals promo)');
  console.log('3. Exit');
  
  const choice = await prompt('\nSelect an option (1-3): ');
  
  switch (choice) {
    case '1':
      await createABTestCampaign();
      break;
    case '2':
      await createQuickABTest();
      rl.close();
      break;
    case '3':
    default:
      console.log('Exiting.');
      rl.close();
      break;
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});