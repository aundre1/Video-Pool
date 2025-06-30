#!/usr/bin/env tsx

import { exec } from 'child_process';
import path from 'path';
import readline from 'readline';

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Run a command and return the output
 */
function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

/**
 * Main function that orchestrates the process
 */
async function main() {
  console.log('=================================================');
  console.log('    DATABASE VALIDATION AND ENHANCEMENT TOOL     ');
  console.log('=================================================');
  console.log('This tool will:');
  console.log('1. First clean your existing email database');
  console.log('2. Then run a scraper to find new DJ contacts');
  console.log('=================================================\n');

  // Step 1: Ask if they want to clean the database first
  const runValidation = await askQuestion('Do you want to clean your existing email database first? [Y/n]: ');
  
  if (runValidation.toLowerCase() !== 'n') {
    console.log('\nStarting email validation process...\n');
    
    try {
      // Run the email validation script
      const validationScript = path.join(__dirname, 'clean-email-database.ts');
      await runCommand(`tsx ${validationScript}`);
      
      console.log('\nEmail validation process completed successfully!');
    } catch (error) {
      console.error('Error running email validation:', error);
      const continueAnyway = await askQuestion('Email validation encountered an error. Continue to the next step? [y/N]: ');
      if (continueAnyway.toLowerCase() !== 'y') {
        console.log('Exiting process.');
        process.exit(1);
      }
    }
  }
  
  // Step 2: Run the DJ contact finder
  console.log('\n=================================================');
  console.log('             DJ CONTACT FINDER                   ');
  console.log('=================================================');
  
  const runScraper = await askQuestion('Do you want to run the DJ contact finder to expand your database? [Y/n]: ');
  
  if (runScraper.toLowerCase() !== 'n') {
    console.log('\nPreparing to run DJ contact finder...\n');
    
    // Ask for data sources to scrape
    console.log('Select data sources to include:');
    console.log('1. DJ directories and forums');
    console.log('2. Social media profiles (public data only)');
    console.log('3. Music production websites');
    console.log('4. Event listings and festival lineups');
    console.log('5. All of the above');
    
    const sourceChoice = await askQuestion('Enter your choice (1-5): ');
    
    // Confirm before proceeding
    console.log('\nThe contact finder will search for public DJ information,');
    console.log('respecting websites\' terms of service and implementing rate limiting.');
    console.log('The process may take several hours depending on the number of sources.');
    
    const confirm = await askQuestion('Do you want to proceed? [y/N]: ');
    
    if (confirm.toLowerCase() === 'y') {
      console.log('\nStarting DJ contact finder...');
      
      try {
        // Run the DJ contact finder script
        const finderScript = path.join(__dirname, 'dj-contact-finder.ts');
        await runCommand(`tsx ${finderScript} --source=${sourceChoice}`);
        
        console.log('\nDJ contact finder completed successfully!');
      } catch (error) {
        console.error('Error running DJ contact finder:', error);
      }
    } else {
      console.log('DJ contact finder cancelled.');
    }
  }
  
  console.log('\n=================================================');
  console.log('                PROCESS COMPLETE                 ');
  console.log('=================================================');
  
  rl.close();
}

/**
 * Helper function to ask a question and get user input
 */
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer || '');
    });
  });
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});