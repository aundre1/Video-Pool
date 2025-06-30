#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from 'csv-parser';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import dns from 'dns';
import { promisify } from 'util';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Promisify DNS functions
const resolveMx = promisify(dns.resolveMx);

// File path of the CSV with DJ contacts
const CSV_FILE_PATH = path.join(__dirname, '../../temp/dj-contacts-1747916683044.csv');

// Basic regex for email syntax validation
function isValidEmailSyntax(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if domain has valid MX records
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
 * Main function to import DJ contacts
 */
async function importDJContacts(): Promise<void> {
  console.log('======================================');
  console.log('     IMPORTING DJ CONTACTS TO DB      ');
  console.log('======================================');
  
  // Check if file exists
  if (!fs.existsSync(CSV_FILE_PATH)) {
    console.error(`CSV file not found at ${CSV_FILE_PATH}`);
    return;
  }
  
  // Parse CSV file
  const contacts: any[] = [];
  
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(CSV_FILE_PATH)
      .pipe(csvParser())
      .on('data', (data) => contacts.push(data))
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
  
  console.log(`Found ${contacts.length} contacts in CSV file`);
  
  // Import statistics
  let imported = 0;
  let duplicates = 0;
  let invalidEmails = 0;
  
  for (const contact of contacts) {
    try {
      // Clean up and validate email
      const email = contact.Email ? contact.Email.trim().toLowerCase() : '';
      
      // Skip if no email or invalid syntax
      if (!email || !isValidEmailSyntax(email)) {
        console.log(`Skipping contact with invalid email syntax: ${email}`);
        invalidEmails++;
        continue;
      }
      
      // Validate domain
      const domain = email.split('@')[1];
      const hasMxRecords = await isValidEmailDomain(domain);
      
      if (!hasMxRecords) {
        console.log(`Skipping contact with invalid domain: ${email}`);
        invalidEmails++;
        continue;
      }
      
      // Check if already exists in database
      const existingUser = await db.select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.email, email));
      
      if (existingUser.length > 0) {
        console.log(`Skipping duplicate email: ${email}`);
        duplicates++;
        continue;
      }
      
      // Parse name into first and last name
      const fullName = contact.Name || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Create username from email (required field)
      const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
      
      // Create random password (required field)
      const tempPassword = 'temp_' + Math.random().toString(36).substring(2, 10);
      
      // Extract additional fields
      const source = contact.Source || 'dj_contacts_import';
      const phone = contact.Phone || '';
      const website = contact.Website || '';
      const instagram = contact.Instagram || '';
      const twitter = contact.Twitter || '';
      const location = contact.Location || '';
      const genres = contact.Genres ? contact.Genres.split(';') : [];
      
      // Create metadata object
      const metadata = {
        source,
        dateImported: new Date().toISOString(),
        dateFound: contact.DateFound || new Date().toISOString(),
        phone,
        website,
        instagram,
        twitter,
        location,
        genres,
        isProspect: true,
        isScraped: true,
        emailValidation: {
          isValid: true,
          checkedAt: new Date().toISOString()
        }
      };
      
      // Insert user into database with only the fields that actually exist in the database
      try {
        await db.insert(users).values({
          username,
          password: tempPassword, // In production, this would be hashed
          email,
          role: "user",
          downloads_used: 0 // Use the actual column name from the database
        });
      } catch (error) {
        console.error(`Error details:`, error);
        throw error;
      }
      
      imported++;
      console.log(`Imported DJ contact: ${email}`);
      
    } catch (error) {
      console.error(`Error importing contact:`, error);
    }
  }
  
  // Print summary
  console.log('\n======================================');
  console.log('         IMPORT SUMMARY               ');
  console.log('======================================');
  console.log(`Total contacts processed: ${contacts.length}`);
  console.log(`Successfully imported: ${imported}`);
  console.log(`Duplicates skipped: ${duplicates}`);
  console.log(`Invalid emails skipped: ${invalidEmails}`);
  console.log('======================================');
}

// Run the import function
importDJContacts()
  .then(() => {
    console.log('DJ contact import completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during import process:', error);
    process.exit(1);
  });