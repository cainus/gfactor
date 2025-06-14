import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PatternOccurrence } from './types';
import { RefactorFormData } from '../migration/types';

/**
 * Generates HTML for the main sidebar webview
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
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor AI Migration Assistant - ${timestampContent}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        h2 {
            margin-top: 0;
            margin-bottom: 16px;
        }
        h3 {
            margin-top: 16px;
            margin-bottom: 8px;
        }
        .description {
            margin-bottom: 20px;
            font-size: 13px;
            line-height: 1.4;
        }
        button {
            display: block;
            width: 100%;
            padding: 8px 12px;
            margin-bottom: 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 13px;
            text-align: left;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .button-icon {
            margin-right: 8px;
        }
        .form-section {
            display: none;
            padding: 12px;
            margin-bottom: 16px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        #apiKeysForm {
            display: ${displayState.apiKeysForm ? 'block' : 'none'};
        }
        #refactorForm {
            padding: 12px;
            margin-bottom: 16px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .form-group {
            margin-bottom: 12px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            font-size: 12px;
        }
        input[type="text"], input[type="password"], textarea {
            width: 100%;
            padding: 6px;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            font-size: 12px;
        }
        textarea {
            min-height: 60px;
            resize: vertical;
        }
        .radio-group {
            margin-top: 5px;
        }
        .radio-option {
            margin-bottom: 5px;
            font-size: 12px;
        }
        .action-buttons {
            display: flex;
            flex-direction: column;
            margin-top: 16px;
            gap: 8px;
        }
        .action-buttons button {
            width: 100%;
            margin-bottom: 0;
            font-size: 13px;
            padding: 8px 12px;
            text-align: center;
        }
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .stop-button {
            background-color: var(--vscode-errorForeground, #f44336);
            color: white;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            margin-top: 8px;
            display: none;
        }
        .stop-button:hover {
            opacity: 0.9;
        }
        .stop-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .hidden {
            display: none !important;
        }
        .cancel-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .cancel-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .active-button {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div style="display: flex; align-items: center; margin-bottom: 16px;">
        <img src="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'gfactor-icon.png'))}" alt="GFactor Icon" width="32" height="32" style="margin-right: 12px;">
        <div>
            <h2 style="margin: 0;">GFactor AI Migration</h2>
            <div style="font-size: 12px; color: var(--vscode-descriptionForeground);">v${packageVersion} | ${timestampContent}</div>
        </div>
    </div>
    <div class="description">
        AI-powered code migration tool for large-scale refactoring. Migrate your codebase from one pattern to another with AI assistance.
    </div>
    
    <button id="configureApiKeys">
        <span class="button-icon">🔑</span> Configure API Keys
    </button>
    
    <div id="apiKeysForm" class="form-section">
        <h3>Configure API Key</h3>
        <div class="form-group">
            <label for="llmType">LLM:</label>
            <div class="radio-group">
                <div class="radio-option">
                    <input type="radio" id="claude" name="llmType" value="claude" checked>
                    <span>${hasClaudeKey ? '✓' : '✗'}</span>
                    <label for="claude">Anthropic Claude</label>
                </div>
            </div>
        </div>
        
        <div class="form-group">
            <label for="apiKey">API Key:</label>
            <input type="password" id="apiKey" name="apiKey" placeholder="Enter your API key" value="">
        </div>
        
        <div class="action-buttons">
            <button type="button" id="cancelApiKeys" class="cancel-button">Cancel</button>
            <button type="button" id="saveApiKeys">Save</button>
        </div>
    </div>
    
    <div id="refactorForm">
        <h3 style="margin-top: 0;">Code Migration</h3>
        <div class="form-group">
            <label for="compilerLinterCommand">How to run the compiler/linter:</label>
            <input type="text" id="compilerLinterCommand" name="compilerLinterCommand" placeholder="e.g., npm run lint" required value="${savedFormData?.compilerLinterCommand || ''}">
        </div>
        
        <div class="form-group">
            <label for="testCommand">How to run the tests:</label>
            <input type="text" id="testCommand" name="testCommand" placeholder="e.g., npm test" required value="${savedFormData?.testCommand || ''}">
        </div>
        
        <div class="form-group">
            <label for="filePatterns">What file patterns to investigate:</label>
            <input type="text" id="filePatterns" name="filePatterns" placeholder="e.g., src/**/*.ts" required value="${savedFormData?.filePatterns || ''}">
        </div>
        
        <div class="form-group">
            <label for="findPattern">How to find the pattern to migrate away from:</label>
            <textarea id="findPattern" name="findPattern" placeholder="Describe the pattern to find (can include code examples)" required>${savedFormData?.findPattern || ''}</textarea>
        </div>
        
        <div class="form-group">
            <label for="replacePattern">How to fix or replace the pattern:</label>
            <textarea id="replacePattern" name="replacePattern" placeholder="Describe how to fix or replace the pattern (can include code examples)" required>${savedFormData?.replacePattern || ''}</textarea>
        </div>
        
        <div class="action-buttons">
            <button type="button" id="countFiles" class="action-button">Count the files to migrate</button>
            <button type="button" id="migrateOneFile" class="action-button">Migrate 1 file</button>
            <button type="button" id="migrateAllFiles" class="action-button">Migrate all files</button>
            <button type="button" id="stopMigration" class="stop-button" disabled>Cancel Migration</button>
        </div>
    </div>
    
    
    <div id="logWindow" style="margin-top: 20px; border: 1px solid var(--vscode-panel-border); background-color: var(--vscode-editor-background); height: 200px; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0;">Log Output</h3>
            <div style="font-size: 12px; color: var(--vscode-descriptionForeground);">v${packageVersion} | ${timestampContent}</div>
        </div>
        <div id="logContent"></div>
    </div>

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
            stopButton.style.display = isRunning ? 'block' : 'none';
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
 * Generates HTML for the burndown chart
 */
export function getBurndownChartHtml(occurrences: PatternOccurrence[]): string {
    // Format data for the chart
    const chartData = occurrences.map((occurrence, index) => {
        return {
            index,
            timestamp: occurrence.timestamp.toLocaleTimeString(),
            count: occurrence.count,
            file: occurrence.file || 'Initial scan'
        };
    });
    
    // Calculate chart dimensions
    const chartWidth = 800;
    const chartHeight = 400;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 50;
    const graphWidth = chartWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;
    
    // Calculate scales
    const maxCount = Math.max(...occurrences.map(o => o.count));
    const yScale = graphHeight / maxCount;
    const xScale = graphWidth / (occurrences.length - 1 || 1);
    
    // Generate SVG path for the line
    let pathData = '';
    occurrences.forEach((occurrence, i) => {
        const x = paddingLeft + i * xScale;
        const y = paddingTop + graphHeight - (occurrence.count * yScale);
        if (i === 0) {
            pathData += `M ${x} ${y}`;
        } else {
            pathData += ` L ${x} ${y}`;
        }
    });
    
    // Generate HTML with embedded SVG chart
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor: Pattern Burndown Chart</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        h1 {
            margin-bottom: 20px;
        }
        .chart-container {
            margin-top: 20px;
        }
        .chart-svg {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
        }
        .axis-line {
            stroke: var(--vscode-panel-border);
            stroke-width: 1;
        }
        .chart-line {
            stroke: var(--vscode-charts-blue);
            stroke-width: 2;
            fill: none;
        }
        .chart-point {
            fill: var(--vscode-charts-blue);
        }
        .chart-label {
            font-size: 12px;
            fill: var(--vscode-foreground);
        }
        .axis-label {
            font-size: 14px;
            fill: var(--vscode-foreground);
            text-anchor: middle;
        }
        .data-table {
            margin-top: 30px;
            width: 100%;
            border-collapse: collapse;
        }
        .data-table th, .data-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .data-table th {
            background-color: var(--vscode-editor-background);
        }
    </style>
</head>
<body>
    <h1>Pattern Burndown Chart</h1>
    <p>This chart shows the number of old patterns remaining over time during the refactoring process.</p>
    
    <div class="chart-container">
        <svg class="chart-svg" width="${chartWidth}" height="${chartHeight}">
            <!-- Y-axis -->
            <line class="axis-line" x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + graphHeight}"></line>
            
            <!-- X-axis -->
            <line class="axis-line" x1="${paddingLeft}" y1="${paddingTop + graphHeight}" x2="${paddingLeft + graphWidth}" y2="${paddingTop + graphHeight}"></line>
            
            <!-- Y-axis labels -->
            ${Array.from({length: 5}, (_, i) => {
                const value = Math.round(maxCount * (4 - i) / 4);
                const y = paddingTop + i * (graphHeight / 4);
                return `<text class="chart-label" x="${paddingLeft - 10}" y="${y + 5}" text-anchor="end">${value}</text>`;
            }).join('\n            ')}
            
            <!-- X-axis labels -->
            ${occurrences.map((_, i) => {
                const x = paddingLeft + i * xScale;
                return `<text class="chart-label" x="${x}" y="${paddingTop + graphHeight + 20}" text-anchor="middle">${i + 1}</text>`;
            }).join('\n            ')}
            
            <!-- Chart line -->
            <path class="chart-line" d="${pathData}"></path>
            
            <!-- Data points -->
            ${occurrences.map((occurrence, i) => {
                const x = paddingLeft + i * xScale;
                const y = paddingTop + graphHeight - (occurrence.count * yScale);
                return `<circle class="chart-point" cx="${x}" cy="${y}" r="4"></circle>`;
            }).join('\n            ')}
            
            <!-- Axis labels -->
            <text class="axis-label" x="${paddingLeft - 35}" y="${paddingTop + graphHeight / 2}" transform="rotate(-90, ${paddingLeft - 35}, ${paddingTop + graphHeight / 2})">Patterns Remaining</text>
            <text class="axis-label" x="${paddingLeft + graphWidth / 2}" y="${paddingTop + graphHeight + 40}">Steps</text>
        </svg>
    </div>
    
    <h2>Data Points</h2>
    <table class="data-table">
        <thead>
            <tr>
                <th>Step</th>
                <th>Time</th>
                <th>File</th>
                <th>Patterns Remaining</th>
            </tr>
        </thead>
        <tbody>
            ${chartData.map(data => `
            <tr>
                <td>${data.index + 1}</td>
                <td>${data.timestamp}</td>
                <td>${data.file}</td>
                <td>${data.count}</td>
            </tr>`).join('')}
        </tbody>
    </table>
</body>
</html>`;
}