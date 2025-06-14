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
        
        // Function to check if a string is valid JSON
        function isJsonString(str) {
            try {
                // Check if the string has a prefix like "🤖 CLAUDE JSON:"
                let jsonStr = str;
                if (str.includes('🤖 CLAUDE JSON:')) {
                    jsonStr = str.split('🤖 CLAUDE JSON:')[1].trim();
                }
                
                JSON.parse(jsonStr);
                return true;
            } catch {
                return false;
            }
        }
        
        // Function to check if a string is an assistant message
        function isAssistantMessage(str) {
            try {
                // Check if the string has a prefix like "🤖 CLAUDE JSON:"
                let jsonStr = str;
                if (str.includes('🤖 CLAUDE JSON:')) {
                    jsonStr = str.split('🤖 CLAUDE JSON:')[1].trim();
                    console.log('Found Claude JSON prefix, extracting JSON part');
                }
                
                const data = JSON.parse(jsonStr);
                // Add a debug log to see what messages are being processed
                console.log('Checking if message is assistant message:', data.type, !!data.message);
                return data.type === 'assistant' && data.message;
            } catch (e) {
                console.log('Error parsing assistant message:', e);
                return false;
            }
        }
        
        // Function to add log messages to the log window
        function addLogMessage(message) {
            const logContent = document.getElementById('logContent');
            const logEntry = document.createElement('div');
            
            // Check if the message is an assistant message
            if (isAssistantMessage(message)) {
                console.log('Formatting assistant message');
                try {
                    // Create a custom formatted assistant message
                    const assistantDiv = document.createElement('div');
                    assistantDiv.style.backgroundColor = 'var(--vscode-editor-background)';
                    assistantDiv.style.border = '1px solid var(--vscode-panel-border)';
                    assistantDiv.style.borderRadius = '3px';
                    assistantDiv.style.padding = '10px';
                    assistantDiv.style.margin = '4px 0';
                    assistantDiv.style.fontFamily = 'var(--vscode-font-family)';
                    assistantDiv.style.fontSize = '12px';
                    
                    // Extract JSON part if there's a prefix
                    let jsonStr = message;
                    if (message.includes('🤖 CLAUDE JSON:')) {
                        jsonStr = message.split('🤖 CLAUDE JSON:')[1].trim();
                    }
                    
                    const data = JSON.parse(jsonStr);
                    const assistantMessage = data.message;
                    
                    // Header
                    const header = document.createElement('div');
                    header.style.display = 'flex';
                    header.style.justifyContent = 'space-between';
                    header.style.borderBottom = '1px solid var(--vscode-panel-border)';
                    header.style.paddingBottom = '6px';
                    header.style.marginBottom = '6px';
                    
                    const title = document.createElement('span');
                    title.style.fontWeight = 'bold';
                    title.style.color = 'var(--vscode-charts-blue)';
                    title.textContent = 'Assistant Message';
                    
                    const id = document.createElement('span');
                    id.style.color = 'var(--vscode-descriptionForeground)';
                    id.style.fontSize = '11px';
                    id.textContent = assistantMessage.id;
                    
                    header.appendChild(title);
                    header.appendChild(id);
                    assistantDiv.appendChild(header);
                    
                    // Model
                    if (assistantMessage.model) {
                        const modelDiv = document.createElement('div');
                        modelDiv.style.marginBottom = '6px';
                        
                        const modelLabel = document.createElement('span');
                        modelLabel.style.fontWeight = 'bold';
                        modelLabel.textContent = 'Model: ';
                        
                        const modelValue = document.createElement('span');
                        modelValue.textContent = assistantMessage.model;
                        
                        modelDiv.appendChild(modelLabel);
                        modelDiv.appendChild(modelValue);
                        assistantDiv.appendChild(modelDiv);
                    }
                    
                    // Content
                    if (assistantMessage.content && assistantMessage.content.length > 0) {
                        const contentDiv = document.createElement('div');
                        contentDiv.style.marginBottom = '6px';
                        
                        const contentLabel = document.createElement('div');
                        contentLabel.style.fontWeight = 'bold';
                        contentLabel.style.marginBottom = '3px';
                        contentLabel.textContent = 'Content:';
                        contentDiv.appendChild(contentLabel);
                        
                        assistantMessage.content.forEach(item => {
                            const itemDiv = document.createElement('div');
                            itemDiv.style.marginLeft = '10px';
                            itemDiv.style.marginBottom = '3px';
                            
                            if (item.type === 'tool_use') {
                                const toolDiv = document.createElement('div');
                                toolDiv.textContent = 'Tool: ' + (item.name || '');
                                itemDiv.appendChild(toolDiv);
                                
                                if (item.input) {
                                    const inputDiv = document.createElement('div');
                                    inputDiv.style.marginLeft = '10px';
                                    inputDiv.style.borderLeft = '2px solid var(--vscode-panel-border)';
                                    inputDiv.style.paddingLeft = '8px';
                                    
                                    if (item.input.command) {
                                        const commandDiv = document.createElement('div');
                                        
                                        const commandLabel = document.createElement('span');
                                        commandLabel.style.fontStyle = 'italic';
                                        commandLabel.textContent = 'Command: ';
                                        
                                        const commandCode = document.createElement('code');
                                        commandCode.textContent = item.input.command;
                                        
                                        commandDiv.appendChild(commandLabel);
                                        commandDiv.appendChild(commandCode);
                                        inputDiv.appendChild(commandDiv);
                                    }
                                    
                                    if (item.input.description) {
                                        const descDiv = document.createElement('div');
                                        
                                        const descLabel = document.createElement('span');
                                        descLabel.style.fontStyle = 'italic';
                                        descLabel.textContent = 'Description: ';
                                        
                                        const descValue = document.createElement('span');
                                        descValue.textContent = item.input.description;
                                        
                                        descDiv.appendChild(descLabel);
                                        descDiv.appendChild(descValue);
                                        inputDiv.appendChild(descDiv);
                                    }
                                    
                                    itemDiv.appendChild(inputDiv);
                                }
                            } else {
                                itemDiv.textContent = JSON.stringify(item);
                            }
                            
                            contentDiv.appendChild(itemDiv);
                        });
                        
                        assistantDiv.appendChild(contentDiv);
                    }
                    
                    // Stop reason
                    if (assistantMessage.stop_reason) {
                        const stopDiv = document.createElement('div');
                        stopDiv.style.marginBottom = '6px';
                        
                        const stopLabel = document.createElement('span');
                        stopLabel.style.fontWeight = 'bold';
                        stopLabel.textContent = 'Stop Reason: ';
                        
                        const stopValue = document.createElement('span');
                        stopValue.textContent = assistantMessage.stop_reason;
                        
                        stopDiv.appendChild(stopLabel);
                        stopDiv.appendChild(stopValue);
                        assistantDiv.appendChild(stopDiv);
                    }
                    
                    // Usage
                    if (assistantMessage.usage) {
                        const usageDiv = document.createElement('div');
                        usageDiv.style.fontSize = '11px';
                        usageDiv.style.color = 'var(--vscode-descriptionForeground)';
                        usageDiv.style.borderTop = '1px solid var(--vscode-panel-border)';
                        usageDiv.style.paddingTop = '6px';
                        
                        const usageLabel = document.createElement('div');
                        usageLabel.style.fontWeight = 'bold';
                        usageLabel.style.marginBottom = '3px';
                        usageLabel.textContent = 'Usage:';
                        usageDiv.appendChild(usageLabel);
                        
                        const usageDetails = document.createElement('div');
                        usageDetails.style.display = 'flex';
                        usageDetails.style.flexWrap = 'wrap';
                        
                        Object.entries(assistantMessage.usage).forEach(([key, value]) => {
                            const usageItem = document.createElement('div');
                            usageItem.style.marginRight = '12px';
                            usageItem.textContent = key + ': ' + value;
                            usageDetails.appendChild(usageItem);
                        });
                        
                        usageDiv.appendChild(usageDetails);
                        assistantDiv.appendChild(usageDiv);
                    }
                    
                    // Session ID
                    if (data.session_id) {
                        const sessionDiv = document.createElement('div');
                        sessionDiv.style.fontSize = '10px';
                        sessionDiv.style.color = 'var(--vscode-descriptionForeground)';
                        sessionDiv.style.marginTop = '6px';
                        sessionDiv.textContent = 'Session: ' + data.session_id;
                        assistantDiv.appendChild(sessionDiv);
                    }
                    
                    logEntry.appendChild(assistantDiv);
                } catch {
                    // If formatting fails, fall back to JSON formatting
                    try {
                        const jsonData = JSON.parse(message);
                        const pre = document.createElement('pre');
                        pre.style.backgroundColor = 'var(--vscode-editor-background)';
                        pre.style.border = '1px solid var(--vscode-panel-border)';
                        pre.style.borderRadius = '3px';
                        pre.style.padding = '8px';
                        pre.style.overflow = 'auto';
                        pre.style.fontSize = '12px';
                        pre.style.fontFamily = 'monospace';
                        pre.style.margin = '4px 0';
                        pre.textContent = JSON.stringify(jsonData, null, 2);
                        logEntry.appendChild(pre);
                    } catch {
                        // If JSON formatting fails, fall back to paragraph
                        const p = document.createElement('p');
                        p.style.margin = '4px 0';
                        p.textContent = message;
                        logEntry.appendChild(p);
                    }
                }
            }
            // Check if the message is JSON (but not an assistant message)
            else if (isJsonString(message)) {
                // Format JSON nicely
                try {
                    // Extract JSON part if there's a prefix
                    let jsonStr = message;
                    if (message.includes('🤖 CLAUDE JSON:')) {
                        jsonStr = message.split('🤖 CLAUDE JSON:')[1].trim();
                    }
                    
                    const jsonData = JSON.parse(jsonStr);
                    const pre = document.createElement('pre');
                    pre.style.backgroundColor = 'var(--vscode-editor-background)';
                    pre.style.border = '1px solid var(--vscode-panel-border)';
                    pre.style.borderRadius = '3px';
                    pre.style.padding = '8px';
                    pre.style.overflow = 'auto';
                    pre.style.fontSize = '12px';
                    pre.style.fontFamily = 'monospace';
                    pre.style.margin = '4px 0';
                    pre.textContent = JSON.stringify(jsonData, null, 2);
                    logEntry.appendChild(pre);
                } catch {
                    // If formatting fails, fall back to paragraph
                    const p = document.createElement('p');
                    p.style.margin = '4px 0';
                    p.textContent = message;
                    logEntry.appendChild(p);
                }
            } else {
                // Use paragraph for non-JSON messages
                const p = document.createElement('p');
                p.style.margin = '4px 0';
                p.textContent = message;
                logEntry.appendChild(p);
            }
            
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
                // Use the same addLogMessage function to ensure consistent formatting
                addLogMessage(message);
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