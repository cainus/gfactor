// LLM service interface and types
export interface LlmService {
  processPrompt(prompt: string): Promise<string | null>;
  countPatternOccurrences(content: string, findPattern: string, filePath: string, mdcContext: string): Promise<number>;
}

export interface LlmConfig {
  type: 'claude';
  apiKey: string;
}