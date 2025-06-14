import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LlmService } from './llm-types';
import { logMessage } from '../utils/logging';

export class ClaudeService implements LlmService {
  constructor(_apiKey: string) {
    // apiKey is not used directly since we're using the Claude CLI
    // but we keep the constructor signature for compatibility
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
            logMessage(`🤖 CLAUDE: Attempting to process with real-time logging (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
            return await this.runClaudeWithRealTimeLogging(promptFilePath);
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
  
  // This method uses spawn to capture output in real-time (streaming) from the Claude CLI process
  // It logs the output as it arrives, but still returns the complete result when finished
  private async runClaudeWithRealTimeLogging(promptFilePath: string): Promise<string | null> {
    // Use the Claude CLI with -p option to prevent interactive mode
    // Use spawn instead of exec to stream the output
    return new Promise<string | null>((resolve, reject) => {
      let fullOutput = '';
      let fullError = '';
      
      
      // Use spawn to stream the output with explicit stdio configuration and JSON streaming
      const params = ['-p', promptFilePath, '--output-format', 'stream-json', '--dangerously-skip-permissions'];
      const command = `claude ${params.join(" ")}`;
      logMessage(`🤖 CLAUDE: Executing command: ${command}`);
      const claudeProcess = childProcess.spawn('claude', params, {
        stdio: ['ignore', 'pipe', 'pipe'] // stdin, stdout, stderr
      });
      
      // Log the spawn command for debugging
      logMessage(`🤖 CLAUDE DEBUG: Spawned process with command: ${command}`);
      
      // Log when the process starts
      logMessage(`🤖 CLAUDE: Process started with PID: ${claudeProcess.pid}`);
      
      // Log when we set up the data handlers
      logMessage(`🤖 CLAUDE DEBUG: Setting up stdout and stderr handlers`);
      
      // Stream stdout and parse JSON
      claudeProcess.stdout.on('data', (data) => {
        logMessage(`🤖 CLAUDE DEBUG: Received stdout data of length ${data.length}`);
        const chunk = data.toString();
        
        try {
          // Each line is a separate JSON object in streaming mode
          const lines = chunk.split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const jsonData = JSON.parse(line);
              
              // Extract the content from the JSON structure
              if (jsonData.completion) {
                fullOutput += jsonData.completion;
                
                // Log each chunk of output with clear markers
                logMessage(`🤖 CLAUDE JSON OUTPUT BEGIN 🤖`);
                logMessage(`Type: ${jsonData.type}, Content: ${jsonData.completion}`);
                logMessage(`🤖 CLAUDE JSON OUTPUT END 🤖`);
              } else if (jsonData.error) {
                // Handle error messages in the JSON
                fullError += JSON.stringify(jsonData.error);
                logMessage(`🤖 CLAUDE JSON ERROR: ${JSON.stringify(jsonData.error)}`);
              }
            } catch {
              // If line isn't valid JSON, just log it as-is
              fullOutput += line;
              logMessage(`🤖 CLAUDE OUTPUT (non-JSON): ${line.trim()}`);
            }
          }
        } catch {
          // If parsing fails, treat as plain text
          fullOutput += chunk;
          logMessage(`🤖 CLAUDE OUTPUT BEGIN 🤖`);
          logMessage(chunk.trim());
          logMessage(`🤖 CLAUDE OUTPUT END 🤖`);
        }
      });
      
      // Stream stderr
      claudeProcess.stderr.on('data', (data) => {
        logMessage(`🤖 CLAUDE DEBUG: Received stderr data of length ${data.length}`);
        const chunk = data.toString();
        fullError += chunk;
        // Log each chunk of error output with clear markers
        logMessage(`🤖 CLAUDE ERROR OUTPUT BEGIN 🤖`);
        logMessage(chunk.trim());
        logMessage(`🤖 CLAUDE ERROR OUTPUT END 🤖`);
      });
      
      // Add more event handlers for debugging
      claudeProcess.stdout.on('readable', () => {
        logMessage(`🤖 CLAUDE DEBUG: stdout became readable`);
      });
      
      claudeProcess.stderr.on('readable', () => {
        logMessage(`🤖 CLAUDE DEBUG: stderr became readable`);
      });
      
      claudeProcess.stdout.on('end', () => {
        logMessage(`🤖 CLAUDE DEBUG: stdout stream ended`);
      });
      
      claudeProcess.stderr.on('end', () => {
        logMessage(`🤖 CLAUDE DEBUG: stderr stream ended`);
      });
      
      // Set up a heartbeat to show the process is still running
      const heartbeatInterval = setInterval(() => {
        logMessage(`🤖 CLAUDE: Process ${claudeProcess.pid} still running (heartbeat)`);
      }, 10000); // Log every 10 seconds
      
      // Set a timeout to prevent hanging - increased to 5 minutes
      const timeoutDuration = 300000; // 5 minutes (300 seconds)
      logMessage(`🤖 CLAUDE: Setting timeout for ${timeoutDuration/1000} seconds`);
      
      const timeout = setTimeout(() => {
        logMessage(`🤖 CLAUDE ERROR: Process timed out after ${timeoutDuration/1000} seconds`);
        // Clear the heartbeat before killing the process
        clearInterval(heartbeatInterval);
        claudeProcess.kill();
        reject(new Error(`Claude CLI process timed out after ${timeoutDuration/1000} seconds`));
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(promptFilePath);
        } catch (unlinkError) {
          console.error('Error deleting temporary prompt file:', unlinkError);
        }
      }, timeoutDuration);
      
      // Handle process completion
      claudeProcess.on('close', (code) => {
        // Clear the timeout and heartbeat
        clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(promptFilePath);
        } catch (unlinkError) {
          console.error('Error deleting temporary prompt file:', unlinkError);
        }
        
        if (code !== 0) {
          logMessage(`🤖 CLAUDE: Process exited with code ${code}`);
          if (fullError) {
            logMessage(`🤖 CLAUDE ERROR: ${fullError}`);
            console.error('Claude CLI stderr:', fullError);
          }
          reject(new Error(`Claude CLI process exited with code ${code}`));
          return;
        }
        
        logMessage(`🤖 CLAUDE: Process completed successfully`);
        resolve(fullOutput.trim());
      });
      
      // Handle process errors
      claudeProcess.on('error', (error) => {
        // Clear the timeout and heartbeat
        clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        
        logMessage(`🤖 CLAUDE ERROR: Process error: ${error.message}`);
        console.error('Error running Claude CLI:', error);
        
        // Check if the error is ENOENT (command not found)
        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          logMessage(`🤖 CLAUDE ERROR: Claude CLI not found. Make sure it's installed with 'npm install -g @anthropic-ai/claude-code'`);
        }
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(promptFilePath);
        } catch (unlinkError) {
          console.error('Error deleting temporary prompt file:', unlinkError);
        }
        
        reject(error);
      });
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