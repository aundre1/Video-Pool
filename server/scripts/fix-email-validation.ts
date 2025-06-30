#!/usr/bin/env tsx

import dns from 'dns';
import { promisify } from 'util';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const resolveMx = promisify(dns.resolveMx);

/**
 * Basic regex for initial syntax check
 */
function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if domain has valid MX records
 */
async function isValidEmailDomain(domain: string): Promise<boolean> {
  try {
    const mxRecords = await resolveMx(domain);
    return mxRecords.length > 0;
  } catch (error) {
    console.log(`Domain validation failed for ${domain}`);
    return false;
  }
}

/**
 * Update user with email validation metadata
 */
async function updateUserEmailStatus(userId: number, isValid: boolean, reason?: string): Promise<void> {
  try {
    // Create metadata object with validation info
    const metadata = {
      emailValidation: {
        isValid,
        reason: reason || (isValid ? 'passed all checks' : 'unknown error'),
        checkedAt: new Date().toISOString()
      },
      // Add marketingPreferences object if we need it
      marketingPreferences: {
        optIn: true,
        lastUpdated: new Date().toISOString()
      }
    };

    // Update user with metadata as a JSON field
    await db.update(users)
      .set({ 
        // For fields that need to be untyped jsonb, we use sql template literals
        metadata: sql`${JSON.stringify(metadata)}`
      })
      .where(eq(users.id, userId));
    
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
  }
}

/**
 * Validate emails in batches
 */
async function validateEmailsBatch(
  userEmails: Array<{ id: number, email: string }>,
  checkDomains: boolean = true,
  batchSize: number = 50
): Promise<{
  valid: number;
  invalid: number;
  syntaxErrors: number;
  domainErrors: number;
}> {
  let valid = 0;
  let invalid = 0;
  let syntaxErrors = 0;
  let domainErrors = 0;

  // Process in batches
  for (let i = 0; i < userEmails.length; i += batchSize) {
    const batch = userEmails.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(userEmails.length/batchSize)} (${i+1}-${Math.min(i+batchSize, userEmails.length)} of ${userEmails.length})`);

    await Promise.all(batch.map(async ({ id, email }) => {
      // Skip if email is empty
      if (!email || email.trim() === '') {
        await updateUserEmailStatus(id, false, 'Empty email');
        invalid++;
        syntaxErrors++;
        return;
      }
      
      // Step 1: Syntax validation
      if (!isValidEmailSyntax(email)) {
        await updateUserEmailStatus(id, false, 'Invalid syntax');
        invalid++;
        syntaxErrors++;
        return;
      }

      // Step 2: Domain validation (optional)
      if (checkDomains) {
        const domain = email.split('@')[1];
        const hasMx = await isValidEmailDomain(domain);
        
        if (!hasMx) {
          await updateUserEmailStatus(id, false, 'Invalid domain');
          invalid++;
          domainErrors++;
          return;
        }
      }

      // Email passed all checks - mark as valid
      await updateUserEmailStatus(id, true);
      valid++;
    }));

    // Show progress after each batch
    console.log(`Progress: ${i + batch.length}/${userEmails.length} (${Math.round((i + batch.length) / userEmails.length * 100)}%)`);
    console.log(`Stats so far: ${valid} valid, ${invalid} invalid (${syntaxErrors} syntax, ${domainErrors} domain)`);
  }

  return { valid, invalid, syntaxErrors, domainErrors };
}

/**
 * Main function to clean the email database
 */
async function cleanEmailDatabase(options = { 
  checkDomains: true, 
  batchSize: 50 
}): Promise<{
  totalProcessed: number;
  valid: number;
  invalid: number;
  syntaxErrors: number;
  domainErrors: number;
}> {
  console.log('======================================');
  console.log('     EMAIL DATABASE CLEANING TOOL     ');
  console.log('======================================');
  console.log(`Domain validation: ${options.checkDomains ? 'Enabled' : 'Disabled'}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log('--------------------------------------');

  // Count all users with email addresses
  const userCount = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.email} IS NOT NULL AND ${users.email} != ''`);
  
  const totalUsers = userCount[0]?.count || 0;
  console.log(`Found ${totalUsers} users with email addresses in the database.`);

  if (totalUsers === 0) {
    console.log('No emails to validate. Exiting.');
    return { totalProcessed: 0, valid: 0, invalid: 0, syntaxErrors: 0, domainErrors: 0 };
  }

  // Fetch all user emails
  const userEmails = await db.select({
    id: users.id,
    email: users.email
  })
  .from(users)
  .where(sql`${users.email} IS NOT NULL AND ${users.email} != ''`);

  console.log(`Retrieved ${userEmails.length} email addresses for validation.`);

  // Start time
  const startTime = Date.now();

  // Validate emails
  const results = await validateEmailsBatch(
    userEmails, 
    options.checkDomains, 
    options.batchSize
  );

  // Show results
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log('\n======================================');
  console.log('          VALIDATION COMPLETE         ');
  console.log('======================================');
  console.log(`Total emails processed: ${userEmails.length}`);
  console.log(`Valid emails: ${results.valid} (${Math.round(results.valid / userEmails.length * 100)}%)`);
  console.log(`Invalid emails: ${results.invalid} (${Math.round(results.invalid / userEmails.length * 100)}%)`);
  console.log(`- Syntax errors: ${results.syntaxErrors}`);
  console.log(`- Domain errors: ${results.domainErrors}`);
  console.log(`\nTime taken: ${duration.toFixed(2)} seconds`);
  console.log('======================================');

  return {
    totalProcessed: userEmails.length,
    ...results
  };
}

// Run the database cleaning directly
cleanEmailDatabase({ checkDomains: true, batchSize: 50 })
  .then(results => {
    console.log('Email cleaning process completed successfully.');
    console.log('Summary:', results);
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during email cleaning process:', error);
    process.exit(1);
  });