import { Anthropic } from '@anthropic-ai/sdk';
import { LlmService } from './llm-types';
import { logMessage } from '../utils/logging';

export class ClaudeService implements LlmService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async processPrompt(prompt: string): Promise<string | null> {
    try {
      const anthropic = new Anthropic({
        apiKey: this.apiKey
      });
      
      const message = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      if (message.content[0].type === 'text') {
        return message.content[0].text;
      }
      return null;
    } catch (error) {
      logMessage(`Error with Claude API: ${error}`);
      console.error('Error with Claude API:', error);
      throw error;
    }
  }
  
  async countPatternOccurrences(content: string, findPattern: string, filePath: string, mdcContext: string): Promise<number> {
    const prompt = this.buildCountPrompt(content, findPattern, filePath, mdcContext);
    const countText = await this.processPrompt(prompt);
    
    if (countText) {
      const count = parseInt(countText.trim(), 10);
      if (!isNaN(count)) {
        logMessage(`LLM found ${count} pattern occurrences in ${filePath}`);
        return count;
      }
    }
    
    logMessage(`Failed to get valid count from LLM for ${filePath}, defaulting to 0`);
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