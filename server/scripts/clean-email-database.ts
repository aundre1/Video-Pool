#!/usr/bin/env tsx

import { db } from '../db';
import { users } from '@shared/schema';
import dns from 'dns';
import { promisify } from 'util';
import { eq, sql } from 'drizzle-orm';
import readline from 'readline';

const resolveMx = promisify(dns.resolveMx);

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
 * Mark an email as invalid in the database
 */
async function markEmailAsInvalid(userId: string, reason: string): Promise<void> {
  try {
    await db.update(users)
      .set({
        // Use a JSON metadata field to store validation info
        metadata: sql`json_set(
          COALESCE(${users.metadata}, '{}'), 
          '$.emailValid', 'false',
          '$.emailValidationReason', ${reason},
          '$.emailValidationDate', ${new Date().toISOString()}
        )`
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error(`Error marking email as invalid for user ${userId}:`, error);
  }
}

/**
 * Validate emails in batches
 */
async function validateEmailsBatch(
  userEmails: Array<{ id: string, email: string }>,
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

  // Process in smaller batches to show progress
  for (let i = 0; i < userEmails.length; i += batchSize) {
    const batch = userEmails.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(userEmails.length/batchSize)} (${i+1}-${Math.min(i+batchSize, userEmails.length)} of ${userEmails.length})`);

    await Promise.all(batch.map(async ({ id, email }) => {
      // Step 1: Syntax validation
      if (!isValidEmailSyntax(email)) {
        await markEmailAsInvalid(id, 'Invalid syntax');
        invalid++;
        syntaxErrors++;
        return;
      }

      // Step 2: Domain validation (optional)
      if (checkDomains) {
        const domain = email.split('@')[1];
        const hasMx = await isValidEmailDomain(domain);
        
        if (!hasMx) {
          await markEmailAsInvalid(id, 'Invalid domain');
          invalid++;
          domainErrors++;
          return;
        }
      }

      // Email passed all checks
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
async function cleanEmailDatabase(): Promise<void> {
  console.log('======================================');
  console.log('     EMAIL DATABASE CLEANING TOOL     ');
  console.log('======================================');
  console.log('This tool will validate all emails in your database');
  console.log('and mark invalid ones for future reference.\n');

  // Count all users with email addresses
  const userCount = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.email} IS NOT NULL AND ${users.email} != ''`);
  
  const totalUsers = userCount[0]?.count || 0;
  console.log(`Found ${totalUsers} users with email addresses in the database.`);

  // Ask user for confirmation
  const shouldProceed = await new Promise<boolean>(resolve => {
    rl.question(`Do you want to proceed with validation? [y/N] `, answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });

  if (!shouldProceed) {
    console.log('Operation cancelled by user.');
    rl.close();
    return;
  }

  // Ask about domain validation
  const shouldCheckDomains = await new Promise<boolean>(resolve => {
    rl.question(`Perform domain MX record validation? (slower but more thorough) [y/N] `, answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });

  // Get batch size
  let batchSize = 50;
  const batchSizeInput = await new Promise<string>(resolve => {
    rl.question(`Enter batch size for processing [default: 50]: `, answer => {
      resolve(answer);
    });
  });
  
  if (batchSizeInput && !isNaN(parseInt(batchSizeInput))) {
    batchSize = parseInt(batchSizeInput);
  }

  console.log(`\nStarting email validation with batch size ${batchSize}...`);
  console.log(`Domain validation: ${shouldCheckDomains ? 'Enabled' : 'Disabled'}`);
  console.log('--------------------------------------');

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
  const results = await validateEmailsBatch(userEmails, shouldCheckDomains, batchSize);

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

  rl.close();
}

// Run the database cleaning tool
cleanEmailDatabase()
  .then(() => {
    console.log('Email cleaning process completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during email cleaning process:', error);
    process.exit(1);
  });