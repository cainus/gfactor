import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as childProcess from 'child_process';
import * as MarkdownIt from 'markdown-it';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Anthropic } from '@anthropic-ai/sdk';

// Interfaces
interface RefactorFormData {
    compilerLinterCommand: string;
    testCommand: string;
    filePatterns: string;
    findPattern: string;
    replacePattern: string;
    stopOption: 'afterEachFix' | 'afterEachFile' | 'onlyWhenComplete' | 'custom';
    action?: 'countFiles' | 'migrateOneFile' | 'migrateAllFiles';
}

interface LlmConfig {
    type: 'gemini' | 'claude';
    apiKey: string;
}

// Interface for pattern tracking
interface PatternOccurrence {
    timestamp: Date;
    count: number;
    file?: string;
}

// Global state to track pattern occurrences
let patternOccurrences: PatternOccurrence[] = [];

// Output channel for logging
let outputChannel: vscode.OutputChannel;

// Cancellation token source for stopping migrations
let migrationCancellationTokenSource: vscode.CancellationTokenSource | undefined;

// Storage keys
const FORM_DATA_STORAGE_KEY = 'gfactor.formData';
const FORM_DISPLAY_STATE_KEY = 'gfactor.formDisplayState';

// Global variables
let extensionContext: vscode.ExtensionContext;
let sidebarWebview: vscode.Webview | undefined;

// Sidebar webview provider
class GFactorSidebarProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Store the webview reference for logging
        sidebarWebview = webviewView.webview;
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveFormData': {
                    // Save form data to global state
                    const context = getExtensionContext();
                    context.globalState.update(FORM_DATA_STORAGE_KEY, message.data);
                    console.log('Form data saved in real-time:', message.data);
                    break;
                }
                case 'saveDisplayState': {
                    // Save form display state to global state
                    const context = getExtensionContext();
                    context.globalState.update(FORM_DISPLAY_STATE_KEY, message.data);
                    console.log('Form display state saved:', message.data);
                    break;
                }
                case 'saveApiKeys': {
                    await saveApiKeys(message.data.llmType, message.data.apiKey);
                    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                    break;
                }
                case 'runRefactor': {
                    await runRefactorWithData(message.data);
                    break;
                }
                case 'stopMigration': {
                    stopMigration();
                    break;
                }
                case 'showBurndownChart': {
                    vscode.commands.executeCommand('gfactor.showBurndownChart');
                    break;
                }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get saved form data and display state if available
        const context = getExtensionContext();
        const savedFormData = context.globalState.get<RefactorFormData | undefined>(FORM_DATA_STORAGE_KEY);
        const displayState = context.globalState.get<{apiKeysForm: boolean}>(FORM_DISPLAY_STATE_KEY) ||
            { apiKeysForm: false };
        
        // Get API key information
        const config = vscode.workspace.getConfiguration('gfactor');
        // Get API key information for display purposes
        const hasGeminiKey = !!config.get<string>('geminiApiKey');
        const hasClaudeKey = !!config.get<string>('claudeApiKey');
        const preferredLlm = config.get<string>('preferredLlm') || 'gemini';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor AI Migration Assistant</title>
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
        <img src="${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'gfactor-icon.png'))}" alt="GFactor Icon" width="32" height="32" style="margin-right: 12px;">
        <h2 style="margin: 0;">GFactor AI Migration</h2>
    </div>
    <div class="description">
        AI-powered code migration tool for large-scale refactoring. Migrate your codebase from one pattern to another with AI assistance.
    </div>
    
    <button id="configureApiKeys">
        <span class="button-icon">🔑</span> Configure API Keys
    </button>
    
    <div id="apiKeysForm" class="form-section">
        <h3>Configure API Keys</h3>
        <div class="form-group">
            <label for="llmType">Select LLM:</label>
            <div class="radio-group">
                <div class="radio-option">
                    <input type="radio" id="gemini" name="llmType" value="gemini" ${preferredLlm === 'gemini' ? 'checked' : ''}>
                    <span>${hasGeminiKey ? '✓' : '✗'}</span>
                    <label for="gemini">Google Gemini</label>
                </div>
                <div class="radio-option">
                    <input type="radio" id="claude" name="llmType" value="claude" ${preferredLlm === 'claude' ? 'checked' : ''}>
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
            <button type="button" id="stopMigration" class="stop-button" disabled>Stop Migration</button>
        </div>
    </div>
    
    
    <div id="logWindow" style="margin-top: 20px; border: 1px solid var(--vscode-panel-border); background-color: var(--vscode-editor-background); height: 200px; overflow-y: auto; padding: 10px; font-family: monospace; font-size: 12px;">
        <h3 style="margin-top: 0; margin-bottom: 10px;">Log Output</h3>
        <div id="logContent"></div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Function to add log messages to the log window
        function addLogMessage(message) {
            const logContent = document.getElementById('logContent');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.textContent = '[' + timestamp + '] ' + message;
            logContent.appendChild(logEntry);
            
            // Auto-scroll to bottom
            const logWindow = document.getElementById('logWindow');
            logWindow.scrollTop = logWindow.scrollHeight;
        }
        
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
            const llmType = document.querySelector('input[name="llmType"]:checked').value;
            const apiKey = document.getElementById('apiKey').value;
            
            vscode.postMessage({
                command: 'saveApiKeys',
                data: { llmType, apiKey }
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
            
            // Enable/disable action buttons
            actionButtons.forEach(id => {
                document.getElementById(id).disabled = isRunning;
            });
            
            // Show/hide and enable/disable stop button
            stopButton.style.display = isRunning ? 'block' : 'none';
            stopButton.disabled = !isRunning;
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
            }
        });
    </script>
</body>
</html>`;
    }
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext): void {
    console.log('GFactor extension is now active');
    
    // Store context for use in other functions
    extensionContext = context;
    
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('GFactor');
    outputChannel.appendLine('GFactor extension activated');
    
    // Make sure the output channel is visible and focused
    vscode.commands.executeCommand('workbench.action.output.show').then(() => {
        vscode.commands.executeCommand('workbench.action.focusPanel');
        // Select the GFactor output channel
        vscode.commands.executeCommand('workbench.output.action.switchBetweenOutputs', 'GFactor');
        outputChannel.show(true);
    });

    // Register the commands - just focus the sidebar view
    const startRefactorCommand = vscode.commands.registerCommand('gfactor.startRefactor', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.gfactor-sidebar');
    });

    const configureApiKeysCommand = vscode.commands.registerCommand('gfactor.configureApiKeys', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.gfactor-sidebar');
    });

    const showBurndownChartCommand = vscode.commands.registerCommand('gfactor.showBurndownChart', () => {
        showBurndownChart();
    });

    context.subscriptions.push(startRefactorCommand, configureApiKeysCommand, showBurndownChartCommand);

    // Register the sidebar webview provider
    const sidebarProvider = new GFactorSidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('gfactorView', sidebarProvider)
    );

    // Check if API keys are configured on startup
    checkApiKeyConfiguration(context);
}

// This method is called when your extension is deactivated
export function deactivate(): void {}

// Check if API keys are configured
async function checkApiKeyConfiguration(_context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('gfactor');
    const geminiApiKey = config.get<string>('geminiApiKey');
    const claudeApiKey = config.get<string>('claudeApiKey');

    if (!geminiApiKey && !claudeApiKey) {
        const configureNow = 'Configure Now';
        const response = await vscode.window.showInformationMessage(
            'GFactor requires API keys for Gemini or Claude to function. Would you like to configure them now?',
            configureNow
        );

        if (response === configureNow) {
            // Show the sidebar view instead
            vscode.commands.executeCommand('workbench.view.extension.gfactor-sidebar');
        }
    }
}

// Configure API keys
async function saveApiKeys(llmType: string, apiKey: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('gfactor');
    
    // Save API key to configuration
    if (llmType === 'gemini') {
        await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
        await config.update('preferredLlm', 'gemini', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Gemini API key configured successfully!');
    } else {
        await config.update('claudeApiKey', apiKey, vscode.ConfigurationTarget.Global);
        await config.update('preferredLlm', 'claude', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Claude API key configured successfully!');
    }
}


// Function to stop an ongoing migration
function stopMigration(): void {
    if (migrationCancellationTokenSource) {
        logMessage('Migration stopped by user');
        migrationCancellationTokenSource.cancel();
        migrationCancellationTokenSource.dispose();
        migrationCancellationTokenSource = undefined;
        
        // Notify the webview that migration is complete
        if (sidebarWebview) {
            sidebarWebview.postMessage({
                command: 'migrationComplete'
            });
        }
        
        vscode.window.showInformationMessage('Migration stopped');
    }
}

// Run refactoring with provided form data
async function runRefactorWithData(formData: RefactorFormData): Promise<void> {
    try {
        // Check if we have a workspace folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('GFactor requires an open workspace folder to function.');
            return;
        }

        // Check if API keys are configured
        const config = vscode.workspace.getConfiguration('gfactor');
        const geminiApiKey = config.get<string>('geminiApiKey');
        const claudeApiKey = config.get<string>('claudeApiKey');
        const preferredLlm = config.get<string>('preferredLlm');

        if (!geminiApiKey && !claudeApiKey) {
            vscode.window.showErrorMessage('GFactor requires API keys for Gemini or Claude to function. Please configure them first.');
            return;
        }

        // Determine which LLM to use
        let llmConfig: LlmConfig;
        if (preferredLlm === 'gemini' && geminiApiKey) {
            llmConfig = { type: 'gemini', apiKey: geminiApiKey };
        } else if (preferredLlm === 'claude' && claudeApiKey) {
            llmConfig = { type: 'claude', apiKey: claudeApiKey };
        } else if (geminiApiKey) {
            llmConfig = { type: 'gemini', apiKey: geminiApiKey };
        } else {
            llmConfig = { type: 'claude', apiKey: claudeApiKey! };
        }

        // Create a new cancellation token source
        if (migrationCancellationTokenSource) {
            migrationCancellationTokenSource.dispose();
        }
        migrationCancellationTokenSource = new vscode.CancellationTokenSource();

        // Collect context from .mdc files
        const mdcContext = await collectMdcContext();

        // Handle different actions based on button clicked
        try {
            switch (formData.action) {
                case 'countFiles':
                    await countFilesToMigrate(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    break;
                case 'migrateOneFile':
                    // Set to process just one file
                    formData.stopOption = 'afterEachFile';
                    await performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    break;
                case 'migrateAllFiles':
                    // Set to process all files
                    formData.stopOption = 'onlyWhenComplete';
                    await performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    break;
                default:
                    // Fallback to normal refactoring
                    await performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
            }
        } finally {
            // Notify the webview that migration is complete
            if (sidebarWebview) {
                sidebarWebview.postMessage({
                    command: 'migrationComplete'
                });
            }
            
            // Clean up the cancellation token source
            if (migrationCancellationTokenSource) {
                migrationCancellationTokenSource.dispose();
                migrationCancellationTokenSource = undefined;
            }
        }
    } catch (error) {
        logMessage(`Error in runRefactorWithData: ${error}`);
        
        // Ensure UI is reset even if there's an error
        if (sidebarWebview) {
            sidebarWebview.postMessage({
                command: 'migrationComplete'
            });
        }
    }
}

// Count files that need migration without making changes
async function countFilesToMigrate(
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
                    const patternCount = await countPatternOccurrences(
                        content,
                        formData.findPattern,
                        file,
                        llmConfig,
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

// Note: The standalone refactoring form is no longer used as it's now integrated in the sidebar

// Get the extension context
function getExtensionContext(): vscode.ExtensionContext {
    if (!extensionContext) {
        throw new Error('Extension context not initialized');
    }
    return extensionContext;
}

// Log message to console, output channel, and webview
function logMessage(message: string): void {
    console.log(message);
    
    // Log to output channel
    if (outputChannel) {
        const timestamp = new Date().toLocaleTimeString();
        outputChannel.appendLine(`[${timestamp}] ${message}`);
    }
    
    // Log to webview if available
    if (sidebarWebview) {
        sidebarWebview.postMessage({
            command: 'log',
            message: message
        });
    }
}

// Get the HTML for the refactoring form
// Note: The standalone refactoring form HTML is no longer used as it's now integrated in the sidebar

// Collect context from .mdc files
async function collectMdcContext(): Promise<string> {
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

// Run a command and return the result
async function runCommand(command: string, cwd: string): Promise<{ success: boolean; output: string }> {
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

// Process the file content with the LLM
async function processWithLlm(
    content: string,
    filePath: string,
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string
): Promise<string | null> {
    try {
        // Prepare the prompt for the LLM
        const prompt = `
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

        // Process with the appropriate LLM
        if (llmConfig.type === 'gemini') {
            return await processWithGemini(prompt, llmConfig.apiKey);
        } else {
            return await processWithClaude(prompt, llmConfig.apiKey);
        }
    } catch (error) {
        const errorMessage = `Error processing with LLM: ${error}`;
        logMessage(errorMessage);
        console.error('Error processing with LLM:', error);
        vscode.window.showErrorMessage(errorMessage);
        return null;
    }
}

// Process with Google's Gemini
async function processWithGemini(prompt: string, apiKey: string): Promise<string | null> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        logMessage(`Error with Gemini API: ${error}`);
        console.error('Error with Gemini API:', error);
        throw error;
    }
}

// Process with Anthropic's Claude
async function processWithClaude(prompt: string, apiKey: string): Promise<string | null> {
    try {
        const anthropic = new Anthropic({
            apiKey: apiKey
        });
        
        const message = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 4000,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });
        
        if (message.content[0].type === 'text') {
            return message.content[0].text;
        }
        return null;
    } catch (error) {
        logMessage(`Error with Claude API: ${error}`);
        console.error('Error with Claude API:', error);
        throw error;
    }
}

// Perform the refactoring process
async function performRefactoring(
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string,
    cancellationToken: vscode.CancellationToken
): Promise<void> {
    // Reset pattern occurrences for new refactoring session
    patternOccurrences = [];
    
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
                
                // Count initial pattern occurrences across all files
                logMessage('Scanning files for initial pattern count...');
                let totalInitialPatternCount = 0;
                for (const file of files) {
                    const filePath = path.join(workspaceRoot, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const patternCount = await countPatternOccurrences(
                        content,
                        formData.findPattern,
                        file,
                        llmConfig,
                        mdcContext
                    );
                    if (patternCount > 0) {
                        logMessage(`Found ${patternCount} pattern occurrences in ${file}`);
                    }
                    totalInitialPatternCount += patternCount;
                }
                
                // Record initial pattern count
                if (totalInitialPatternCount > 0) {
                    logMessage(`Total initial pattern count: ${totalInitialPatternCount}`);
                    patternOccurrences.push({
                        timestamp: new Date(),
                        count: totalInitialPatternCount
                    });
                } else {
                    logMessage('No patterns found in any files.');
                }
                
                // For migrateOneFile action, find the first file with patterns
                let filesToProcess = files;
                if (formData.action === 'migrateOneFile') {
                    logMessage('Looking for the first file with patterns to migrate...');
                    
                    // Find the first file with patterns
                    for (const file of files) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        
                        const filePath = path.join(workspaceRoot, file);
                        const content = fs.readFileSync(filePath, 'utf8');
                        
                        // Count pattern occurrences in this file
                        const patternCount = await countPatternOccurrences(
                            content,
                            formData.findPattern,
                            file,
                            llmConfig,
                            mdcContext
                        );
                        
                        if (patternCount > 0) {
                            // Found a file with patterns, process only this one
                            filesToProcess = [file];
                            logMessage(`Found file with patterns: ${file} (${patternCount} occurrences)`);
                            break;
                        }
                    }
                    
                    if (filesToProcess.length === files.length) {
                        logMessage('No files with patterns found to migrate.');
                        vscode.window.showInformationMessage('No files with patterns found to migrate.');
                        return;
                    }
                }
                
                // Process each file
                for (let i = 0; i < filesToProcess.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const file = filesToProcess[i];
                    const filePath = path.join(workspaceRoot, file);
                    
                    logMessage(`Processing file ${i + 1}/${filesToProcess.length}: ${file}`);
                    progress.report({
                        message: `Processing file ${i + 1}/${filesToProcess.length}: ${file}`,
                        increment: (1 / filesToProcess.length) * 100
                    });
                    
                    // Read file content
                    logMessage(`Reading file content: ${file}`);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Count pattern occurrences in this file
                    const initialPatternCount = await countPatternOccurrences(
                        content,
                        formData.findPattern,
                        file,
                        llmConfig,
                        mdcContext
                    );
                    logMessage(`Found ${initialPatternCount} pattern occurrences in ${file}`);
                    
                    // Skip if no patterns found
                    if (initialPatternCount === 0) {
                        logMessage(`Skipping file ${file} - no patterns found`);
                        continue;
                    }
                    
                    // Process the file with the LLM
                    logMessage(`Processing ${file} with ${llmConfig.type} LLM...`);
                    const updatedContent = await processWithLlm(
                        content,
                        file,
                        formData,
                        llmConfig,
                        mdcContext
                    );
                    
                    if (!updatedContent) {
                        logMessage(`LLM processing failed for ${file}`);
                        continue;
                    }
                    
                    if (updatedContent === content) {
                        logMessage(`No changes made by LLM for ${file}`);
                        continue;
                    }
                    
                    // Count remaining patterns after refactoring
                    const remainingPatternCount = await countPatternOccurrences(
                        updatedContent,
                        formData.findPattern,
                        file,
                        llmConfig,
                        mdcContext
                    );
                    const patternsFixed = initialPatternCount - remainingPatternCount;
                    logMessage(`LLM fixed ${patternsFixed} pattern occurrences in ${file}`);
                    
                    // Write the updated content back to the file
                    logMessage(`Writing updated content to ${file}`);
                    fs.writeFileSync(filePath, updatedContent, 'utf8');
                    
                    // Run compiler/linter
                    logMessage(`Running linter: ${formData.compilerLinterCommand}`);
                    const linterResult = await runCommand(formData.compilerLinterCommand, workspaceRoot);
                    if (!linterResult.success) {
                        logMessage(`Linter failed for ${file}. Reverting changes.`);
                        // If linter fails, revert the change
                        fs.writeFileSync(filePath, content, 'utf8');
                        
                        if (formData.stopOption === 'afterEachFix' || formData.stopOption === 'afterEachFile') {
                            const tryAgain = await vscode.window.showErrorMessage(
                                `Linter failed for file ${file}. Changes have been reverted.`,
                                'Try Again',
                                'Skip File',
                                'Stop Migration'
                            );
                            
                            if (tryAgain === 'Try Again') {
                                i--; // Process the same file again
                                continue;
                            } else if (tryAgain === 'Stop Migration') {
                                break;
                            }
                            // If 'Skip File', continue to the next file
                        }
                        
                        continue;
                    }
                    
                    // Run tests
                    logMessage(`Running tests: ${formData.testCommand}`);
                    const testResult = await runCommand(formData.testCommand, workspaceRoot);
                    if (!testResult.success) {
                        logMessage(`Tests failed for ${file}. Reverting changes.`);
                        // If tests fail, revert the change
                        fs.writeFileSync(filePath, content, 'utf8');
                        
                        if (formData.stopOption === 'afterEachFix' || formData.stopOption === 'afterEachFile') {
                            const tryAgain = await vscode.window.showErrorMessage(
                                `Tests failed for file ${file}. Changes have been reverted.`,
                                'Try Again',
                                'Skip File',
                                'Stop Migration'
                            );
                            
                            if (tryAgain === 'Try Again') {
                                i--; // Process the same file again
                                continue;
                            } else if (tryAgain === 'Stop Migration') {
                                break;
                            }
                            // If 'Skip File', continue to the next file
                        }
                        
                        continue;
                    }
                    
                    logMessage(`Tests passed for ${file}`);
                    
                    // Record successful pattern fixes
                    if (patternsFixed > 0) {
                        logMessage(`Successfully fixed ${patternsFixed} pattern occurrences in ${file}`);
                        // Get current total count
                        const currentTotal = patternOccurrences.length > 0
                            ? patternOccurrences[patternOccurrences.length - 1].count
                            : totalInitialPatternCount;
                        
                        patternOccurrences.push({
                            timestamp: new Date(),
                            count: currentTotal - patternsFixed,
                            file: file
                        });
                    }
                    
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

// Count pattern occurrences in content using LLM
async function countPatternOccurrences(
    content: string,
    findPattern: string,
    filePath: string,
    llmConfig: LlmConfig,
    mdcContext: string
): Promise<number> {
    logMessage(`Using LLM to count pattern occurrences in ${filePath}`);
    
    // Prepare the prompt for the LLM
    const prompt = `
You are an expert code analyzer. Your task is to count how many instances of a specific pattern exist in the code.

# Context from .mdc files:
${mdcContext || 'No .mdc files found in the project.'}

# File to analyze:
${filePath}

# Current content:
\`\`\`
${content}
\`\`\`

# Pattern to find:
${findPattern}

Please analyze the code and count how many instances of the specified pattern exist.
Return ONLY a single number representing the count, with no additional text or explanation.
`;

    try {
        // Process with the appropriate LLM
        let countText: string | null;
        if (llmConfig.type === 'gemini') {
            countText = await processWithGemini(prompt, llmConfig.apiKey);
        } else {
            countText = await processWithClaude(prompt, llmConfig.apiKey);
        }
        
        // Parse the result to get the count
        if (countText) {
            const count = parseInt(countText.trim(), 10);
            if (!isNaN(count)) {
                logMessage(`LLM found ${count} pattern occurrences in ${filePath}`);
                return count;
            }
        }
        
        logMessage(`Failed to get valid count from LLM for ${filePath}, defaulting to 0`);
        return 0;
    } catch (error) {
        logMessage(`Error counting patterns with LLM: ${error}`);
        return 0;
    }
}

// Show burndown chart
async function showBurndownChart(): Promise<void> {
    logMessage('Generating burndown chart...');
    
    // If no data, show a message
    if (patternOccurrences.length === 0) {
        const message = 'No pattern occurrence data available. Run a refactoring first.';
        logMessage(message);
        vscode.window.showInformationMessage(message);
        return;
    }
    
    logMessage(`Creating burndown chart with ${patternOccurrences.length} data points`);
    
    // Create a webview panel for the chart
    const panel = vscode.window.createWebviewPanel(
        'gfactorBurndownChart',
        'GFactor: Pattern Burndown Chart',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );
    
    // Set the HTML content for the chart
    panel.webview.html = getBurndownChartHtml(patternOccurrences);
    logMessage('Burndown chart displayed');
}

// Get HTML for burndown chart
function getBurndownChartHtml(occurrences: PatternOccurrence[]): string {
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