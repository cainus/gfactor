import * as fs from 'fs';
import * as path from 'path';
import { LlmConfig } from '../llm/llm-types';
import { getLlmService } from '../llm/llm-service';
import { logMessage, runCommand } from '../utils/logging';
import { RefactorFormData } from './types';

export class FileProcessor {
  async processFile(
    file: string,
    workspaceRoot: string,
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string,
    knownPatternCount?: number
  ): Promise<{ success: boolean; patternsFixed: number }> {
    const filePath = path.join(workspaceRoot, file);
    logMessage(`Processing file: ${file}`);
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Get LLM service
    const llmService = await getLlmService(llmConfig);
    
    // Use the known pattern count if provided, otherwise count patterns
    let initialPatternCount = knownPatternCount;
    if (initialPatternCount === undefined) {
      initialPatternCount = await llmService.countPatternOccurrences(
        content,
        formData.findPattern,
        file,
        mdcContext
      );
      logMessage(`Found ${initialPatternCount} pattern occurrences in ${file}`);
    }
    
    // Skip if no patterns found
    if (initialPatternCount === 0) {
      logMessage(`Skipping file ${file} - no patterns found`);
      return { success: false, patternsFixed: 0 };
    }
    
    // Process the file with the LLM
    logMessage(`Processing ${file} with ${llmConfig.type} LLM...`);
    
    // Build the refactoring prompt
    const prompt = this.buildRefactoringPrompt(content, file, formData, mdcContext);
    
    // Process with LLM
    let updatedContent = await llmService.processPrompt(prompt);
    
    if (!updatedContent) {
      logMessage(`LLM processing failed for ${file}`);
      return { success: false, patternsFixed: 0 };
    }
    
    if (updatedContent === content) {
      logMessage(`No changes made by LLM for ${file}`);
      return { success: false, patternsFixed: 0 };
    }
    
    // Count remaining patterns after refactoring
    const remainingPatternCount = await llmService.countPatternOccurrences(
      updatedContent,
      formData.findPattern,
      file,
      mdcContext
    );
    
    const patternsFixed = initialPatternCount - remainingPatternCount;
    logMessage(`LLM fixed ${patternsFixed} pattern occurrences in ${file}`);
    
    // Write the updated content back to the file
    logMessage(`Writing updated content to ${file}`);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    // Run compiler/linter with retry logic
    let linterSuccess = false;
    let linterAttempts = 0;
    const MAX_ATTEMPTS = 5;
    
    while (!linterSuccess && linterAttempts < MAX_ATTEMPTS) {
      linterAttempts++;
      logMessage(`Running linter (attempt ${linterAttempts}/${MAX_ATTEMPTS}): ${formData.compilerLinterCommand}`);
      const linterResult = await runCommand(formData.compilerLinterCommand, workspaceRoot);
      
      if (linterResult.success) {
        linterSuccess = true;
        logMessage(`Linter passed on attempt ${linterAttempts}`);
      } else if (linterAttempts < MAX_ATTEMPTS) {
        logMessage(`Linter failed on attempt ${linterAttempts}. Trying to fix...`);
        
        // Try to fix linter issues with LLM
        const fixLinterPrompt = this.buildFixLinterPrompt(content, updatedContent, file, linterResult.output, formData, mdcContext);
        const fixedContent = await llmService.processPrompt(fixLinterPrompt);
        
        if (fixedContent && fixedContent !== updatedContent) {
          logMessage(`LLM suggested fixes for linter issues. Applying changes...`);
          updatedContent = fixedContent;
          fs.writeFileSync(filePath, updatedContent, 'utf8');
        } else {
          logMessage(`LLM couldn't suggest fixes for linter issues. Trying again with original changes...`);
        }
      } else {
        logMessage(`Linter failed after ${MAX_ATTEMPTS} attempts. Reverting changes.`);
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: false, patternsFixed: 0 };
      }
    }
    
    // Run tests with retry logic
    let testsSuccess = false;
    let testAttempts = 0;
    
    while (!testsSuccess && testAttempts < MAX_ATTEMPTS) {
      testAttempts++;
      logMessage(`Running tests (attempt ${testAttempts}/${MAX_ATTEMPTS}): ${formData.testCommand}`);
      const testResult = await runCommand(formData.testCommand, workspaceRoot);
      
      if (testResult.success) {
        testsSuccess = true;
        logMessage(`Tests passed on attempt ${testAttempts}`);
      } else if (testAttempts < MAX_ATTEMPTS) {
        logMessage(`Tests failed on attempt ${testAttempts}. Trying to fix...`);
        
        // Try to fix test issues with LLM
        const fixTestPrompt = this.buildFixTestPrompt(content, updatedContent, file, testResult.output, formData, mdcContext);
        const fixedContent = await llmService.processPrompt(fixTestPrompt);
        
        if (fixedContent && fixedContent !== updatedContent) {
          logMessage(`LLM suggested fixes for test issues. Applying changes...`);
          updatedContent = fixedContent;
          fs.writeFileSync(filePath, updatedContent, 'utf8');
        } else {
          logMessage(`LLM couldn't suggest fixes for test issues. Trying again with original changes...`);
        }
      } else {
        logMessage(`Tests failed after ${MAX_ATTEMPTS} attempts. Reverting changes.`);
        fs.writeFileSync(filePath, content, 'utf8');
        return { success: false, patternsFixed: 0 };
      }
    }
    
    logMessage(`Tests passed for ${file}`);
    return { success: true, patternsFixed };
  }
  
  private buildRefactoringPrompt(
    content: string,
    filePath: string,
    formData: RefactorFormData,
    mdcContext: string
  ): string {
    return `
You are an expert code refactoring assistant. Your task is to migrate code from one pattern to another.

# Context from .mdc files:
${mdcContext || 'No .mdc files found in the project.'}

# File to refactor:
${filePath}

# Current content:
\`\`\`
${content}
\`\`\`

# Pattern to find:
${formData.findPattern}

# How to replace:
${formData.replacePattern}

Please refactor the code according to the specified pattern. Return ONLY the refactored code without any explanations or markdown formatting.
`;
  }

  private buildFixLinterPrompt(
    originalContent: string,
    updatedContent: string,
    filePath: string,
    linterOutput: string,
    formData: RefactorFormData,
    mdcContext: string
  ): string {
    return `
You are an expert code refactoring assistant. Your task is to fix linter/compiler errors in code that was just refactored.

# Context from .mdc files:
${mdcContext || 'No .mdc files found in the project.'}

# File that was refactored:
${filePath}

# Original content before refactoring:
\`\`\`
${originalContent}
\`\`\`

# Refactored content with linter errors:
\`\`\`
${updatedContent}
\`\`\`

# Linter/compiler errors:
\`\`\`
${linterOutput}
\`\`\`

# Pattern that was being migrated:
${formData.findPattern}

# How it was replaced:
${formData.replacePattern}

Please fix the linter/compiler errors while preserving the intent of the refactoring. Return ONLY the fixed code without any explanations or markdown formatting.
`;
  }

  private buildFixTestPrompt(
    originalContent: string,
    updatedContent: string,
    filePath: string,
    testOutput: string,
    formData: RefactorFormData,
    mdcContext: string
  ): string {
    return `
You are an expert code refactoring assistant. Your task is to fix test failures in code that was just refactored.

# Context from .mdc files:
${mdcContext || 'No .mdc files found in the project.'}

# File that was refactored:
${filePath}

# Original content before refactoring:
\`\`\`
${originalContent}
\`\`\`

# Refactored content with test failures:
\`\`\`
${updatedContent}
\`\`\`

# Test failure output:
\`\`\`
${testOutput}
\`\`\`

# Pattern that was being migrated:
${formData.findPattern}

# How it was replaced:
${formData.replacePattern}

Please fix the test failures while preserving the intent of the refactoring. Return ONLY the fixed code without any explanations or markdown formatting.
`;
  }
}