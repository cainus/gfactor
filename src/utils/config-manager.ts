import * as vscode from 'vscode';

// Get API key configuration
export function getLlmConfig(): { type: 'claude'; apiKey: string } | null {
  const config = vscode.workspace.getConfiguration('gfactor');
  const claudeApiKey = config.get<string>('claudeApiKey');

  if (!claudeApiKey) {
    return null;
  }

  return { type: 'claude', apiKey: claudeApiKey };
}

// Save API keys
export async function saveApiKeys(_llmType: string, apiKey: string): Promise<void> {
  const config = vscode.workspace.getConfiguration('gfactor');
  
  // Save API key to configuration
  await config.update('claudeApiKey', apiKey, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage('Claude API key configured successfully!');
}