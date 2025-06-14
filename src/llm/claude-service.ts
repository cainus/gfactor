import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as childProcess from 'child_process';
import { LlmService } from './llm-types';
import { logMessage } from '../utils/logging';

export class ClaudeService implements LlmService {
  // Debug flag to enable additional logging
  private debug: boolean = true;
  
  constructor(_apiKey: string) {
    // apiKey is not used directly since we're using the Claude CLI
    // but we keep the constructor signature for compatibility
    console.log('ClaudeService initialized with debug mode:', this.debug);
  }
  
  async processPrompt(prompt: string): Promise<string | null> {
    // Maximum number of retries
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    // Create a temporary file for the prompt
    const tempDir = os.tmpdir();
    const promptFilePath = path.join(tempDir, `claude-prompt-${Date.now()}.txt`);
    
    try {
      // Write the prompt to a file
      fs.writeFileSync(promptFilePath, prompt, 'utf8');
      
      // Log the prompt file path
      logMessage(`🤖 CLAUDE: Running Claude CLI with prompt file: ${promptFilePath}`);
      
      // Log the full prompt content with clear markers
      logMessage(`🔍 PROMPT BEGIN 🔍`);
      logMessage(prompt);
      logMessage(`🔍 PROMPT END 🔍`);
      
      // Retry loop
      while (retryCount <= MAX_RETRIES) {
        try {
            logMessage(`🤖 CLAUDE: Attempting to process prompt (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            if (this.debug) {
              console.log(`CLAUDE: Attempting to process prompt (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            }
            
            return await this.runClaudeCommand(promptFilePath);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          if (retryCount < MAX_RETRIES) {
            // If not the last retry, log and continue
            retryCount++;
            logMessage(`🤖 CLAUDE WARNING: Attempt ${retryCount}/${MAX_RETRIES + 1} with real-time logging failed: ${errorMessage}. Retrying with exec...`);
          } else {
            // If last retry, throw the error
            logMessage(`🤖 CLAUDE ERROR: All ${MAX_RETRIES + 1} attempts failed. Last error: ${errorMessage}`);
            throw error;
          }
        }
      }
      
      // This should never be reached due to the throw in the last iteration of the loop
      throw new Error('Unexpected end of retry loop');
    } catch (error: unknown) {
      // Clean up the temporary file in case of error
      try {
        fs.unlinkSync(promptFilePath);
      } catch (unlinkError) {
        console.error('Error deleting temporary prompt file:', unlinkError);
      }
      
      logMessage(`🤖 CLAUDE ERROR: ${error}`);
      console.error('Error with Claude CLI:', error);
      throw error;
    }
  }
  
  // This method uses execa and stream-json to capture and process output in real-time
  // from the Claude CLI process. It logs the output as it arrives and returns the complete result.
  // This method uses childProcess.spawn to run the Claude CLI command with streaming JSON output
  private async runClaudeCommand(promptFilePath: string): Promise<string | null> {
    return new Promise<string | null>((resolve, reject) => {
      // Parameters for Claude CLI - using the correct parameters for streaming JSON
      const params = [
        '-p',
        promptFilePath,
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions'
      ];
      
      // Log the command
      const commandStr = `claude ${params.join(' ')}`;
      logMessage(`🤖 CLAUDE: Executing command: ${commandStr}`);
      if (this.debug) {
        console.log(`CLAUDE: Executing command: ${commandStr}`);
      }
      
      // Collect the full output
      let fullOutput = '';
      
      // Set up a heartbeat to show the process is still running
      const heartbeatInterval = setInterval(() => {
        logMessage(`🤖 CLAUDE: Process still running (heartbeat)`);
      }, 10000); // Log every 10 seconds
      
      // Set timeout duration - 5 minutes
      const timeoutDuration = 300000; // 5 minutes (300 seconds)
      let timeout: NodeJS.Timeout | null = null;
      
      try {
        // Use childProcess.spawn to create a process with streaming output
        const claudeProcess = childProcess.spawn('claude', params, {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Set a timeout to prevent hanging - after process is created
        timeout = setTimeout(() => {
          logMessage(`🤖 CLAUDE ERROR: Process timed out after ${timeoutDuration/1000} seconds`);
          clearInterval(heartbeatInterval);
          claudeProcess.kill();
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(promptFilePath);
          } catch (unlinkError) {
            console.error('Error deleting temporary prompt file:', unlinkError);
          }
          
          reject(new Error(`Claude CLI process timed out after ${timeoutDuration/1000} seconds`));
        }, timeoutDuration);
        
        // Log when the process starts
        logMessage(`🤖 CLAUDE: Process started with PID: ${claudeProcess.pid}`);
        if (this.debug) {
          console.log(`CLAUDE: Process started with PID: ${claudeProcess.pid}`);
        }
        
        // Buffer to collect partial JSON objects
        let buffer = '';
        
        // Process stdout data
        claudeProcess.stdout.on('data', (data) => {
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
              
              // Log in debug mode
              if (this.debug) {
                console.log(`CLAUDE JSON: Type=${jsonData.type}`);
              }
              
              // Log the raw JSON for all message types
              logMessage(`🤖 CLAUDE JSON: ${JSON.stringify(jsonData)}`);
              
              // Process based on the type field
              switch (jsonData.type) {
                case 'content_block_start':
                  // A new content block is starting
                  logMessage(`🤖 CLAUDE: Content block starting`);
                  break;
                  
                case 'content_block_delta':
                  // Content is being streamed
                  if (jsonData.completion) {
                    fullOutput += jsonData.completion;
                    
                    // Stream the content directly to the output window
                    process.stdout.write(jsonData.completion);
                    
                    // Also log with markers for debugging
                    logMessage(`🤖 CLAUDE CONTENT: ${jsonData.completion}`);
                  }
                  break;
                  
                case 'content_block_stop':
                  // Content block is complete
                  logMessage(`🤖 CLAUDE: Content block complete`);
                  break;
                  
                case 'error':
                  // Handle error messages
                  logMessage(`🤖 CLAUDE ERROR: ${JSON.stringify(jsonData)}`);
                  break;
                  
                case 'system':
                case 'assistant':
                case 'user':
                  // Handle message types
                  logMessage(`🤖 CLAUDE ${jsonData.type.toUpperCase()}: ${JSON.stringify(jsonData)}`);
                  break;
                  
                default:
                  // Handle any other message types
                  logMessage(`🤖 CLAUDE UNKNOWN TYPE: ${jsonData.type}`);
                  // Still capture any completion content
                  if (jsonData.completion) {
                    fullOutput += jsonData.completion;
                  }
                  break;
              }
            } catch (parseError) {
              // If it's not valid JSON, log the raw line and error
              logMessage(`🤖 CLAUDE RAW OUTPUT: ${line} (Parse error: ${parseError})`);
              if (this.debug) {
                console.log(`CLAUDE RAW OUTPUT: ${line}`);
                console.log(`CLAUDE PARSE ERROR: ${parseError}`);
              }
            }
          }
        });
        
        // Handle stderr
        claudeProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          logMessage(`🤖 CLAUDE ERROR: ${chunk.trim()}`);
          if (this.debug) {
            console.error(`CLAUDE ERROR: ${chunk.trim()}`);
          }
        });
        
        // Handle process completion
        claudeProcess.on('close', (code) => {
          if (timeout) clearTimeout(timeout);
          clearInterval(heartbeatInterval);
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(promptFilePath);
          } catch (unlinkError) {
            console.error('Error deleting temporary prompt file:', unlinkError);
          }
          
          if (code !== 0) {
            logMessage(`🤖 CLAUDE: Process exited with code ${code}`);
            reject(new Error(`Claude CLI process exited with code ${code}`));
            return;
          }
          
          logMessage(`🤖 CLAUDE: Process completed successfully`);
          resolve(fullOutput.trim());
        });
        
        // Handle process errors
        claudeProcess.on('error', (error) => {
          if (timeout) clearTimeout(timeout);
          clearInterval(heartbeatInterval);
          
          logMessage(`🤖 CLAUDE ERROR: Process error: ${error.message}`);
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(promptFilePath);
          } catch (unlinkError) {
            console.error('Error deleting temporary prompt file:', unlinkError);
          }
          
          reject(error);
        });
        
      } catch (error) {
        // Handle any errors during process creation
        if (timeout) clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        
        logMessage(`🤖 CLAUDE ERROR: Failed to start process: ${error instanceof Error ? error.message : String(error)}`);
        console.error('Failed to start Claude CLI process:', error);
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(promptFilePath);
        } catch (unlinkError) {
          console.error('Error deleting temporary prompt file:', unlinkError);
        }
        
        reject(error);
      }
    });
  }
  
  async countPatternOccurrences(content: string, findPattern: string, filePath: string, mdcContext: string): Promise<number> {
    logMessage(`🤖 CLAUDE: Counting pattern occurrences in ${filePath}`);
    const prompt = this.buildCountPrompt(content, findPattern, filePath, mdcContext);
    
    logMessage(`🤖 CLAUDE: Sending prompt to count patterns in ${filePath}`);
    const countText = await this.processPrompt(prompt);
    
    if (countText) {
      const count = parseInt(countText.trim(), 10);
      if (!isNaN(count)) {
        logMessage(`🤖 CLAUDE: Found ${count} pattern occurrences in ${filePath}`);
        return count;
      }
    }
    
    logMessage(`🤖 CLAUDE: Failed to get valid count from Claude for ${filePath}, defaulting to 0`);
    return 0;
  }
  
  private buildCountPrompt(content: string, findPattern: string, filePath: string, mdcContext: string): string {
    return `
You are an expert code analyzer. Your task is to count how many instances of a specific pattern exist in the code.

# Context from .mdc files:
${mdcContext || 'No .mdc files found in the project.'}

# File to analyze:
${filePath}

# Current content:
\`\`\`
${content}
\`\`\`

# Pattern to find:
${findPattern}

Please analyze the code and count how many instances of the specified pattern exist.
Return ONLY a single number representing the count, with no additional text or explanation.
`;
  }
}