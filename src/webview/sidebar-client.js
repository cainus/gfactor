/* eslint-disable */
// Client-side JavaScript for the sidebar webview
// This file runs in the browser context and uses browser globals

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Function to extract JSON from a message, handling Claude prefix
function extractJsonFromMessage(str) {
    if (typeof str !== 'string') return null;
    
    // Check if the string has a prefix like "🤖 CLAUDE JSON:"
    if (str.includes('🤖 CLAUDE JSON:')) {
        try {
            const jsonStr = str.split('🤖 CLAUDE JSON:')[1].trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Error parsing JSON with Claude prefix:', e);
            return null;
        }
    }
    
    // Try parsing as regular JSON
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

// Function to add log messages to the log window
function addLogMessage(message) {
    const logContent = document.getElementById('logContent');
    if (!logContent) {
        console.error('Log content element not found');
        return;
    }
    
    const logEntry = document.createElement('div');
    
    // Try to parse as JSON
    const jsonData = extractJsonFromMessage(message);
    
    if (jsonData && jsonData.type === 'assistant' && jsonData.message) {
        // It's an assistant message, use the React component
        const container = document.createElement('div');
        container.id = 'assistant-message-' + Date.now();
        logEntry.appendChild(container);
        
        try {
            ReactDOM.render(
                React.createElement(window.Components.AssistantMessageFormatter, {
                    jsonString: JSON.stringify(jsonData)
                }),
                container
            );
        } catch (error) {
            console.error('Error rendering AssistantMessageFormatter:', error);
            // Fall back to plain text
            const p = document.createElement('p');
            p.style.margin = '4px 0';
            p.textContent = message;
            logEntry.appendChild(p);
        }
    } else if (jsonData) {
        // It's regular JSON, use the JsonFormatter component
        const container = document.createElement('div');
        container.id = 'json-message-' + Date.now();
        logEntry.appendChild(container);
        
        try {
            ReactDOM.render(
                React.createElement(window.Components.JsonFormatter, {
                    jsonString: JSON.stringify(jsonData)
                }),
                container
            );
        } catch (error) {
            console.error('Error rendering JsonFormatter:', error);
            // Fall back to plain text
            const p = document.createElement('p');
            p.style.margin = '4px 0';
            p.textContent = message;
            logEntry.appendChild(p);
        }
    } else {
        // Plain text
        const p = document.createElement('p');
        p.style.margin = '4px 0';
        p.textContent = message;
        logEntry.appendChild(p);
    }
    
    logContent.appendChild(logEntry);
    
    // Auto-scroll to bottom
    const logWindow = document.getElementById('logWindow');
    if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
    
    // Send message to extension to persist the log
    vscode.postMessage({
        command: 'persistLog',
        message: message
    });
}

// Function to restore saved logs - simplified
function restoreLogs(logs) {
    if (!logs || !Array.isArray(logs)) return;
    
    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    // Clear existing logs and add each log message
    logContent.innerHTML = '';
    logs.forEach(addLogMessage);
    
    // Auto-scroll to bottom
    const logWindow = document.getElementById('logWindow');
    if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
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

// API Keys form handling - simplified
function setupApiKeysForm() {
    const form = document.getElementById('apiKeysForm');
    const button = document.getElementById('configureApiKeys');
    
    if (!form || !button) return;
    
    // Helper function to toggle form visibility
    function toggleFormVisibility(show) {
        form.style.display = show ? 'block' : 'none';
        button.classList.toggle('active-button', show);
        
        // Save display state
        vscode.postMessage({
            command: 'saveDisplayState',
            data: { apiKeysForm: show }
        });
    }
    
    // Toggle API Keys form when clicking the button
    button.addEventListener('click', () => {
        const isVisible = form.style.display === 'block' || getComputedStyle(form).display === 'block';
        toggleFormVisibility(!isVisible);
    });
    
    // Hide API Keys form when clicking elsewhere
    document.addEventListener('click', (event) => {
        if (getComputedStyle(form).display === 'block' &&
            !form.contains(event.target) &&
            event.target !== button) {
            toggleFormVisibility(false);
        }
    });
    
    // Initialize button state based on form visibility
    document.addEventListener('DOMContentLoaded', () => {
        if (getComputedStyle(form).display === 'block') {
            button.classList.add('active-button');
        }
    });
    
    // API Keys form actions
    const saveButton = document.getElementById('saveApiKeys');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const apiKeyInput = document.getElementById('apiKey');
            const apiKey = apiKeyInput ? apiKeyInput.value : '';
            
            vscode.postMessage({
                command: 'saveApiKeys',
                data: { llmType: 'claude', apiKey }
            });
            
            toggleFormVisibility(false);
        });
    }
    
    const cancelButton = document.getElementById('cancelApiKeys');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            toggleFormVisibility(false);
        });
    }
}

// Function to show/hide action buttons and stop button - simplified
function setMigrationRunningState(isRunning) {
    // Handle action buttons visibility
    ['countFiles', 'migrateOneFile', 'migrateAllFiles'].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.classList.toggle('hidden', isRunning);
    });
    
    // Handle stop button visibility and state
    const stopButton = document.getElementById('stopMigration');
    if (stopButton) {
        stopButton.classList.toggle('hidden', !isRunning);
        stopButton.style.display = isRunning ? 'block' : 'none';
        stopButton.disabled = !isRunning;
    }
    
    // Log button state change
    const message = isRunning 
        ? '🔴 CANCEL BUTTON: Showing cancel button 🔴' 
        : '🔴 CANCEL BUTTON: Hiding cancel button 🔴';
    
    addLogMessage(message);
    vscode.postMessage({
        command: 'logButtonState',
        message: message
    });
}

// Set up refactor action buttons
function setupRefactorButtons() {
    // Refactor action buttons - consolidated
    const actionButtonConfig = {
        'countFiles': { action: 'countFiles', stopOption: 'custom' },
        'migrateOneFile': { action: 'migrateOneFile', stopOption: 'afterEachFile' },
        'migrateAllFiles': { action: 'migrateAllFiles', stopOption: 'onlyWhenComplete' }
    };
    
    // Set up event handlers for all action buttons
    Object.keys(actionButtonConfig).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        button.addEventListener('click', () => {
            const formData = saveRefactorFormData();
            const config = actionButtonConfig[buttonId];
            
            // Apply button-specific configuration
            formData.action = config.action;
            if (config.stopOption) {
                formData.stopOption = config.stopOption;
            }
            
            setMigrationRunningState(true);
            
            vscode.postMessage({
                command: 'runRefactor',
                data: formData
            });
        });
    });
    
    // Stop migration button
    const stopButton = document.getElementById('stopMigration');
    if (stopButton) {
        stopButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'stopMigration'
            });
            
            // Disable the stop button immediately to prevent multiple clicks
            stopButton.disabled = true;
        });
    }
}

// Set up text input event listeners
function setupTextInputs() {
    // Add event listeners to all text fields for immediate saving - simplified
    ['compilerLinterCommand', 'testCommand', 'filePatterns', 'findPattern', 'replacePattern'].forEach(inputId => {
        const element = document.getElementById(inputId);
        if (!element) return;
        
        // Common function for delayed saving
        const delayedSave = () => setTimeout(saveRefactorFormData, 0);
        
        // Add event listeners for different input methods
        element.addEventListener('keyup', saveRefactorFormData);
        element.addEventListener('paste', delayedSave);
        element.addEventListener('cut', delayedSave);
        element.addEventListener('change', saveRefactorFormData);
    });
}

// Initialize everything when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up all UI components
    setupApiKeysForm();
    setupRefactorButtons();
    setupTextInputs();
    
    // Request saved logs from the extension
    vscode.postMessage({
        command: 'requestLogs'
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
            const logContent = document.getElementById('logContent');
            if (logContent) logContent.innerHTML = '';
            break;
    }
});