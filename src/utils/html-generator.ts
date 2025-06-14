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
    
    // Return the complete HTML with the React-rendered content
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor AI Migration Assistant - ${timestampContent}</title>
</head>
<body>
    <div id="root">${reactHtml}</div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Function to add log messages to the log window
        function addLogMessage(message) {
            const logContent = document.getElementById('logContent');
            const logEntry = document.createElement('div');
            logEntry.textContent = message;
            logContent.appendChild(logEntry);
            
            // Auto-scroll to bottom
            const logWindow = document.getElementById('logWindow');
            logWindow.scrollTop = logWindow.scrollHeight;
            
            // Send message to extension to persist the log
            vscode.postMessage({
                command: 'persistLog',
                message: message
            });
        }
        
        // Function to restore saved logs
        function restoreLogs(logs) {
            const logContent = document.getElementById('logContent');
            logs.forEach(message => {
                const logEntry = document.createElement('div');
                logEntry.textContent = message;
                logContent.appendChild(logEntry);
            });
            
            // Auto-scroll to bottom
            const logWindow = document.getElementById('logWindow');
            logWindow.scrollTop = logWindow.scrollHeight;
        }
        
        // Restore saved logs when the webview loads
        document.addEventListener('DOMContentLoaded', () => {
            // Request saved logs from the extension
            vscode.postMessage({
                command: 'requestLogs'
            });
        });
        
        // Function to collect and save refactor form data
        function saveRefactorFormData() {
            const formData = {
                compilerLinterCommand: document.getElementById('compilerLinterCommand').value,
                testCommand: document.getElementById('testCommand').value,
                filePatterns: document.getElementById('filePatterns').value,
                findPattern: document.getElementById('findPattern').value,
                replacePattern: document.getElementById('replacePattern').value,
                stopOption: 'custom' // No longer using radio buttons
            };
            
            vscode.postMessage({
                command: 'saveFormData',
                data: formData
            });
            
            return formData;
        }
        
        // Toggle API Keys form
        document.getElementById('configureApiKeys').addEventListener('click', () => {
            const form = document.getElementById('apiKeysForm');
            const button = document.getElementById('configureApiKeys');
            const refactorForm = document.getElementById('refactorForm');
            const isVisible = form.style.display === 'block' || getComputedStyle(form).display === 'block';
            
            // Save display state
            const displayState = {
                apiKeysForm: !isVisible
            };
            vscode.postMessage({
                command: 'saveDisplayState',
                data: displayState
            });
            
            if (isVisible) {
                form.style.display = 'none';
                button.classList.remove('active-button');
            } else {
                form.style.display = 'block';
                button.classList.add('active-button');
            }
        });
        
        // Hide API Keys form when clicking elsewhere
        document.addEventListener('click', (event) => {
            const apiKeysForm = document.getElementById('apiKeysForm');
            const configureApiKeysButton = document.getElementById('configureApiKeys');
            
            // If API Keys form is visible and click is outside the form and button
            if (getComputedStyle(apiKeysForm).display === 'block' &&
                !apiKeysForm.contains(event.target) &&
                event.target !== configureApiKeysButton) {
                
                apiKeysForm.style.display = 'none';
                configureApiKeysButton.classList.remove('active-button');
                
                // Save display state
                vscode.postMessage({
                    command: 'saveDisplayState',
                    data: { apiKeysForm: false }
                });
            }
        });
        
        // Initialize button states based on form visibility
        document.addEventListener('DOMContentLoaded', () => {
            const apiKeysForm = document.getElementById('apiKeysForm');
            
            // Set button states based on form visibility
            if (getComputedStyle(apiKeysForm).display === 'block') {
                document.getElementById('configureApiKeys').classList.add('active-button');
            }
        });
        
        // API Keys form actions
        document.getElementById('saveApiKeys').addEventListener('click', () => {
            const apiKey = document.getElementById('apiKey').value;
            
            vscode.postMessage({
                command: 'saveApiKeys',
                data: { llmType: 'claude', apiKey }
            });
            
            document.getElementById('apiKeysForm').style.display = 'none';
            document.getElementById('configureApiKeys').classList.remove('active-button');
        });
        
        document.getElementById('cancelApiKeys').addEventListener('click', () => {
            document.getElementById('apiKeysForm').style.display = 'none';
            document.getElementById('configureApiKeys').classList.remove('active-button');
        });
        
        // Function to show/hide action buttons and stop button
        function setMigrationRunningState(isRunning) {
            const actionButtons = ['countFiles', 'migrateOneFile', 'migrateAllFiles'];
            const stopButton = document.getElementById('stopMigration');
            
            // Show/hide action buttons
            actionButtons.forEach(id => {
                const button = document.getElementById(id);
                if (isRunning) {
                    button.classList.add('hidden');
                } else {
                    button.classList.remove('hidden');
                }
            });
            
            // Show/hide and enable/disable stop button
            if (isRunning) {
                stopButton.classList.remove('hidden');
                stopButton.style.display = 'block';
            } else {
                stopButton.classList.add('hidden');
                stopButton.style.display = 'none';
            }
            stopButton.disabled = !isRunning;
            
            // Log button state changes
            if (isRunning) {
                const message = '🔴 CANCEL BUTTON: Showing cancel button 🔴';
                addLogMessage(message);
                vscode.postMessage({
                    command: 'logButtonState',
                    message: message
                });
            } else {
                const message = '🔴 CANCEL BUTTON: Hiding cancel button 🔴';
                addLogMessage(message);
                vscode.postMessage({
                    command: 'logButtonState',
                    message: message
                });
            }
        }
        
        // Refactor action buttons
        document.getElementById('countFiles').addEventListener('click', () => {
            const formData = saveRefactorFormData();
            formData.action = 'countFiles';
            
            setMigrationRunningState(true);
            
            vscode.postMessage({
                command: 'runRefactor',
                data: formData
            });
        });
        
        document.getElementById('migrateOneFile').addEventListener('click', () => {
            const formData = saveRefactorFormData();
            formData.action = 'migrateOneFile';
            formData.stopOption = 'afterEachFile';
            
            setMigrationRunningState(true);
            
            vscode.postMessage({
                command: 'runRefactor',
                data: formData
            });
        });
        
        document.getElementById('migrateAllFiles').addEventListener('click', () => {
            const formData = saveRefactorFormData();
            formData.action = 'migrateAllFiles';
            formData.stopOption = 'onlyWhenComplete';
            
            setMigrationRunningState(true);
            
            vscode.postMessage({
                command: 'runRefactor',
                data: formData
            });
        });
        
        // Stop migration button
        document.getElementById('stopMigration').addEventListener('click', () => {
            vscode.postMessage({
                command: 'stopMigration'
            });
            
            // Disable the stop button immediately to prevent multiple clicks
            document.getElementById('stopMigration').disabled = true;
        });
        
        // Add keyup event listeners to all text fields for immediate character-by-character saving
        const textInputs = ['compilerLinterCommand', 'testCommand', 'filePatterns', 'findPattern', 'replacePattern'];
        textInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            // Save on every keystroke
            element.addEventListener('keyup', saveRefactorFormData);
            // Also save on paste events
            element.addEventListener('paste', () => {
                // Use setTimeout to ensure the paste content is in the field
                setTimeout(saveRefactorFormData, 0);
            });
            // Save on cut events
            element.addEventListener('cut', () => {
                setTimeout(saveRefactorFormData, 0);
            });
        });
        
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'log':
                    addLogMessage(message.message);
                    break;
                case 'migrationComplete':
                    setMigrationRunningState(false);
                    break;
                case 'restoreLogs':
                    restoreLogs(message.logs);
                    break;
                case 'clearLogs':
                    document.getElementById('logContent').innerHTML = '';
                    break;
            }
        });
    </script>
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