import * as React from 'react';

interface LogWindowProps {
  packageVersion: string;
  timestampContent: string;
}

export const LogWindow: React.FC<LogWindowProps> = ({
  packageVersion,
  timestampContent
}) => {
  console.log('LOGWINDOW: Rendering LogWindow component');
  
  // Use a ref for the log content div
  const logContentRef = React.useRef<HTMLDivElement>(null);
  
  // Add a log message directly to the DOM after component mounts
  React.useEffect(() => {
    console.log('LOGWINDOW: Component mounted');
    
    // Try to add a log message directly to the DOM
    try {
      if (logContentRef.current) {
        console.log('LOGWINDOW: logContentRef is available, adding log directly');
        const logElement = document.createElement('p');
        logElement.textContent = 'LOG FROM USEEFFECT: Added directly to DOM at ' + new Date().toISOString();
        logElement.style.margin = '4px 0';
        logElement.style.color = 'var(--vscode-foreground)';
        logContentRef.current.appendChild(logElement);
      } else {
        console.log('LOGWINDOW: logContentRef is not available');
      }
    } catch (error) {
      console.error('LOGWINDOW: Error adding log directly:', error);
    }
    
    // Try to find the logContent element by ID
    try {
      const logContent = document.getElementById('logContent');
      if (logContent) {
        console.log('LOGWINDOW: Found logContent by ID, adding log directly');
        const logElement = document.createElement('p');
        logElement.textContent = 'LOG FROM GETELEMENTBYID: Added directly to DOM at ' + new Date().toISOString();
        logElement.style.margin = '4px 0';
        logElement.style.color = 'var(--vscode-foreground)';
        logContent.appendChild(logElement);
      } else {
        console.log('LOGWINDOW: Could not find logContent by ID');
      }
    } catch (error) {
      console.error('LOGWINDOW: Error finding logContent by ID:', error);
    }
  }, []);
  
  // Create a very simple component with hardcoded logs and an ID for direct DOM manipulation
  return (
    <div style={{
      border: '1px solid var(--vscode-panel-border)',
      padding: '10px',
      marginTop: '10px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '10px'
      }}>
        <h3 style={{ margin: 0 }}>Log Output</h3>
        <div>v{packageVersion} | {timestampContent}</div>
      </div>
      
      <div
        id="logContent"
        ref={logContentRef}
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: '1px solid var(--vscode-panel-border)',
          padding: '10px',
          backgroundColor: 'var(--vscode-editor-background)'
        }}
      >
      </div>
      
    </div>
  );
};