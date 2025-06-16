import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { AssistantMessageFormatter } from '../components/sidebar/AssistantMessageFormatter';
import { JsonFormatter } from '../components/sidebar/JsonFormatter';

// Define types for VS Code API
interface VSCodeMessage {
  command: string;
  [key: string]: unknown;
}

// Declare the VS Code API function that's available in the WebView context
declare function acquireVsCodeApi(): {
  postMessage: (message: VSCodeMessage) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Define JSON data types
interface AssistantJsonData {
  type: 'assistant';
  message: string;
  [key: string]: unknown;
}

interface GenericJsonData {
  [key: string]: unknown;
}

// Store for log messages
interface LogMessage {
  id: string;
  content: string;
  jsonData?: AssistantJsonData | GenericJsonData;
  type: 'text' | 'assistant' | 'json';
}

// Function to extract JSON from a message, handling Claude prefix
function extractJsonFromMessage(str: string) {
  if (typeof str !== 'string') return null;
  
  // Check if the string has a prefix like "🤖 CLAUDE JSON:" or "🤖 CLAUDE ASSISTANT:"
  if (str.includes('🤖 CLAUDE JSON:')) {
    try {
      const jsonStr = str.split('🤖 CLAUDE JSON:')[1].trim();
      return JSON.parse(jsonStr);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      console.error('Error parsing JSON with Claude JSON prefix:');
      return null;
    }
  } else if (str.includes('🤖 CLAUDE ASSISTANT:')) {
    try {
      const jsonStr = str.split('🤖 CLAUDE ASSISTANT:')[1].trim();
      return JSON.parse(jsonStr);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {
      console.error('Error parsing JSON with Claude ASSISTANT prefix:');
      return null;
    }
  }
  
  // Try parsing as regular JSON
  try {
    return JSON.parse(str);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_e) {
    return null;
  }
}

// Main React application
const SidebarApp: React.FC = () => {
  const [logs, setLogs] = React.useState<LogMessage[]>([]);
  
  // Add a test log message on mount
  React.useEffect(() => {
    console.log('SidebarApp mounted');
    setLogs([{
      id: 'initial-log',
      content: 'Log system initialized at ' + new Date().toISOString(),
      type: 'text'
    }]);
  }, []);
  
  // Effect to set up custom event listeners for communication with sidebar-client.js
  React.useEffect(() => {
    console.log('Setting up custom event listeners');
    
    // Handler for log messages
    const handleLogEvent = (event: CustomEvent) => {
      console.log('Received vscode-log event:', event.detail);
      const { message } = event.detail;
      
      // Add the log message
      const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const jsonData = extractJsonFromMessage(message);
      
      let type: 'text' | 'assistant' | 'json' = 'text';
      if (jsonData && jsonData.type === 'assistant' && jsonData.message) {
        type = 'assistant';
      } else if (jsonData) {
        type = 'json';
      }
      
      setLogs(prevLogs => [...prevLogs, { id, content: message, jsonData, type }]);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        const logWindow = document.getElementById('logWindow');
        if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
      }, 0);
    };
    
    // Handler for clearing logs
    const handleClearLogsEvent = () => {
      console.log('Received vscode-clear-logs event');
      setLogs([]);
    };
    
    // Handler for VS Code messages
    const handleVSCodeMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received VS Code message:', message.command);
      
      switch (message.command) {
        case 'log':
          // Forward to our custom event handler
          handleLogEvent({ detail: { message: message.message } } as CustomEvent);
          break;
        case 'restoreLogs':
          if (message.logs && Array.isArray(message.logs)) {
            console.log('Restoring logs:', message.logs.length);
            const processedLogs = message.logs.map((logMsg: string) => {
              const jsonData = extractJsonFromMessage(logMsg);
              const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              let type: 'text' | 'assistant' | 'json' = 'text';
              if (jsonData && jsonData.type === 'assistant' && jsonData.message) {
                type = 'assistant';
              } else if (jsonData) {
                type = 'json';
              }
              
              return { id, content: logMsg, jsonData, type };
            });
            
            setLogs(processedLogs);
            
            // Auto-scroll to bottom
            setTimeout(() => {
              const logWindow = document.getElementById('logWindow');
              if (logWindow) logWindow.scrollTop = logWindow.scrollHeight;
            }, 0);
          }
          break;
        case 'clearLogs':
          handleClearLogsEvent();
          break;
      }
    };
    
    // Add event listeners
    window.addEventListener('vscode-log', handleLogEvent as EventListener);
    window.addEventListener('vscode-clear-logs', handleClearLogsEvent);
    window.addEventListener('message', handleVSCodeMessage);
    
    // Request saved logs from the extension
    vscode.postMessage({
      command: 'requestLogs'
    });
    
    // Cleanup
    return () => {
      window.removeEventListener('vscode-log', handleLogEvent as EventListener);
      window.removeEventListener('vscode-clear-logs', handleClearLogsEvent);
      window.removeEventListener('message', handleVSCodeMessage);
    };
  }, []);
  
  // We don't need a separate effect for VS Code messages
  // The custom event handlers above will handle all log messages
  
  // Render log messages
  const renderLogMessage = (log: LogMessage) => {
    if (log.type === 'assistant' && log.jsonData) {
      return (
        <AssistantMessageFormatter
          key={log.id}
          jsonString={JSON.stringify(log.jsonData)}
        />
      );
    } else if (log.type === 'json' && log.jsonData) {
      return (
        <JsonFormatter
          key={log.id}
          jsonString={JSON.stringify(log.jsonData)}
        />
      );
    } else {
      return (
        <p key={log.id} style={{ margin: '4px 0', color: 'var(--vscode-foreground)' }}>
          {log.content}
        </p>
      );
    }
  };
  
  console.log('Rendering logs:', logs.length);
  
  return (
    <div id="log-container">
      <div id="logWindow" style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid var(--vscode-panel-border)',
        marginTop: '20px',
        padding: '8px'
      }}>
        <div id="logContent">
          {logs.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--vscode-descriptionForeground)' }}>
              No log messages yet
            </p>
          ) : (
            logs.map(renderLogMessage)
          )}
        </div>
      </div>
    </div>
  );
};

// Initialize the React app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, looking for logContent element');
  
  // Wait a bit to ensure the main React app has rendered
  setTimeout(() => {
    // Find the logContent element that's rendered by the main React app
    const logContentElement = document.getElementById('logContent');
    console.log('LogContent element found:', !!logContentElement);
    
    // Only initialize if the element exists and we're not already initialized
    if (logContentElement && !window.logAppInitialized) {
      try {
        // Clear any existing content
        logContentElement.innerHTML = '';
        
        // Create a root and render our app
        const root = ReactDOM.createRoot(logContentElement);
        root.render(<SidebarApp />);
        console.log('React log app initialized successfully');
        
        // Mark as initialized to prevent double initialization
        window.logAppInitialized = true;
        
        // Add a test log message to verify it's working
        window.dispatchEvent(new CustomEvent('vscode-log', {
          detail: { message: 'Log system initialized and ready to display messages' }
        }));
      } catch (error) {
        console.error('Failed to initialize React log app:', error);
      }
    } else if (window.logAppInitialized) {
      console.log('React log app already initialized');
    } else {
      console.error('LogContent element not found, cannot initialize React log app');
    }
  }, 500); // Wait 500ms for the main React app to render
});

// Add the missing type declaration for our global flag
declare global {
  interface Window {
    logAppInitialized?: boolean;
  }
}