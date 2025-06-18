#!/usr/bin/env ts-node

/**
 * Test script for Claude CLI with streaming JSON output
 * This script sends a prompt to Claude asking it to explain claude-service.ts
 * and processes the streaming JSON response
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Create a temporary file for the prompt
const tempDir = os.tmpdir();
const promptFilePath = path.join(tempDir, `claude-prompt-${Date.now()}.txt`);

// No need to read the file content since we're using a simple prompt

// Create the prompt - simple as requested
const prompt = "explain claude-service.ts";

// Display the prompt before running
console.log('\n--- Prompt ---\n');
console.log(prompt);
console.log('\n--- End of Prompt ---\n');

// Write the prompt to the temporary file
fs.writeFileSync(promptFilePath, prompt, 'utf8');

console.log('Running Claude CLI with streaming JSON output...');
console.log(`Prompt file: ${promptFilePath}`);
console.log('\n--- Streaming Response ---\n');

// Collect the full output
let fullOutput = '';

// Run Claude CLI with stream-json output format
// This command works from the command line, so we'll use it
const params = [
  '-p',
  promptFilePath,
  '--output-format',
  'stream-json',
  '--verbose',
  '--dangerously-skip-permissions'
];

// Log the full command with parameters
const fullCommand = `claude ${params.join(' ')}`;
console.log(`\nExecuting command: ${fullCommand}\n`);

// Set a timeout to prevent hanging forever
const timeoutDuration = 300000; // 5 minutes
const timeout = setTimeout(() => {
  console.error(`\n[ERROR] Process timed out after ${timeoutDuration/1000} seconds`);
  claudeProcess.kill();
  process.exit(1);
}, timeoutDuration);

// Use shell: true to ensure the command runs exactly as it would in the terminal
const claudeProcess = childProcess.spawn('claude', params, {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

// Add a debug message to confirm the process started
console.log(`\nDEBUG: Process started with PID: ${claudeProcess.pid}\n`);

// Buffer to collect partial JSON objects
let buffer = '';

// Process stdout data
claudeProcess.stdout.on('data', (data) => {
  console.log(`\nDEBUG: Received data chunk of length: ${data.length}\n`);
  
  // Append new data to buffer
  buffer += data.toString();
  
  // Process complete lines from the buffer
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    // Extract a complete line
    const line = buffer.substring(0, newlineIndex).trim();
    // Remove the processed line from the buffer
    buffer = buffer.substring(newlineIndex + 1);
    
    // Skip empty lines
    if (!line) continue;
    
    try {
      // Parse the JSON object
      const jsonData = JSON.parse(line);
      
      // Log the raw JSON for debugging
      console.log(`\nDEBUG: Parsed JSON: ${line}\n`);
      
      // Process based on the type field
      switch (jsonData.type) {
        case 'content_block_start':
          console.log('\n[Content block starting]');
          break;
          
        case 'content_block_delta':
          // Content is being streamed
          if (jsonData.completion) {
            process.stdout.write(jsonData.completion); // Print without newline
            fullOutput += jsonData.completion;
          }
          break;
          
        case 'content_block_stop':
          console.log('\n[Content block complete]');
          break;
          
        case 'error':
          console.error('\n[ERROR]', JSON.stringify(jsonData));
          break;
          
        default:
          console.log(`\n[Unknown message type: ${jsonData.type}]`);
          if (jsonData.completion) {
            process.stdout.write(jsonData.completion);
            fullOutput += jsonData.completion;
          }
          break;
      }
    } catch {
      // If it's not valid JSON, log the raw line
      console.log(`\nDEBUG: Non-JSON output: ${line}\n`);
      process.stdout.write(line + '\n');
    }
  }
});

// Handle stderr
claudeProcess.stderr.on('data', (data) => {
  console.error(`\n[Claude Error]: ${data.toString().trim()}`);
});

// Handle process completion
claudeProcess.on('close', (code) => {
  // Clear the timeout
  clearTimeout(timeout);
  
  console.log(`\n\n--- Response Complete (exit code: ${code}) ---\n`);
  
  // Clean up the temporary file
  try {
    fs.unlinkSync(promptFilePath);
    console.log(`Temporary prompt file deleted: ${promptFilePath}`);
  } catch (error) {
    console.error(`Error deleting temporary prompt file: ${error}`);
  }
  
  // Save the full output to a file
  const outputPath = path.join(process.cwd(), 'claude-explanation.md');
  fs.writeFileSync(outputPath, fullOutput, 'utf8');
  console.log(`Full response saved to: ${outputPath}`);
  
  // Exit the process explicitly to prevent hanging
  process.exit(code || 0);
});

// Handle process errors
claudeProcess.on('error', (error) => {
  // Clear the timeout
  clearTimeout(timeout);
  
  console.error(`\n[Process Error]: ${error.message}`);
  
  // Check if the error is ENOENT (command not found)
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error("Claude CLI not found. Make sure it's installed with 'npm install -g @anthropic-ai/claude-code'");
  }
  
  // Clean up the temporary file
  try {
    fs.unlinkSync(promptFilePath);
  } catch (unlinkError) {
    console.error(`Error deleting temporary prompt file: ${unlinkError}`);
  }
  
  process.exit(1);
});

// Add a handler for the process exit event
process.on('exit', () => {
  // Make sure to kill the child process if it's still running
  if (claudeProcess && !claudeProcess.killed) {
    claudeProcess.kill();
  }
  
  // Clean up the temporary file if it still exists
  if (fs.existsSync(promptFilePath)) {
    try {
      fs.unlinkSync(promptFilePath);
    } catch {
      // Ignore errors during cleanup on exit
    }
  }
});

// Add handlers for SIGINT and SIGTERM
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Cleaning up and exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Cleaning up and exiting...');
  process.exit(0);
});