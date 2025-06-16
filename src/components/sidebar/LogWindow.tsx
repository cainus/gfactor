import * as React from 'react';
import { styles } from '../styles';
import { AssistantMessageFormatter } from './AssistantMessageFormatter';
import { JsonFormatter } from './JsonFormatter';

// Define VS Code API types
interface VSCodeMessage {
  command: string;
  [key: string]: unknown;
}

declare function acquireVsCodeApi(): {
  postMessage: (message: VSCodeMessage) => void;
  setState: (state: unknown) => void;
  getState: () => unknown;
};

// Define JSON data types
interface AssistantJsonData {
  type: 'assistant';
  message: string;
  [key: string]: unknown;
}

interface GenericJsonData {
  [key: string]: unknown;
}

// Define log message types
interface LogMessage {
  id: string;
  content: string;
  jsonData?: AssistantJsonData | GenericJsonData;
  type: 'text' | 'assistant' | 'json';
}

interface LogWindowProps {
  packageVersion: string;
  timestampContent: string;
}

export const LogWindow: React.FC<LogWindowProps> = ({
  packageVersion,
  timestampContent
}) => {
  // State for log messages
  const [logs, setLogs] = React.useState<LogMessage[]>([]);
  const logWindowRef = React.useRef<HTMLDivElement>(null);
  
  // Function to extract JSON from a message
  const extractJsonFromMessage = React.useCallback((str: string) => {
    if (typeof str !== 'string') return null;
    
    // Check if the string has a prefix like "🤖 CLAUDE JSON:" or "🤖 CLAUDE ASSISTANT:"
    if (str.includes('🤖 CLAUDE JSON:')) {
      try {
        const jsonStr = str.split('🤖 CLAUDE JSON:')[1].trim();
        return JSON.parse(jsonStr);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        console.error('Error parsing JSON with Claude JSON prefix');
        return null;
      }
    } else if (str.includes('🤖 CLAUDE ASSISTANT:')) {
      try {
        const jsonStr = str.split('🤖 CLAUDE ASSISTANT:')[1].trim();
        return JSON.parse(jsonStr);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        console.error('Error parsing JSON with Claude ASSISTANT prefix');
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
  }, []);
  
  // Function to add a log message
  const addLogMessage = React.useCallback((message: string) => {
    console.log('LogWindow: Adding log message');
    
    const jsonData = extractJsonFromMessage(message);
    const id = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let type: 'text' | 'assistant' | 'json' = 'text';
    if (jsonData && jsonData.type === 'assistant' && jsonData.message) {
      type = 'assistant';
    } else if (jsonData) {
      type = 'json';
    }
    
    setLogs(prevLogs => [...prevLogs, { id, content: message, jsonData, type }]);
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logWindowRef.current) {
        logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
      }
    }, 0);
  }, [extractJsonFromMessage]);
  
  // Effect to set up message listener
  React.useEffect(() => {
    console.log('LogWindow: Setting up message listener');
    
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // Handle messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'log':
          console.log('LogWindow: Received log message');
          addLogMessage(message.message);
          break;
        case 'restoreLogs':
          console.log('LogWindow: Restoring logs');
          if (message.logs && Array.isArray(message.logs)) {
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
              if (logWindowRef.current) {
                logWindowRef.current.scrollTop = logWindowRef.current.scrollHeight;
              }
            }, 0);
          }
          break;
        case 'clearLogs':
          console.log('LogWindow: Clearing logs');
          setLogs([]);
          break;
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Add initial log message
    addLogMessage('Log system initialized at ' + new Date().toISOString());
    
    // Request saved logs from the extension
    vscode.postMessage({
      command: 'requestLogs'
    });
    
    // Cleanup
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [addLogMessage, extractJsonFromMessage]);
  
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
  
  return (
    <div id="logWindow" ref={logWindowRef} style={styles.logWindow}>
      <div style={styles.logHeader}>
        <h3 style={{ margin: 0 }}>Log Output</h3>
        <div style={styles.logVersion}>v{packageVersion} | {timestampContent}</div>
      </div>
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
  );
};