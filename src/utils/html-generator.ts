import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { PatternOccurrence } from './types';
import { RefactorFormData } from '../migration/types';
import { Sidebar } from '../components/sidebar/Sidebar';
import { BurndownChart } from '../components/burndown/BurndownChart';

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
    
    // Create the resource URI for the icon
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'gfactor-icon.png')).toString();
    
    // Render the React component to HTML
    const sidebarComponent = React.createElement(Sidebar, {
        extensionUri,
        savedFormData,
        displayState,
        hasClaudeKey,
        packageVersion,
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
    <title>GFactor AI Migration Assistant</title>
    <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
</head>
<body>
    <div id="root">${reactHtml}</div>
    
    <!-- Load React and ReactDOM -->
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
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