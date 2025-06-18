import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { LlmConfig } from '../llm/llm-types';
import { getLlmService } from '../llm/llm-service';
import { FileProcessor } from './file-processor';
import { logMessage } from '../utils/logging';
import { PatternOccurrence } from '../utils/types';
import { RefactorFormData } from './types';

export class MigrationService {
  private patternOccurrences: PatternOccurrence[] = [];
  private fileProcessor: FileProcessor;
  
  constructor() {
    this.fileProcessor = new FileProcessor();
  }
  
  async countFilesToMigrate(
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string,
    cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    // Reset pattern occurrences for new counting session
    this.patternOccurrences = [];
    
    logMessage('📊 PROGRESS: Counting files that need migration...');
    
    // Use our own cancellation token that can be triggered by the stop button
    const token = cancellationToken;
    
    try {
      // Find files matching the pattern
      logMessage(`📊 PROGRESS: Searching for files matching pattern: ${formData.filePatterns}`);
      const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
      const files = await glob.glob(formData.filePatterns, { cwd: workspaceRoot });
      
      if (files.length === 0) {
        const message = '⚠️ WARNING: No files found matching the specified pattern.';
        logMessage(message);
        return;
      }
      
      logMessage(`📊 PROGRESS: Found ${files.length} files to scan`);
      
      // Count files with pattern occurrences
      let filesWithPatterns = 0;
      let totalPatternCount = 0;
      
      const llmService = await getLlmService(llmConfig);
      
      for (let i = 0; i < files.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }
        
        const file = files[i];
        const filePath = path.join(workspaceRoot, file);
        
        logMessage(`📊 PROGRESS: Scanning file ${i + 1}/${files.length}: ${file}`);
        
        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Count pattern occurrences in this file
        const patternCount = await llmService.countPatternOccurrences(
          content,
          formData.findPattern,
          file,
          mdcContext
        );
        
        if (patternCount > 0) {
          filesWithPatterns++;
          totalPatternCount += patternCount;
          logMessage(`📊 PROGRESS: Found ${patternCount} pattern occurrences in ${file}`);
        }
      }
      
      // Show results
      const message = `📊 PROGRESS: Found ${filesWithPatterns} files with patterns (${totalPatternCount} total pattern occurrences)`;
      logMessage(message);
      
    } catch (error) {
      const errorMessage = `⚠️ ERROR: Error counting files: ${error}`;
      logMessage(errorMessage);
      console.error('Error counting files:', error);
    }
  }
  
  async performRefactoring(
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string,
    cancellationToken: vscode.CancellationToken
  ): Promise<void> {
    // Reset pattern occurrences for new refactoring session
    this.patternOccurrences = [];
    
    // Log start of refactoring
    logMessage('📊 PROGRESS: Starting code migration process');
    
    // Use our own cancellation token that can be triggered by the stop button
    const token = cancellationToken;
    
    try {
      // Find files matching the pattern
      logMessage(`📊 PROGRESS: Searching for files matching pattern: ${formData.filePatterns}`);
      const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
      const files = await glob.glob(formData.filePatterns, { cwd: workspaceRoot });
      
      if (files.length === 0) {
        const message = '⚠️ WARNING: No files found matching the specified pattern.';
        logMessage(message);
        return;
      }
      
      logMessage(`📊 PROGRESS: Found ${files.length} files to process`);
      
      const llmService = await getLlmService(llmConfig);
      
      // Handle differently based on the action
      let filesToProcess: string[] = [];
      let totalInitialPatternCount = 0;
      
      if (formData.action === 'migrateOneFile') {
        // For migrateOneFile, stop scanning as soon as we find a file with patterns
        logMessage('📊 PROGRESS: Looking for the first file with patterns to migrate...');
        let fileFound = false;
        
        for (const file of files) {
          if (token.isCancellationRequested) {
            break;
          }
          
          const filePath = path.join(workspaceRoot, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const patternCount = await llmService.countPatternOccurrences(
            content,
            formData.findPattern,
            file,
            mdcContext
          );
          
          if (patternCount > 0) {
            logMessage(`📊 PROGRESS: Found ${patternCount} pattern occurrences in ${file}`);
            filesToProcess = [file];
            totalInitialPatternCount = patternCount;
            
            // Record initial pattern count
            this.patternOccurrences.push({
              timestamp: new Date(),
              count: patternCount
            });
            
            logMessage(`📊 PROGRESS: MIGRATE ONE FILE MODE: Will only process file: ${file}`);
            fileFound = true;
            break; // Stop scanning after finding the first file
          }
        }
        
        if (!fileFound) {
          logMessage('⚠️ WARNING: No files with patterns found to migrate.');
          return;
        }
      } else {
        // For other actions, scan all files
        logMessage('📊 PROGRESS: Scanning files for initial pattern count...');
        const filesWithPatterns: string[] = [];
        
        for (const file of files) {
          if (token.isCancellationRequested) {
            break;
          }
          
          const filePath = path.join(workspaceRoot, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const patternCount = await llmService.countPatternOccurrences(
            content,
            formData.findPattern,
            file,
            mdcContext
          );
          
          if (patternCount > 0) {
            logMessage(`📊 PROGRESS: Found ${patternCount} pattern occurrences in ${file}`);
            filesWithPatterns.push(file);
            totalInitialPatternCount += patternCount;
          }
        }
        
        // Record initial pattern count
        if (totalInitialPatternCount > 0) {
          logMessage(`📊 PROGRESS: Total initial pattern count: ${totalInitialPatternCount}`);
          this.patternOccurrences.push({
            timestamp: new Date(),
            count: totalInitialPatternCount
          });
        } else {
          logMessage('⚠️ WARNING: No patterns found in any files.');
          return;
        }
        
        filesToProcess = files;
        logMessage(`📊 PROGRESS: Will process ${filesToProcess.length} files`);
      }
      
      // Process each file
      for (let i = 0; i < filesToProcess.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }
        
        const file = filesToProcess[i];
        
        logMessage(`📊 PROGRESS: Processing file ${i + 1}/${filesToProcess.length}: ${file}`);
        
        // For migrateOneFile, we need to pass the pattern count for this specific file
        const knownPatternCount = formData.action === 'migrateOneFile' ? totalInitialPatternCount : undefined;
        
        // Process the file - pass the known pattern count to avoid recounting
        const result = await this.fileProcessor.processFile(
          file,
          workspaceRoot,
          formData,
          llmConfig,
          mdcContext,
          knownPatternCount // Pass the known pattern count for this file
        );
        
        // If processing was successful and patterns were fixed
        if (result.success && result.patternsFixed > 0) {
          // Record successful pattern fixes
          logMessage(`📊 PROGRESS: Successfully fixed ${result.patternsFixed} pattern occurrences in ${file}`);
          
          // Get current total count
          const currentTotal = this.patternOccurrences.length > 0
            ? this.patternOccurrences[this.patternOccurrences.length - 1].count
            : totalInitialPatternCount;
          
          this.patternOccurrences.push({
            timestamp: new Date(),
            count: currentTotal - result.patternsFixed,
            file: file
          });
          
          // If we're stopping after each file, log a message and continue
          if (formData.stopOption === 'afterEachFile') {
            logMessage(`📊 PROGRESS: Successfully migrated file ${file} (${i + 1}/${filesToProcess.length}). Continuing to next file.`);
          }
        }
      }
      
      // Log completion
      logMessage('✅ SUCCESS: Code migration process completed successfully!');
      
    } catch (error) {
      const errorMessage = `⚠️ ERROR: Error during code migration: ${error}`;
      logMessage(errorMessage);
      console.error('Error during refactoring:', error);
    }
  }
  
  // Get the pattern occurrences for the burndown chart
  getPatternOccurrences(): PatternOccurrence[] {
    return this.patternOccurrences;
  }
}