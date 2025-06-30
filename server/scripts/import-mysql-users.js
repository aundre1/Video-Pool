// MySQL to PostgreSQL User Import Script
// This script extracts user data from the provided MySQL dump file
// and imports it into the PostgreSQL database for email marketing

const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { emailSubscribers } = require('../../shared/schema');

// Function to parse the MySQL dump file content
function parseUserDataFromDump(dumpFilePaths) {
  const users = new Set();
  let combinedContent = '';
  
  // Combine all dump file parts
  dumpFilePaths.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      combinedContent += content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  });
  
  // Extract email patterns 
  // Look for emails in different patterns from the MySQL dump
  
  // Pattern 1: User registrations with email fields
  const emailRegex = /['"]?email['"]?\s*=>\s*['"]([^'"]+@[^'"]+)['"],?/g;
  let match;
  while ((match = emailRegex.exec(combinedContent)) !== null) {
    if (match[1] && match[1].includes('@') && !match[1].includes('example.com')) {
      users.add(match[1].toLowerCase().trim());
    }
  }
  
  // Pattern 2: Direct email formats in MySQL entries
  const directEmailRegex = /['"]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})['"],?/g;
  while ((match = directEmailRegex.exec(combinedContent)) !== null) {
    if (match[1] && match[1].includes('@') && !match[1].includes('example.com')) {
      users.add(match[1].toLowerCase().trim());
    }
  }
  
  // Pattern 3: Look for buyer_email fields (from the specific affiliates table)
  const buyerEmailRegex = /buyer_email['"]?\s*=>\s*['"]([^'"]+@[^'"]+)['"],?/g;
  while ((match = buyerEmailRegex.exec(combinedContent)) !== null) {
    if (match[1] && match[1].includes('@') && !match[1].includes('example.com')) {
      users.add(match[1].toLowerCase().trim());
    }
  }
  
  return Array.from(users).map(email => ({
    email,
    isSubscribed: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
}

// Main function to import users
async function importUsers() {
  try {
    console.log('Starting user import from MySQL dump...');
    
    // Paths to MySQL dump files
    const dumpFilePaths = [
      path.join(__dirname, '../../attached_assets/db_part_aa'),
      path.join(__dirname, '../../attached_assets/db_part_ab'),
      path.join(__dirname, '../../attached_assets/db_part_ac')
    ];
    
    // Parse user data from dump files
    const userData = parseUserDataFromDump(dumpFilePaths);
    console.log(`Found ${userData.length} unique email addresses in the dump file.`);
    
    // Check if users already exist to avoid duplicates
    let importCount = 0;
    let skipCount = 0;
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 50;
    const totalBatches = Math.ceil(userData.length / batchSize);
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, userData.length);
      const batch = userData.slice(start, end);
      
      // For each email in the batch
      for (const user of batch) {
        try {
          // Check if user already exists
          const [existingUser] = await db
            .select()
            .from(emailSubscribers)
            .where(email => email.email.equals(user.email))
            .limit(1);
          
          if (!existingUser) {
            // Insert new subscriber
            await db.insert(emailSubscribers).values(user);
            importCount++;
          } else {
            skipCount++;
          }
        } catch (error) {
          console.error(`Error processing email ${user.email}:`, error);
        }
      }
      
      console.log(`Processed batch ${i + 1}/${totalBatches}`);
    }
    
    console.log('Import completed!');
    console.log(`${importCount} users imported, ${skipCount} skipped (already exist).`);
    
  } catch (error) {
    console.error('Error importing users:', error);
  } finally {
    process.exit(0);
  }
}

importUsers();