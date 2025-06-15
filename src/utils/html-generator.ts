import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { PatternOccurrence } from './types';
import { RefactorFormData } from '../migration/types';
import { Sidebar } from '../components/sidebar/Sidebar';
import { BurndownChart } from '../components/burndown/BurndownChart';
import { AssistantMessageFormatter } from '../components/sidebar/AssistantMessageFormatter';
import { JsonFormatter } from '../components/sidebar/JsonFormatter';

/**
 * Generates HTML for the main sidebar webview using React components
 */
export function getSidebarHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    savedFormData: RefactorFormData | undefined,
    displayState: {apiKeysForm: boolean},
    hasClaudeKey: boolean
): string {
    // Get package version
    let packageVersion = "1.0.0"; // Default fallback
    try {
        const packageJsonPath = path.join(extensionUri.fsPath, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageVersion = packageJson.version;
    } catch (error) {
        console.error('Error reading package.json:', error);
    }
    
    // Read timestamp from file
    let timestampContent = "[missing timestamp]";
    try {
        // Try multiple locations for timestamp.txt
        
        // First try: workspace folder
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            try {
                const workspaceTimestampPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'timestamp.txt');
                timestampContent = fs.readFileSync(workspaceTimestampPath, 'utf8').trim();
                console.log('Found timestamp.txt in workspace folder (HTML generation)');
            } catch {
                // Workspace folder failed, continue to next location
            }
        }
        
        // Second try: extension directory
        if (timestampContent === "[missing timestamp]") {
            try {
                const extensionTimestampPath = path.join(extensionUri.fsPath, 'timestamp.txt');
                timestampContent = fs.readFileSync(extensionTimestampPath, 'utf8').trim();
                console.log('Found timestamp.txt in extension directory (HTML generation)');
            } catch {
                // Extension directory failed, continue to next location
            }
        }
        
        // Third try: dist directory
        if (timestampContent === "[missing timestamp]") {
            try {
                const distTimestampPath = path.join(extensionUri.fsPath, 'dist', 'timestamp.txt');
                timestampContent = fs.readFileSync(distTimestampPath, 'utf8').trim();
                console.log('Found timestamp.txt in dist directory (HTML generation)');
            } catch {
                // Dist directory failed, use default
            }
        }
    } catch (error) {
        console.error('Error reading timestamp file:', error);
    }
    
    // Create the resource URI for the icon
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'gfactor-icon.png')).toString();
    
    // Render the React component to HTML
    const sidebarComponent = React.createElement(Sidebar, {
        extensionUri,
        savedFormData,
        displayState,
        hasClaudeKey,
        packageVersion,
        timestampContent,
        iconUri
    });
    
    const reactHtml = ReactDOMServer.renderToString(sidebarComponent);
    

    // Get the URI for the client-side JavaScript file
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'sidebar-client.js')).toString();
    
    // Return the complete HTML with the React-rendered content
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor AI Migration Assistant - ${timestampContent}</title>
    <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
</head>
<body>
    <div id="root">${reactHtml}</div>
    
    <div id="log-container">
        <div id="logWindow" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--vscode-panel-border); margin-top: 20px;">
            <div id="logContent"></div>
        </div>
    </div>
    
    <script>
      // Make React components available to the client-side code
      window.Components = {
        AssistantMessageFormatter: ${AssistantMessageFormatter.toString().replace(/^function/, 'function')},
        JsonFormatter: ${JsonFormatter.toString().replace(/^function/, 'function')}
      };
    </script>

    <!-- Load the client-side JavaScript -->
    <script src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Generates HTML for the burndown chart using React components
 */
export function getBurndownChartHtml(occurrences: PatternOccurrence[]): string {
    // Render the React component to HTML
    const burndownComponent = React.createElement(BurndownChart, { occurrences });
    const reactHtml = ReactDOMServer.renderToString(burndownComponent);
    
    // Return the complete HTML with the React-rendered content
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor: Pattern Burndown Chart</title>
</head>
<body>
    <div id="root">${reactHtml}</div>
</body>
</html>`;
}