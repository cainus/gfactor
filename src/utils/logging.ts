import * as vscode from 'vscode';
import * as childProcess from 'child_process';

// Output channel for logging
let outputChannel: vscode.OutputChannel;
let sidebarWebview: vscode.Webview | undefined;

// Initialize logging
export function initializeLogging(_context: vscode.ExtensionContext): void {
  // Initialize output channel
  outputChannel = vscode.window.createOutputChannel('GFactor');
  outputChannel.appendLine('GFactor extension activated');
}

// Set the sidebar webview reference
export function setSidebarWebview(webview: vscode.Webview): void {
  sidebarWebview = webview;
}

// Clear logs in output channel and webview
export function clearLogs(): void {
  // Clear output channel
  if (outputChannel) {
    outputChannel.clear();
    outputChannel.appendLine('Starting new migration run...');
  }
  
  // Clear webview logs
  if (sidebarWebview) {
    sidebarWebview.postMessage({
      command: 'clearLogs'
    });
  }
}

// Log message to console, output channel, and webview
export function logMessage(message: string): void {
  console.log('LOGGING:', message);
  
  // Log to output channel - no timestamps
  if (outputChannel) {
    outputChannel.appendLine(message);
  }
  
  // Log to webview if available
  if (sidebarWebview) {
    console.log('SENDING TO WEBVIEW:', message);
    try {
      // Send a test message to verify the webview is working
      sidebarWebview.postMessage({
        command: 'test',
        message: 'This is a test message'
      });
      
      // Send the actual log message
      sidebarWebview.postMessage({
        command: 'log',
        message: message
      });
      
      // Try with a different command
      sidebarWebview.postMessage({
        command: 'directLog',
        message: 'DIRECT: ' + message
      });
      
      console.log('MESSAGES SENT TO WEBVIEW');
    } catch (error) {
      console.error('ERROR SENDING TO WEBVIEW:', error);
    }
  } else {
    console.log('WEBVIEW NOT AVAILABLE');
  }
}

// Run a command and return the result
export async function runCommand(command: string, cwd: string): Promise<{ success: boolean; output: string }> {
  logMessage(`Executing command: ${command} in directory: ${cwd}`);
  return new Promise((resolve) => {
    childProcess.exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        logMessage(`Command failed with error: ${error.message}`);
        if (stderr) {
          logMessage(`Command stderr: ${stderr}`);
        }
        resolve({ success: false, output: stderr || stdout });
      } else {
        logMessage(`Command executed successfully`);
        if (stdout.trim()) {
          logMessage(`Command stdout: ${stdout.length > 500 ? stdout.substring(0, 500) + '...(truncated)' : stdout}`);
        }
        resolve({ success: true, output: stdout });
      }
    });
  });
}