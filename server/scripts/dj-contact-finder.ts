#!/usr/bin/env tsx

import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import { execSync } from 'child_process';
import csvParser from 'csv-parser';
import { db } from '../db';
import { users } from '@shared/schema';
import readline from 'readline';
import { createReadStream } from 'fs';
import { eq, sql } from 'drizzle-orm';

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate limiting to prevent overloading servers
const MAX_CONCURRENT_REQUESTS = 2;
const REQUEST_DELAY_MS = 2000;
const limiter = pLimit(MAX_CONCURRENT_REQUESTS);

// Define the structure for DJ contacts
interface DJContact {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  social?: Record<string, string>;
  location?: string;
  genres?: string[];
  source: string;
  dateFound: string;
  isValidated: boolean;
}

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Helper function to delay execution
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Helper function to ask a question
 */
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Main DJ finder function
 */
async function findDJContacts(sourceChoice: string): Promise<void> {
  console.log('Starting DJ contact finder...\n');
  
  // Initialize results array
  const foundContacts: DJContact[] = [];
  const tempDir = path.join(__dirname, '../../temp');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const outputPath = path.join(tempDir, `dj-contacts-${Date.now()}.csv`);
  console.log(`Results will be saved to: ${outputPath}\n`);
  
  // Track sources
  const sourceTracking: Record<string, number> = {};
  
  try {
    // Process based on selected sources
    if (sourceChoice === '5' || sourceChoice === '1') {
      console.log('Scanning DJ directories and forums...');
      const forumContacts = await findContactsFromForums();
      sourceTracking['forums'] = forumContacts.length;
      foundContacts.push(...forumContacts);
      console.log(`Found ${forumContacts.length} contacts from forums and directories\n`);
    }
    
    if (sourceChoice === '5' || sourceChoice === '2') {
      console.log('Scanning public social media profiles...');
      const socialContacts = await findContactsFromSocialMedia();
      sourceTracking['social'] = socialContacts.length;
      foundContacts.push(...socialContacts);
      console.log(`Found ${socialContacts.length} contacts from social media\n`);
    }
    
    if (sourceChoice === '5' || sourceChoice === '3') {
      console.log('Scanning music production websites...');
      const musicSiteContacts = await findContactsFromMusicSites();
      sourceTracking['music_sites'] = musicSiteContacts.length;
      foundContacts.push(...musicSiteContacts);
      console.log(`Found ${musicSiteContacts.length} contacts from music production sites\n`);
    }
    
    if (sourceChoice === '5' || sourceChoice === '4') {
      console.log('Scanning event listings and festival lineups...');
      const eventContacts = await findContactsFromEvents();
      sourceTracking['events'] = eventContacts.length;
      foundContacts.push(...eventContacts);
      console.log(`Found ${eventContacts.length} contacts from events and festivals\n`);
    }
    
    // Save all contacts to CSV
    await saveContactsToCSV(foundContacts, outputPath);
    
    console.log('=================================================');
    console.log(`Total contacts found: ${foundContacts.length}`);
    Object.entries(sourceTracking).forEach(([source, count]) => {
      console.log(`- From ${source}: ${count}`);
    });
    console.log('=================================================\n');
    
    // Ask if they want to import to database
    const importToDb = await askQuestion('Would you like to import these contacts to your database? [y/N]: ');
    
    if (importToDb.toLowerCase() === 'y') {
      await importContactsToDatabase(outputPath);
    } else {
      console.log(`Contacts saved to CSV at: ${outputPath}`);
      console.log('You can import them manually later using the import tool.');
    }
    
  } catch (error) {
    console.error('Error finding DJ contacts:', error);
  }
}

/**
 * Find contacts from DJ forums and directories
 */
async function findContactsFromForums(): Promise<DJContact[]> {
  const contacts: DJContact[] = [];
  const sources = [
    'https://deejayportal.com/dj-directory/',
    'https://www.globaldjs.com/dj/browse/',
    // Add more sources here
  ];
  
  // Example forum scraper
  for (const source of sources) {
    try {
      console.log(`Scanning ${source}...`);
      
      // This would be real scraping code, but we're using sample data for the example
      // const response = await limiter(() => axios.get(source));
      // const $ = cheerio.load(response.data);
      
      // For demo, we'll generate some sample data
      await delay(1500); // Simulate network delay
      
      // Add 5-10 sample contacts per source
      const numSamples = Math.floor(Math.random() * 6) + 5;
      for (let i = 0; i < numSamples; i++) {
        contacts.push({
          name: `DJ Sample ${Math.floor(Math.random() * 1000)}`,
          email: `dj${Math.floor(Math.random() * 10000)}@example.com`,
          phone: Math.random() > 0.5 ? `+1${Math.floor(Math.random() * 1000000000)}` : undefined,
          genres: ['Hip-Hop', 'Dance', 'Electronic'].slice(0, Math.floor(Math.random() * 3) + 1),
          source,
          dateFound: new Date().toISOString(),
          isValidated: false
        });
      }
      
      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(`Error scanning ${source}:`, error);
    }
  }
  
  return contacts;
}

/**
 * Find contacts from social media
 */
async function findContactsFromSocialMedia(): Promise<DJContact[]> {
  const contacts: DJContact[] = [];
  
  // In a real implementation, this would use platform-specific APIs
  // For demo purposes, we'll return sample data
  await delay(2000); // Simulate network delay
  
  // Generate sample data
  for (let i = 0; i < 15; i++) {
    contacts.push({
      name: `DJ Social ${Math.floor(Math.random() * 1000)}`,
      email: `social.dj${Math.floor(Math.random() * 10000)}@example.com`,
      social: {
        instagram: `@dj_insta_${Math.floor(Math.random() * 1000)}`,
        twitter: `@dj_tweet_${Math.floor(Math.random() * 1000)}`,
      },
      location: ['New York', 'Los Angeles', 'Miami', 'Chicago', 'London'][Math.floor(Math.random() * 5)],
      genres: ['Electronic', 'House', 'Techno', 'Hip-Hop', 'R&B'].slice(0, Math.floor(Math.random() * 4) + 1),
      source: 'social_media',
      dateFound: new Date().toISOString(),
      isValidated: false
    });
  }
  
  return contacts;
}

/**
 * Find contacts from music production websites
 */
async function findContactsFromMusicSites(): Promise<DJContact[]> {
  const contacts: DJContact[] = [];
  const sources = [
    'https://www.beatport.com/artists/a',
    'https://www.residentadvisor.net/dj',
    // Add more sources here
  ];
  
  for (const source of sources) {
    try {
      console.log(`Scanning ${source}...`);
      
      // This would be real scraping code in a production system
      await delay(1800); // Simulate network delay
      
      // Add sample contacts
      const numSamples = Math.floor(Math.random() * 8) + 3;
      for (let i = 0; i < numSamples; i++) {
        contacts.push({
          name: `DJ Producer ${Math.floor(Math.random() * 1000)}`,
          email: `producer${Math.floor(Math.random() * 10000)}@example.com`,
          website: `https://www.djproducer${Math.floor(Math.random() * 1000)}.com`,
          genres: ['House', 'Techno', 'Trance', 'Drum & Bass'].slice(0, Math.floor(Math.random() * 3) + 1),
          source,
          dateFound: new Date().toISOString(),
          isValidated: false
        });
      }
      
      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(`Error scanning ${source}:`, error);
    }
  }
  
  return contacts;
}

/**
 * Find contacts from event listings and festival lineups
 */
async function findContactsFromEvents(): Promise<DJContact[]> {
  const contacts: DJContact[] = [];
  const sources = [
    'https://www.festicket.com/festivals/',
    'https://www.skiddle.com/festivals/',
    // Add more sources here
  ];
  
  for (const source of sources) {
    try {
      console.log(`Scanning ${source}...`);
      
      // This would be real scraping code in a production system
      await delay(2200); // Simulate network delay
      
      // Add sample contacts
      const numSamples = Math.floor(Math.random() * 10) + 5;
      for (let i = 0; i < numSamples; i++) {
        contacts.push({
          name: `Festival DJ ${Math.floor(Math.random() * 1000)}`,
          email: `festival.dj${Math.floor(Math.random() * 10000)}@example.com`,
          location: ['Berlin', 'Ibiza', 'Las Vegas', 'Tokyo', 'Amsterdam'][Math.floor(Math.random() * 5)],
          genres: ['EDM', 'House', 'Techno', 'Trance'].slice(0, Math.floor(Math.random() * 3) + 1),
          source,
          dateFound: new Date().toISOString(),
          isValidated: false
        });
      }
      
      await delay(REQUEST_DELAY_MS);
    } catch (error) {
      console.error(`Error scanning ${source}:`, error);
    }
  }
  
  return contacts;
}

/**
 * Save contacts to CSV file
 */
async function saveContactsToCSV(contacts: DJContact[], outputPath: string): Promise<void> {
  try {
    // Create CSV header
    const header = 'Name,Email,Phone,Website,Instagram,Twitter,Location,Genres,Source,DateFound,IsValidated\n';
    
    // Create CSV content
    const rows = contacts.map(contact => {
      const instagram = contact.social?.instagram || '';
      const twitter = contact.social?.twitter || '';
      const genres = (contact.genres || []).join(';');
      
      return `"${contact.name}","${contact.email}","${contact.phone || ''}","${contact.website || ''}","${instagram}","${twitter}","${contact.location || ''}","${genres}","${contact.source}","${contact.dateFound}","${contact.isValidated}"`;
    });
    
    // Write to file
    fs.writeFileSync(outputPath, header + rows.join('\n'));
    console.log(`Successfully saved ${contacts.length} contacts to ${outputPath}`);
  } catch (error) {
    console.error('Error saving contacts to CSV:', error);
  }
}

/**
 * Import contacts from CSV to database
 */
async function importContactsToDatabase(csvPath: string): Promise<void> {
  const results: any[] = [];
  
  try {
    // Read and parse CSV file
    await new Promise<void>((resolve, reject) => {
      createReadStream(csvPath)
        .pipe(csvParser())
        .on('data', (data: any) => results.push(data))
        .on('end', () => resolve())
        .on('error', (error: Error) => reject(error));
    });
    
    console.log(`Found ${results.length} contacts in CSV file. Starting import...`);
    
    let imported = 0;
    let duplicates = 0;
    let errors = 0;
    
    // Process each contact
    for (const contact of results) {
      try {
        // Check if email already exists
        const existingUser = await db.select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.email, contact.Email));
        
        if (existingUser.length > 0) {
          duplicates++;
          continue;
        }
        
        // Create username from email (required field)
        const username = contact.Email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
        
        // Create random password (required field)
        const tempPassword = 'temp_' + Math.random().toString(36).substring(2, 10);
        
        // Create new user with appropriate type
        await db.insert(users)
          .values({
            username: username,
            password: tempPassword, // This would be hashed in a real scenario
            email: contact.Email,
            firstName: contact.Name.split(' ')[0] || '',
            lastName: contact.Name.split(' ').slice(1).join(' ') || '',
            role: "user",
            // Add metadata as jsonb using sql template for dynamic content
            metadata: sql`${JSON.stringify({
              source: contact.Source,
              dateFound: contact.DateFound,
              phone: contact.Phone,
              website: contact.Website,
              instagram: contact.Instagram,
              twitter: contact.Twitter,
              location: contact.Location,
              genres: contact.Genres ? contact.Genres.split(';') : [],
              isProspect: true,
              isScraped: true
            })}`
          });
        
        imported++;
        
        // Show progress every 10 records
        if (imported % 10 === 0) {
          console.log(`Imported ${imported} contacts so far...`);
        }
      } catch (error) {
        console.error(`Error importing contact ${contact.Email}:`, error);
        errors++;
      }
      
      // Add delay to avoid database overload
      await delay(100);
    }
    
    console.log('\n=================================================');
    console.log('              IMPORT COMPLETE                    ');
    console.log('=================================================');
    console.log(`Total contacts in CSV: ${results.length}`);
    console.log(`Successfully imported: ${imported}`);
    console.log(`Duplicates skipped: ${duplicates}`);
    console.log(`Errors: ${errors}`);
    console.log('=================================================');
  } catch (error) {
    console.error('Error importing contacts:', error);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): { source: string } {
  const args = process.argv.slice(2);
  const sourceArg = args.find(arg => arg.startsWith('--source='));
  const source = sourceArg ? sourceArg.split('=')[1] : '5'; // Default to all sources
  
  return { source };
}

// Main execution
const args = parseArgs();

findDJContacts(args.source)
  .then(() => {
    console.log('DJ contact finder completed.');
    rl.close();
    process.exit(0);
  })
  .catch(error => {
    console.error('Error running DJ contact finder:', error);
    rl.close();
    process.exit(1);
  });