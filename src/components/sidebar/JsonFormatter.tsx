import * as React from 'react';

interface JsonFormatterProps {
  jsonString: string;
}

export const JsonFormatter: React.FC<JsonFormatterProps> = ({ jsonString }) => {
  try {
    // Parse the JSON string
    const jsonData = JSON.parse(jsonString);
    
    // Format the JSON with indentation
    const formattedJson = JSON.stringify(jsonData, null, 2);
    
    return (
      <pre style={{
        backgroundColor: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '3px',
        padding: '8px',
        overflow: 'auto',
        fontSize: '12px',
        fontFamily: 'monospace',
        margin: '4px 0'
      }}>
        {formattedJson}
      </pre>
    );
  } catch {
    // If parsing fails, return the original string
    return <p style={{ margin: '4px 0' }}>{jsonString}</p>;
  }
};