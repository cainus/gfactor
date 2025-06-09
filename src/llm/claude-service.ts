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
    try {
      // Create a temporary file for the prompt
      const tempDir = os.tmpdir();
      const promptFilePath = path.join(tempDir, `claude-prompt-${Date.now()}.txt`);
      fs.writeFileSync(promptFilePath, prompt, 'utf8');
      
      logMessage(`🤖 CLAUDE: Running Claude CLI with prompt file: ${promptFilePath}`);
      
      // Use the Claude CLI with -p option to prevent interactive mode
      // Use spawn instead of exec to stream the output
      return new Promise<string | null>((resolve, reject) => {
        let fullOutput = '';
        let fullError = '';
        
        // Use spawn to stream the output
        const claudeProcess = childProcess.spawn('claude', ['-p', promptFilePath]);
        
        // Stream stdout
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          fullOutput += chunk;
          // Log each chunk of output
          logMessage(`🤖 CLAUDE OUTPUT: ${chunk.trim()}`);
        });
        
        // Stream stderr
        claudeProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          fullError += chunk;
          // Log each chunk of error output
          logMessage(`🤖 CLAUDE ERROR: ${chunk.trim()}`);
        });
        
        // Handle process completion
        claudeProcess.on('close', (code) => {
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
          logMessage(`🤖 CLAUDE ERROR: ${error.message}`);
          console.error('Error running Claude CLI:', error);
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(promptFilePath);
          } catch (unlinkError) {
            console.error('Error deleting temporary prompt file:', unlinkError);
          }
          
          reject(error);
        });
      });
    } catch (error) {
      logMessage(`Error with Claude CLI: ${error}`);
      console.error('Error with Claude CLI:', error);
      throw error;
    }
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