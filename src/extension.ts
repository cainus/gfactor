import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as childProcess from 'child_process';
// import * as util from 'util'; // Unused import
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
    stopOption: 'afterEachFix' | 'afterEachFile' | 'onlyWhenComplete';
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

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext): void {
    console.log('GFactor extension is now active');

    // Register the commands
    const startRefactorCommand = vscode.commands.registerCommand('gfactor.startRefactor', () => {
        startRefactor(context);
    });

    const configureApiKeysCommand = vscode.commands.registerCommand('gfactor.configureApiKeys', () => {
        configureApiKeys(context);
    });

    const showBurndownChartCommand = vscode.commands.registerCommand('gfactor.showBurndownChart', () => {
        showBurndownChart();
    });

    context.subscriptions.push(startRefactorCommand, configureApiKeysCommand, showBurndownChartCommand);

    // Check if API keys are configured on startup
    checkApiKeyConfiguration(context);
}

// This method is called when your extension is deactivated
export function deactivate(): void {}

// Check if API keys are configured
async function checkApiKeyConfiguration(context: vscode.ExtensionContext): Promise<void> {
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
            await configureApiKeys(context);
        }
    }
}

// Configure API keys
async function configureApiKeys(_context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('gfactor');
    
    // Ask which LLM to configure
    const llmOptions = ['Gemini', 'Claude'];
    const selectedLlm = await vscode.window.showQuickPick(llmOptions, {
        placeHolder: 'Select which LLM to configure'
    });

    if (!selectedLlm) {
        return;
    }

    // Ask for API key
    const apiKey = await vscode.window.showInputBox({
        prompt: `Enter your ${selectedLlm} API key`,
        password: true
    });

    if (!apiKey) {
        return;
    }

    // Save API key to configuration
    if (selectedLlm === 'Gemini') {
        await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
        await config.update('preferredLlm', 'gemini', vscode.ConfigurationTarget.Global);
    } else {
        await config.update('claudeApiKey', apiKey, vscode.ConfigurationTarget.Global);
        await config.update('preferredLlm', 'claude', vscode.ConfigurationTarget.Global);
    }

    vscode.window.showInformationMessage(`${selectedLlm} API key configured successfully!`);
}

// Start the refactoring process
async function startRefactor(_context: vscode.ExtensionContext): Promise<void> {
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

    // Show the refactoring form
    const formData = await showRefactorForm();
    if (!formData) {
        return;
    }

    // Collect context from .mdc files
    const mdcContext = await collectMdcContext();

    // Start the refactoring process
    await performRefactoring(formData, llmConfig, mdcContext);
}

// Show the refactoring form
async function showRefactorForm(): Promise<RefactorFormData | undefined> {
    // Create a webview panel for the form
    const panel = vscode.window.createWebviewPanel(
        'gfactorForm',
        'GFactor: Code Migration Form',
        vscode.ViewColumn.One,
        {
            enableScripts: true
        }
    );

    // Set the HTML content for the form
    panel.webview.html = getRefactorFormHtml();

    // Handle form submission
    return new Promise<RefactorFormData | undefined>((resolve) => {
        panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'submitForm') {
                    resolve(message.data);
                    panel.dispose();
                } else if (message.command === 'cancel') {
                    resolve(undefined);
                    panel.dispose();
                }
            },
            undefined,
            []
        );
    });
}

// Get the HTML for the refactoring form
function getRefactorFormHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GFactor: Code Migration Form</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"], textarea {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        .radio-group {
            margin-top: 5px;
        }
        .radio-option {
            margin-bottom: 5px;
        }
        button {
            padding: 8px 16px;
            margin-right: 10px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .cancel-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .cancel-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h1>GFactor: Code Migration Form</h1>
    <p>Configure your code migration settings below:</p>
    
    <form id="refactorForm">
        <div class="form-group">
            <label for="compilerLinterCommand">How to run the compiler/linter:</label>
            <input type="text" id="compilerLinterCommand" name="compilerLinterCommand" placeholder="e.g., npm run lint" required>
        </div>
        
        <div class="form-group">
            <label for="testCommand">How to run the tests:</label>
            <input type="text" id="testCommand" name="testCommand" placeholder="e.g., npm test" required>
        </div>
        
        <div class="form-group">
            <label for="filePatterns">What file patterns to investigate:</label>
            <input type="text" id="filePatterns" name="filePatterns" placeholder="e.g., src/**/*.ts" required>
        </div>
        
        <div class="form-group">
            <label for="findPattern">How to find the pattern to migrate away from:</label>
            <textarea id="findPattern" name="findPattern" placeholder="Describe the pattern to find (can include code examples)" required></textarea>
        </div>
        
        <div class="form-group">
            <label for="replacePattern">How to fix or replace the pattern:</label>
            <textarea id="replacePattern" name="replacePattern" placeholder="Describe how to fix or replace the pattern (can include code examples)" required></textarea>
        </div>
        
        <div class="form-group">
            <label>Stop option:</label>
            <div class="radio-group">
                <div class="radio-option">
                    <input type="radio" id="afterEachFix" name="stopOption" value="afterEachFix" required>
                    <label for="afterEachFix">Stop after each fix</label>
                </div>
                <div class="radio-option">
                    <input type="radio" id="afterEachFile" name="stopOption" value="afterEachFile">
                    <label for="afterEachFile">Stop after each file</label>
                </div>
                <div class="radio-option">
                    <input type="radio" id="onlyWhenComplete" name="stopOption" value="onlyWhenComplete" checked>
                    <label for="onlyWhenComplete">Stop only when complete</label>
                </div>
            </div>
        </div>
        
        <div class="form-actions">
            <button type="submit" id="runButton">Run</button>
            <button type="button" id="cancelButton" class="cancel-button">Cancel</button>
        </div>
    </form>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('refactorForm').addEventListener('submit', (event) => {
            event.preventDefault();
            
            const formData = {
                compilerLinterCommand: document.getElementById('compilerLinterCommand').value,
                testCommand: document.getElementById('testCommand').value,
                filePatterns: document.getElementById('filePatterns').value,
                findPattern: document.getElementById('findPattern').value,
                replacePattern: document.getElementById('replacePattern').value,
                stopOption: document.querySelector('input[name="stopOption"]:checked').value
            };
            
            vscode.postMessage({
                command: 'submitForm',
                data: formData
            });
        });
        
        document.getElementById('cancelButton').addEventListener('click', () => {
            vscode.postMessage({
                command: 'cancel'
            });
        });
    </script>
</body>
</html>`;
}

// Collect context from .mdc files
async function collectMdcContext(): Promise<string> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return '';
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const mdcFiles = await glob.glob('**/*.mdc', { cwd: workspaceRoot });
    
    let context = '';
    const md = MarkdownIt.default();
    
    for (const file of mdcFiles) {
        try {
            const filePath = path.join(workspaceRoot, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const plainText = md.render(content);
            context += `# ${file}\n${plainText}\n\n`;
        } catch (error) {
            console.error(`Error reading .mdc file ${file}:`, error);
        }
    }
    
    return context;
}

// Perform the refactoring process
async function performRefactoring(
    formData: RefactorFormData,
    llmConfig: LlmConfig,
    mdcContext: string
): Promise<void> {
    // Reset pattern occurrences for new refactoring session
    patternOccurrences = [];
    
    // Show progress
    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'GFactor: Performing code migration',
            cancellable: true
        },
        async (progress, token) => {
            try {
                // Find files matching the pattern
                const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                const files = await glob.glob(formData.filePatterns, { cwd: workspaceRoot });
                
                if (files.length === 0) {
                    vscode.window.showWarningMessage('No files found matching the specified pattern.');
                    return;
                }
                
                progress.report({ message: `Found ${files.length} files to process` });
                
                // Count initial pattern occurrences across all files
                let totalInitialPatternCount = 0;
                for (const file of files) {
                    const filePath = path.join(workspaceRoot, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const patternCount = countPatternOccurrences(content, formData.findPattern);
                    totalInitialPatternCount += patternCount;
                }
                
                // Record initial pattern count
                if (totalInitialPatternCount > 0) {
                    patternOccurrences.push({
                        timestamp: new Date(),
                        count: totalInitialPatternCount
                    });
                }
                
                // Process each file
                for (let i = 0; i < files.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const file = files[i];
                    const filePath = path.join(workspaceRoot, file);
                    
                    progress.report({
                        message: `Processing file ${i + 1}/${files.length}: ${file}`,
                        increment: (1 / files.length) * 100
                    });
                    
                    // Read file content
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Count pattern occurrences in this file
                    const initialPatternCount = countPatternOccurrences(content, formData.findPattern);
                    
                    // Skip if no patterns found
                    if (initialPatternCount === 0) {
                        continue;
                    }
                    
                    // Process the file with the LLM
                    const updatedContent = await processWithLlm(
                        content,
                        file,
                        formData,
                        llmConfig,
                        mdcContext
                    );
                    
                    if (!updatedContent || updatedContent === content) {
                        continue;
                    }
                    
                    // Count remaining patterns after refactoring
                    const remainingPatternCount = countPatternOccurrences(updatedContent, formData.findPattern);
                    const patternsFixed = initialPatternCount - remainingPatternCount;
                    
                    // Write the updated content back to the file
                    fs.writeFileSync(filePath, updatedContent, 'utf8');
                    
                    // Run compiler/linter
                    const linterResult = await runCommand(formData.compilerLinterCommand, workspaceRoot);
                    if (!linterResult.success) {
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
                    const testResult = await runCommand(formData.testCommand, workspaceRoot);
                    if (!testResult.success) {
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
                    
                    // Record successful pattern fixes
                    if (patternsFixed > 0) {
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
                            `Successfully migrated file ${file} (${i + 1}/${files.length}).`,
                            'Continue',
                            'Stop Migration',
                            'Show Burndown Chart'
                        );
                        
                        if (continueRefactoring === 'Stop Migration') {
                            break;
                        } else if (continueRefactoring === 'Show Burndown Chart') {
                            await showBurndownChart();
                        }
                    }
                }
                
                // Show completion message with option to view burndown chart
                const viewChart = await vscode.window.showInformationMessage(
                    'Code migration completed successfully!',
                    'Show Burndown Chart'
                );
                
                if (viewChart === 'Show Burndown Chart') {
                    await showBurndownChart();
                }
            } catch (error) {
                console.error('Error during refactoring:', error);
                vscode.window.showErrorMessage(`Error during code migration: ${error}`);
            }
        }
    );
}

// Count pattern occurrences in content
function countPatternOccurrences(content: string, pattern: string): number {
    // Simple implementation - in a real-world scenario, this would be more sophisticated
    // and would use regex or the LLM to count actual pattern instances
    const regex = new RegExp(pattern, 'g');
    const matches = content.match(regex);
    return matches ? matches.length : 0;
}

// Show burndown chart
async function showBurndownChart(): Promise<void> {
    // If no data, show a message
    if (patternOccurrences.length === 0) {
        vscode.window.showInformationMessage('No pattern occurrence data available. Run a refactoring first.');
        return;
    }
    
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
            }).join('')}
            
            <!-- X-axis labels -->
            ${chartData.map((_data, i) => {
                const x = paddingLeft + i * xScale;
                return `<text class="chart-label" x="${x}" y="${paddingTop + graphHeight + 20}" text-anchor="middle">${i + 1}</text>`;
            }).join('')}
            
            <!-- Axis titles -->
            <text class="axis-label" x="${paddingLeft - 35}" y="${paddingTop + graphHeight / 2}" transform="rotate(-90, ${paddingLeft - 35}, ${paddingTop + graphHeight / 2})">Patterns Remaining</text>
            <text class="axis-label" x="${paddingLeft + graphWidth / 2}" y="${paddingTop + graphHeight + 40}">Refactoring Steps</text>
            
            <!-- Chart line -->
            <path class="chart-line" d="${pathData}"></path>
            
            <!-- Data points -->
            ${chartData.map(data => {
                const x = paddingLeft + data.index * xScale;
                const y = paddingTop + graphHeight - (data.count * yScale);
                return `<circle class="chart-point" cx="${x}" cy="${y}" r="4"></circle>`;
            }).join('')}
        </svg>
    </div>
    
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
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
}

// Check if content contains the pattern to refactor (currently unused but kept for future use)
// function containsPattern(content: string, pattern: string): boolean {
//     // This is a simple check - in a real implementation, this would be more sophisticated
//     // and would use the LLM to determine if the pattern exists
//     return content.includes(pattern);
// }

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
        console.error('Error processing with LLM:', error);
        vscode.window.showErrorMessage(`Error processing with LLM: ${error}`);
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
        console.error('Error with Claude API:', error);
        throw error;
    }
}

// Run a command and return the result
async function runCommand(command: string, cwd: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
        childProcess.exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, output: stderr || stdout });
            } else {
                resolve({ success: true, output: stdout });
            }
        });
    });
}