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
  
  // Function to scroll to the bottom of the log content
  const scrollToBottom = React.useCallback(() => {
    try {
      if (logContentRef.current) {
        logContentRef.current.scrollTop = logContentRef.current.scrollHeight;
        console.log('LOGWINDOW: Scrolled to bottom');
      } else {
        const logContent = document.getElementById('logContent');
        if (logContent) {
          logContent.scrollTop = logContent.scrollHeight;
          console.log('LOGWINDOW: Scrolled to bottom via getElementById');
        } else {
          console.log('LOGWINDOW: Could not find log content element to scroll');
        }
      }
    } catch (error) {
      console.error('LOGWINDOW: Error scrolling to bottom:', error);
    }
  }, []);
  
  // Add a log message directly to the DOM after component mounts
  React.useEffect(() => {
    console.log('LOGWINDOW: Component mounted');
    
    // Create a cleanup function that will be populated if we set up an observer
    let cleanup: (() => void) | undefined;
    
    // Try to add a log message directly to the DOM
    try {
      if (logContentRef.current) {
        console.log('LOGWINDOW: logContentRef is available, adding log directly');
        const logElement = document.createElement('p');
        logElement.textContent = 'LOG FROM USEEFFECT: Added directly to DOM at ' + new Date().toISOString();
        logElement.style.margin = '4px 0';
        logElement.style.color = 'var(--vscode-foreground)';
        logContentRef.current.appendChild(logElement);
        scrollToBottom();
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
        scrollToBottom();
      } else {
        console.log('LOGWINDOW: Could not find logContent by ID');
      }
    } catch (error) {
      console.error('LOGWINDOW: Error finding logContent by ID:', error);
    }
    
    // Set up a MutationObserver to detect when logs are added and scroll to bottom
    try {
      const logContent = logContentRef.current || document.getElementById('logContent');
      if (logContent) {
        console.log('LOGWINDOW: Setting up MutationObserver');
        const observer = new MutationObserver((mutations) => {
          // If nodes were added, scroll to bottom
          if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
            console.log('LOGWINDOW: Logs added, scrolling to bottom');
            scrollToBottom();
          }
        });
        
        observer.observe(logContent, { childList: true });
        
        // Set the cleanup function
        cleanup = () => {
          observer.disconnect();
        };
      }
    } catch (error) {
      console.error('LOGWINDOW: Error setting up MutationObserver:', error);
    }
    
    // Return the cleanup function or undefined
    return cleanup;
  }, [scrollToBottom]);
  
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