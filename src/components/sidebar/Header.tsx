import * as React from 'react';
import * as vscode from 'vscode';
import { styles } from '../styles';

interface HeaderProps {
  packageVersion: string;
  timestampContent: string;
  extensionUri: vscode.Uri;
  iconUri?: string;
}

export const Header: React.FC<HeaderProps> = ({
  packageVersion,
  timestampContent,
  extensionUri,
  iconUri
}) => {
  return (
    <div style={styles.header}>
      <img
        src={iconUri || `vscode-resource:${extensionUri.path}/resources/gfactor-icon.png`}
        alt="GFactor Icon"
        width="32"
        height="32"
        style={{ marginRight: '12px' }}
      />
      <div>
        <h2 style={styles.headerText}>GFactor AI Migration</h2>
        <div style={styles.headerVersion}>v{packageVersion} | {timestampContent}</div>
      </div>
    </div>
  );
};