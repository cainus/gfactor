import * as vscode from 'vscode';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logMessage, initializeLogging, setSidebarWebview, clearLogs } from './utils/logging';
import { collectMdcContext } from './utils/file-utils';
import { saveApiKeys, getLlmConfig } from './utils/config-manager';
import { MigrationService } from './migration/migration-service';
import { RefactorFormData } from './migration/types';
import { getSidebarHtml, getBurndownChartHtml } from './utils/html-generator';

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
        
        // Restore logs from extension context when webview is created
        const context = getExtensionContext();
        logMessages = context.globalState.get<string[]>(LOG_STORAGE_KEY) || [];
        
        // Get package version
        let packageVersion = "1.0.0"; // Default fallback
        try {
            const packageJsonPath = path.join(this._extensionUri.fsPath, 'package.json');
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            packageVersion = packageJson.version;
        } catch (error) {
            console.error('Error reading package.json:', error);
        }
        
        // Read timestamp from file for logging
        let formattedTimestamp = "June 10, 2025, 3:00 PM"; // Default fallback
        try {
            // Try multiple locations for timestamp.txt
            let timestampContent;
            
            // First try: workspace folder
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                try {
                    const workspaceTimestampPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'timestamp.txt');
                    timestampContent = fs.readFileSync(workspaceTimestampPath, 'utf8').trim();
                    console.log('Found timestamp.txt in workspace folder');
                } catch {
                    // Workspace folder failed, continue to next location
                }
            }
            
            // Second try: extension directory
            if (!timestampContent) {
                try {
                    const extensionTimestampPath = path.join(this._extensionUri.fsPath, 'timestamp.txt');
                    timestampContent = fs.readFileSync(extensionTimestampPath, 'utf8').trim();
                    console.log('Found timestamp.txt in extension directory');
                } catch {
                    // Extension directory failed, continue to next location
                }
            }
            
            // Third try: dist directory
            if (!timestampContent) {
                try {
                    const distTimestampPath = path.join(this._extensionUri.fsPath, 'dist', 'timestamp.txt');
                    timestampContent = fs.readFileSync(distTimestampPath, 'utf8').trim();
                    console.log('Found timestamp.txt in dist directory');
                } catch {
                    // Dist directory failed, use default
                }
            }
            
            // Use the timestamp content if found
            if (timestampContent) {
                formattedTimestamp = timestampContent;
            }
        } catch (error) {
            console.error('Error reading timestamp file:', error);
        }
        
        // Log the current date/time as a static string when the extension panel first shows up
        logMessage(`Extension panel opened - v${packageVersion} | ${formattedTimestamp}`);
        
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
                    // Also add to the in-memory log array for persistence
                    logMessages.push(message.message);
                    const extContext = getExtensionContext();
                    extContext.globalState.update(LOG_STORAGE_KEY, logMessages);
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
        
        // Use the HTML generator to get the sidebar HTML
        return getSidebarHtml(
            webview,
            this._extensionUri,
            savedFormData,
            displayState,
            hasClaudeKey
        );
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
    
    // Check if Claude CLI is installed
    checkClaudeCliInstallation();

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
        logMessage('⚠️ WARNING: GFactor requires an API key for Claude to function.');
        
        // Still show a dialog for this critical configuration
        const configureNow = 'Configure Now';
        const response = await vscode.window.showInformationMessage(
            'GFactor requires an API key for Claude to function. Would you like to configure it now?',
            configureNow
        );

        if (response === configureNow) {
            logMessage('Opening API key configuration panel');
            // Show the sidebar view instead
            vscode.commands.executeCommand('workbench.view.extension.gfactor-sidebar');
        }
    }
}

// Check if Claude CLI is installed
async function checkClaudeCliInstallation(): Promise<void> {
    try {
        // Try to run 'claude -v' to check if it's installed
        childProcess.exec('claude -v', (error: Error | null, stdout: string, _stderr: string) => {
            if (error) {
                // Claude CLI is not installed or not in PATH
                logMessage('⚠️ WARNING: Claude CLI is required but not installed.');
                
                // Ask if the user wants to install it
                const installButton = 'Install Claude CLI';
                vscode.window.showInformationMessage(
                    'Claude CLI is required but not installed.',
                    installButton
                ).then(selection => {
                    if (selection === installButton) {
                        logMessage('Installing Claude CLI via npm...');
                        // Install Claude CLI
                        const terminal = vscode.window.createTerminal('Claude CLI Installation');
                        terminal.show();
                        terminal.sendText('npm install -g @anthropic-ai/claude-code');
                        
                        // Log installation progress
                        logMessage('Claude CLI installation started. Please wait for the installation to complete.');
                    }
                });
            } else {
                // Claude CLI is installed
                logMessage(`Claude CLI is installed: ${stdout.trim()}`);
            }
        });
    } catch (error) {
        console.error('Error checking Claude CLI installation:', error);
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
                logMessage('🔴 CANCEL BUTTON: Migration stopped, hiding cancel button 🔴');
                sidebarWebview?.postMessage({
                    command: 'migrationComplete'
                });
            }, 500);
        }
        
        logMessage('Migration stopped by user - operation cancelled');
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
            logMessage('⚠️ ERROR: GFactor requires an open workspace folder to function.');
            return;
        }

        // Check if API keys are configured
        const llmConfig = getLlmConfig();
        if (!llmConfig) {
            logMessage('⚠️ ERROR: GFactor requires an API key for Claude to function. Please configure it first.');
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
                        logMessage('🔴 CANCEL BUTTON: Count files completed, hiding cancel button 🔴');
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
                        logMessage('🔴 CANCEL BUTTON: Migrate one file completed, hiding cancel button 🔴');
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
                        logMessage('🔴 CANCEL BUTTON: Migrate all files completed, hiding cancel button 🔴');
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
                        logMessage('🔴 CANCEL BUTTON: Migration completed, hiding cancel button 🔴');
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
            logMessage('🔴 CANCEL BUTTON: Error occurred, hiding cancel button 🔴');
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

// The getBurndownChartHtml function has been moved to html-generator.ts