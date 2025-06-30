import dns from 'dns';
import net from 'net';
import { promisify } from 'util';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const resolveMx = promisify(dns.resolveMx);

// Basic regex for initial syntax check
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
    console.log(`Domain validation failed for ${domain}: ${error}`);
    return false;
  }
}

// Advanced SMTP validation - This does a partial connection to check if the mailbox exists
// Note: Some mail servers block these kinds of checks, so results may not be 100% accurate
async function verifyEmailViaSMTP(email: string, domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseBuffer = '';
    const commands = [
      `HELO thevideopool.com\r\n`,
      `MAIL FROM: <info@thevideopool.com>\r\n`,
      `RCPT TO: <${email}>\r\n`,
      `QUIT\r\n`
    ];
    let cmdIndex = 0;
    
    // Set a timeout in case the connection hangs
    const timeout = setTimeout(() => {
      console.log(`SMTP verification timed out for ${email}`);
      socket.destroy();
      resolve(false);
    }, 10000);
    
    socket.connect(25, domain);
    
    socket.on('data', (data) => {
      responseBuffer += data.toString();
      // If we received a full response
      if (responseBuffer.includes('\r\n')) {
        if (cmdIndex < commands.length) {
          socket.write(commands[cmdIndex]);
          cmdIndex++;
        }
        
        // Check for user existence response (250 = OK, 550 = Mailbox unavailable)
        if (cmdIndex === 3 && responseBuffer.includes('250')) {
          clearTimeout(timeout);
          socket.destroy();
          resolve(true);
        } else if (responseBuffer.includes('550')) {
          clearTimeout(timeout);
          socket.destroy();
          resolve(false);
        }
        
        responseBuffer = '';
      }
    });
    
    socket.on('error', (error) => {
      console.log(`SMTP connection failed for ${email}: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
    
    socket.on('close', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// Main function to validate all emails
export async function validateAllEmails(batchSize = 100, smtpCheck = false): Promise<{
  totalChecked: number;
  valid: number;
  invalid: number;
  invalidEmails: string[];
}> {
  // Get all users with emails
  const usersWithEmails = await db.select().from(users).where(eq(users.email, ''));
  
  let validCount = 0;
  let invalidCount = 0;
  let totalChecked = 0;
  const invalidEmails: string[] = [];
  
  console.log(`Starting validation of ${usersWithEmails.length} email addresses`);
  
  // Process in batches to avoid overwhelming connections
  for (let i = 0; i < usersWithEmails.length; i += batchSize) {
    const batch = usersWithEmails.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(usersWithEmails.length/batchSize)}`);
    
    await Promise.all(batch.map(async (user) => {
      if (!user.email) return;
      
      totalChecked++;
      const email = user.email;
      
      // Step 1: Syntax check
      if (!isValidEmailSyntax(email)) {
        invalidCount++;
        invalidEmails.push(email);
        
        // Mark as invalid in database
        await markEmailAsInvalid(user.id);
        return;
      }
      
      // Step 2: Domain check
      const domain = email.split('@')[1];
      const hasMx = await isValidEmailDomain(domain);
      
      if (!hasMx) {
        invalidCount++;
        invalidEmails.push(email);
        
        // Mark as invalid in database
        await markEmailAsInvalid(user.id);
        return;
      }
      
      // Step 3: SMTP verification (optional, more intrusive)
      if (smtpCheck) {
        const isValidSMTP = await verifyEmailViaSMTP(email, domain);
        
        if (!isValidSMTP) {
          invalidCount++;
          invalidEmails.push(email);
          
          // Mark as invalid in database
          await markEmailAsInvalid(user.id);
          return;
        }
      }
      
      validCount++;
    }));
    
    // Small delay between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return {
    totalChecked,
    valid: validCount,
    invalid: invalidCount,
    invalidEmails
  };
}

async function markEmailAsInvalid(userId: string | number): Promise<void> {
  try {
    // Add a metadata field to track invalid emails instead of using a separate column
    await db.update(users)
      .set({ 
        metadata: {
          emailValid: false,
          validationDate: new Date().toISOString()
        }
      })
      .where(eq(users.id, userId.toString()));
  } catch (error) {
    console.error(`Error marking email as invalid for user ${userId}:`, error);
  }
}

// Run the validator if executed directly
if (require.main === module) {
  validateAllEmails()
    .then(results => {
      console.log('Email validation complete:');
      console.log(`Total checked: ${results.totalChecked}`);
      console.log(`Valid emails: ${results.valid}`);
      console.log(`Invalid emails: ${results.invalid}`);
      console.log('First 10 invalid emails:');
      console.log(results.invalidEmails.slice(0, 10));
    })
    .catch(error => {
      console.error('Error validating emails:', error);
    });
}