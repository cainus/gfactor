import * as React from 'react';
import * as vscode from 'vscode';
import { styles } from '../styles';
import { Header } from './Header';
import { ApiKeysForm } from './ApiKeysForm';
import { RefactorForm } from './RefactorForm';
import { LogWindow } from './LogWindow';
import { RefactorFormData } from '../../migration/types';

interface SidebarProps {
  extensionUri: vscode.Uri;
  savedFormData?: RefactorFormData;
  displayState: { apiKeysForm: boolean };
  hasClaudeKey: boolean;
  packageVersion: string;
  timestampContent: string;
  iconUri?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  extensionUri,
  savedFormData,
  displayState,
  hasClaudeKey,
  packageVersion,
  timestampContent,
  iconUri
}) => {
  return (
    <div style={styles.body}>
      <Header
        packageVersion={packageVersion}
        timestampContent={timestampContent}
        extensionUri={extensionUri}
        iconUri={iconUri}
      />
      
      <div style={styles.description}>
        AI-powered code migration tool for large-scale refactoring. 
        Migrate your codebase from one pattern to another with AI assistance.
      </div>
      
      <button id="configureApiKeys" style={styles.button}>
        <span style={styles.buttonIcon}>🔑</span> Configure API Keys
      </button>
      
      <ApiKeysForm 
        isVisible={displayState.apiKeysForm} 
        hasClaudeKey={hasClaudeKey} 
      />
      
      <RefactorForm savedFormData={savedFormData} />
      
      <LogWindow 
        packageVersion={packageVersion} 
        timestampContent={timestampContent} 
      />
      
      {/* Script tag will be added by the HTML generator */}
    </div>
  );
};