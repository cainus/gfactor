import { LlmConfig, getLlmService } from '../llm/llm-service';

export class PatternDetector {
  async countPatternOccurrences(
    content: string,
    findPattern: string,
    filePath: string,
    llmConfig: LlmConfig,
    mdcContext: string
  ): Promise<number> {
    const llmService = await getLlmService(llmConfig);
    return await llmService.countPatternOccurrences(content, findPattern, filePath, mdcContext);
  }
}