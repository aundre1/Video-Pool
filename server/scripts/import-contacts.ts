#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csvParser from 'csv-parser';
import { pool } from '../db';
import dns from 'dns';
import { promisify } from 'util';
import bcrypt from 'bcrypt';

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
  
  const client = await pool.connect();
  
  try {
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
        const checkResult = await client.query(
          'SELECT id, email FROM users WHERE email = $1',
          [email]
        );
        
        if (checkResult.rows.length > 0) {
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
        
        // Hash the password for security
        const password = await bcrypt.hash('temp_' + Math.random().toString(36).substring(2, 10), 10);
        
        // Insert directly with SQL to avoid schema validation issues
        await client.query(
          'INSERT INTO users (username, password, email, role, downloads_used) VALUES ($1, $2, $3, $4, $5)',
          [username, password, email, 'user', 0]
        );
        
        imported++;
        console.log(`Imported DJ contact: ${email}`);
        
      } catch (error) {
        console.error(`Error importing contact:`, error);
      }
    }
  } finally {
    client.release();
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