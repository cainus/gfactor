import { LlmService, LlmConfig } from './llm-types';
import { ClaudeService } from './claude-service';

// Factory function to get the LLM service
export function getLlmService(config: LlmConfig): LlmService {
  return new ClaudeService(config.apiKey);
}

// Re-export types for backward compatibility
export { LlmService, LlmConfig } from './llm-types';