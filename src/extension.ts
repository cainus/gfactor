import * as vscode from 'vscode';
import { PatternOccurrence } from './utils/types';
import { logMessage, initializeLogging, setSidebarWebview, clearLogs } from './utils/logging';
import { collectMdcContext } from './utils/file-utils';
import { saveApiKeys, getLlmConfig } from './utils/config-manager';
import { MigrationService } from './migration/migration-service';
import { RefactorFormData } from './migration/types';

// Cancellation token source for stopping migrations
let migrationCancellationTokenSource: vscode.CancellationTokenSource | undefined;

// Storage keys
const FORM_DATA_STORAGE_KEY = 'gfactor.formData';
const FORM_DISPLAY_STATE_KEY = 'gfactor.formDisplayState';
const LOG_STORAGE_KEY = 'gfactor.logs';

// Store logs in memory for persistence
let logMessages: string[] = [];

// Global variables
let extensionContext: vscode.ExtensionContext;
let sidebarWebview: vscode.Webview | undefined;
let migrationService: MigrationService;

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
        setSidebarWebview(webviewView.webview);
        
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
                case 'logButtonState': {
                    // Log button state changes to the output channel
                    logMessage(message.message);
                    break;
                }
                case 'persistLog': {
                    // Persist log message to extension context
                    logMessages.push(message.message);
                    const extContext = getExtensionContext();
                    extContext.globalState.update(LOG_STORAGE_KEY, logMessages);
                    break;
                }
                case 'requestLogs': {
                    // Send saved logs to the webview
                    webviewView.webview.postMessage({
                        command: 'restoreLogs',
                        logs: logMessages
                    });
                    break;
                }
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get saved form data, display state, and logs if available
        const context = getExtensionContext();
        const savedFormData = context.globalState.get<RefactorFormData | undefined>(FORM_DATA_STORAGE_KEY);
        const displayState = context.globalState.get<{apiKeysForm: boolean}>(FORM_DISPLAY_STATE_KEY) ||
            { apiKeysForm: false };
        
        // Get saved logs
        logMessages = context.globalState.get<string[]>(LOG_STORAGE_KEY) || [];
        
        // Get API key information
        const config = vscode.workspace.getConfiguration('gfactor');
        // Get API key information for display purposes
        const hasClaudeKey = !!config.get<string>('claudeApiKey');
        
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
        <h3 style="margin-top: 0; margin-bottom: 10px;">Log Output</h3>
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
                addLogMessage('Cancel button is now available');
                vscode.postMessage({
                    command: 'logButtonState',
                    message: 'Cancel button is now available'
                });
            } else {
                addLogMessage('Cancel button is no longer available');
                vscode.postMessage({
                    command: 'logButtonState',
                    message: 'Cancel button is no longer available'
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
}

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext): void {
    console.log('GFactor extension is now active');
    
    // Store context for use in other functions
    extensionContext = context;
    
    // Initialize logging
    initializeLogging(context);
    
    // Initialize migration service
    migrationService = new MigrationService();
    
    // Make sure the output channel is visible and focused
    vscode.commands.executeCommand('workbench.action.output.show').then(() => {
        vscode.commands.executeCommand('workbench.action.focusPanel');
        // Select the GFactor output channel
        vscode.commands.executeCommand('workbench.output.action.switchBetweenOutputs', 'GFactor');
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
    const claudeApiKey = config.get<string>('claudeApiKey');

    if (!claudeApiKey) {
        const configureNow = 'Configure Now';
        const response = await vscode.window.showInformationMessage(
            'GFactor requires an API key for Claude to function. Would you like to configure it now?',
            configureNow
        );

        if (response === configureNow) {
            // Show the sidebar view instead
            vscode.commands.executeCommand('workbench.view.extension.gfactor-sidebar');
        }
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
            // Add a small delay to ensure the UI updates properly
            setTimeout(() => {
                sidebarWebview?.postMessage({
                    command: 'migrationComplete'
                });
            }, 500);
        }
        
        vscode.window.showInformationMessage('Migration stopped');
    }
}

// Run refactoring with provided form data
async function runRefactorWithData(formData: RefactorFormData): Promise<void> {
    try {
        // Clear logs at the beginning of a new migration run
        clearLogs();
        
        // Reset the in-memory log array
        logMessages = [];
        
        // Clear logs from extension context
        const context = getExtensionContext();
        context.globalState.update(LOG_STORAGE_KEY, []);
        
        // Check if we have a workspace folder
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('GFactor requires an open workspace folder to function.');
            return;
        }

        // Check if API keys are configured
        const llmConfig = getLlmConfig();
        if (!llmConfig) {
            vscode.window.showErrorMessage('GFactor requires an API key for Claude to function. Please configure it first.');
            return;
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
            // Add a small delay after migration completes to ensure the completion message is shown
            const delayAfterMigration = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 1000));
            
            switch (formData.action) {
                case 'countFiles':
                    await migrationService.countFilesToMigrate(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    // Add delay to ensure messages are shown
                    await delayAfterMigration();
                    // Only notify completion for countFiles action
                    if (sidebarWebview) {
                        sidebarWebview.postMessage({
                            command: 'migrationComplete'
                        });
                    }
                    break;
                case 'migrateOneFile':
                    // Set to process just one file
                    formData.stopOption = 'afterEachFile';
                    await migrationService.performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    // Add delay to ensure completion message is shown
                    await delayAfterMigration();
                    // Notify completion after migration is done
                    if (sidebarWebview) {
                        sidebarWebview.postMessage({
                            command: 'migrationComplete'
                        });
                    }
                    break;
                case 'migrateAllFiles':
                    // Set to process all files
                    formData.stopOption = 'onlyWhenComplete';
                    await migrationService.performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    // Add delay to ensure completion message is shown
                    await delayAfterMigration();
                    // Notify completion after migration is done
                    if (sidebarWebview) {
                        sidebarWebview.postMessage({
                            command: 'migrationComplete'
                        });
                    }
                    break;
                default:
                    // Fallback to normal refactoring
                    await migrationService.performRefactoring(formData, llmConfig, mdcContext, migrationCancellationTokenSource.token);
                    // Add delay to ensure completion message is shown
                    await delayAfterMigration();
                    // Notify completion after migration is done
                    if (sidebarWebview) {
                        sidebarWebview.postMessage({
                            command: 'migrationComplete'
                        });
                    }
            }
        } finally {
            // Clean up the cancellation token source only if it wasn't already disposed
            if (migrationCancellationTokenSource && !migrationCancellationTokenSource.token.isCancellationRequested) {
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

// Get the extension context
function getExtensionContext(): vscode.ExtensionContext {
    if (!extensionContext) {
        throw new Error('Extension context not initialized');
    }
    return extensionContext;
}

// Show burndown chart
async function showBurndownChart(): Promise<void> {
    logMessage('Generating burndown chart...');
    
    // Get pattern occurrences from migration service
    const occurrences = migrationService.getPatternOccurrences();
    
    // If no data, show a message
    if (occurrences.length === 0) {
        const message = 'No pattern occurrence data available. Run a refactoring first.';
        logMessage(message);
        vscode.window.showInformationMessage(message);
        return;
    }
    
    logMessage(`Creating burndown chart with ${occurrences.length} data points`);
    
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
    panel.webview.html = getBurndownChartHtml(occurrences);
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