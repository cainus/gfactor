import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as MarkdownIt from 'markdown-it';
import { logMessage } from './logging';

// Collect context from .mdc files
export async function collectMdcContext(): Promise<string> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    logMessage('No workspace folder found for MDC context collection');
    return '';
  }

  logMessage('Collecting context from .mdc files...');
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const mdcFiles = await glob.glob('**/*.mdc', { cwd: workspaceRoot });
  
  if (mdcFiles.length === 0) {
    logMessage('No .mdc files found in the workspace');
    return '';
  }
  
  logMessage(`Found ${mdcFiles.length} .mdc files for context`);
  
  let context = '';
  const md = MarkdownIt.default();
  
  for (const file of mdcFiles) {
    try {
      const filePath = path.join(workspaceRoot, file);
      logMessage(`Reading MDC file: ${file}`);
      const content = fs.readFileSync(filePath, 'utf8');
      const plainText = md.render(content);
      context += `# ${file}\n${plainText}\n\n`;
    } catch (error) {
      const errorMessage = `Error reading .mdc file ${file}: ${error}`;
      logMessage(errorMessage);
      console.error(errorMessage);
    }
  }
  
  logMessage('MDC context collection completed');
  return context;
}