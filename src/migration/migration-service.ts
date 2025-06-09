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
    logMessage('Counting files that need migration...');
    
    // Show progress
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'GFactor: Counting files to migrate',
        cancellable: true
      },
      async (progress, _progressToken) => {
        // Use our own cancellation token that can be triggered by the stop button
        const token = cancellationToken;
        
        try {
          // Find files matching the pattern
          logMessage(`Searching for files matching pattern: ${formData.filePatterns}`);
          const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
          const files = await glob.glob(formData.filePatterns, { cwd: workspaceRoot });
          
          if (files.length === 0) {
            const message = 'No files found matching the specified pattern.';
            logMessage(message);
            vscode.window.showWarningMessage(message);
            return;
          }
          
          logMessage(`Found ${files.length} files to scan`);
          progress.report({ message: `Found ${files.length} files to scan` });
          
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
            
            progress.report({
              message: `Scanning file ${i + 1}/${files.length}: ${file}`,
              increment: (1 / files.length) * 100
            });
            
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
              logMessage(`Found ${patternCount} pattern occurrences in ${file}`);
            }
          }
          
          // Show results
          const message = `Found ${filesWithPatterns} files with patterns (${totalPatternCount} total pattern occurrences)`;
          logMessage(message);
          vscode.window.showInformationMessage(message);
          
        } catch (error) {
          const errorMessage = `Error counting files: ${error}`;
          logMessage(errorMessage);
          console.error('Error counting files:', error);
          vscode.window.showErrorMessage(errorMessage);
        }
      }
    );
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
    logMessage('Starting code migration process');
    
    // Show progress
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'GFactor: Performing code migration',
        cancellable: true
      },
      async (progress, _progressToken) => {
        // Use our own cancellation token that can be triggered by the stop button
        const token = cancellationToken;
        
        try {
          // Find files matching the pattern
          logMessage(`Searching for files matching pattern: ${formData.filePatterns}`);
          const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
          const files = await glob.glob(formData.filePatterns, { cwd: workspaceRoot });
          
          if (files.length === 0) {
            const message = 'No files found matching the specified pattern.';
            logMessage(message);
            vscode.window.showWarningMessage(message);
            return;
          }
          
          logMessage(`Found ${files.length} files to process`);
          progress.report({ message: `Found ${files.length} files to process` });
          
          const llmService = await getLlmService(llmConfig);
          
          // Handle differently based on the action
          let filesToProcess: string[] = [];
          let totalInitialPatternCount = 0;
          
          if (formData.action === 'migrateOneFile') {
            // For migrateOneFile, stop scanning as soon as we find a file with patterns
            logMessage('Looking for the first file with patterns to migrate...');
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
                logMessage(`Found ${patternCount} pattern occurrences in ${file}`);
                filesToProcess = [file];
                totalInitialPatternCount = patternCount;
                
                // Record initial pattern count
                this.patternOccurrences.push({
                  timestamp: new Date(),
                  count: patternCount
                });
                
                logMessage(`MIGRATE ONE FILE MODE: Will only process file: ${file}`);
                vscode.window.showInformationMessage(`Migrating only one file: ${file}`);
                fileFound = true;
                break; // Stop scanning after finding the first file
              }
            }
            
            if (!fileFound) {
              logMessage('No files with patterns found to migrate.');
              vscode.window.showInformationMessage('No files with patterns found to migrate.');
              return;
            }
          } else {
            // For other actions, scan all files
            logMessage('Scanning files for initial pattern count...');
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
                logMessage(`Found ${patternCount} pattern occurrences in ${file}`);
                filesWithPatterns.push(file);
                totalInitialPatternCount += patternCount;
              }
            }
            
            // Record initial pattern count
            if (totalInitialPatternCount > 0) {
              logMessage(`Total initial pattern count: ${totalInitialPatternCount}`);
              this.patternOccurrences.push({
                timestamp: new Date(),
                count: totalInitialPatternCount
              });
            } else {
              logMessage('No patterns found in any files.');
              vscode.window.showInformationMessage('No patterns found in any files.');
              return;
            }
            
            filesToProcess = files;
            logMessage(`Will process ${filesToProcess.length} files`);
          }
          
          // Process each file
          for (let i = 0; i < filesToProcess.length; i++) {
            if (token.isCancellationRequested) {
              break;
            }
            
            const file = filesToProcess[i];
            
            logMessage(`Processing file ${i + 1}/${filesToProcess.length}: ${file}`);
            progress.report({
              message: `Processing file ${i + 1}/${filesToProcess.length}: ${file}`,
              increment: (1 / filesToProcess.length) * 100
            });
            
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
              logMessage(`Successfully fixed ${result.patternsFixed} pattern occurrences in ${file}`);
              
              // Get current total count
              const currentTotal = this.patternOccurrences.length > 0
                ? this.patternOccurrences[this.patternOccurrences.length - 1].count
                : totalInitialPatternCount;
              
              this.patternOccurrences.push({
                timestamp: new Date(),
                count: currentTotal - result.patternsFixed,
                file: file
              });
              
              // If we're stopping after each file, show a message
              if (formData.stopOption === 'afterEachFile') {
                const continueRefactoring = await vscode.window.showInformationMessage(
                  `Successfully migrated file ${file} (${i + 1}/${filesToProcess.length}).`,
                  'Continue',
                  'Stop Migration'
                );
                
                if (continueRefactoring === 'Stop Migration') {
                  break;
                }
              }
            }
          }
          
          // Log completion
          logMessage('Code migration process completed successfully!');
          
          // Show completion message
          vscode.window.showInformationMessage('Code migration completed successfully!');
          
        } catch (error) {
          const errorMessage = `Error during code migration: ${error}`;
          logMessage(errorMessage);
          console.error('Error during refactoring:', error);
          vscode.window.showErrorMessage(errorMessage);
        }
      }
    );
  }
  
  // Get the pattern occurrences for the burndown chart
  getPatternOccurrences(): PatternOccurrence[] {
    return this.patternOccurrences;
  }
}