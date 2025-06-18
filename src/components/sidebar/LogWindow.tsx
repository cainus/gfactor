import * as React from 'react';
import { AssistantMessageFormatter } from './AssistantMessageFormatter';

interface LogWindowProps {
  packageVersion: string;
}

export const LogWindow: React.FC<LogWindowProps> = ({
  packageVersion
}) => {
  console.log('LOGWINDOW: Rendering LogWindow component');
  
  // State to store log messages
  const [logs, setLogs] = React.useState<string[]>([]);
  
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
  
  // Handle log messages using React state
  React.useEffect(() => {
    console.log('LOGWINDOW: Component mounted');
    
    // Function to handle message events
    const handleMessageEvent = (event: MessageEvent) => {
      const data = event.data;
      
      if (data && (data.command === 'log' || data.command === 'directLog')) {
        setLogs(prevLogs => [...prevLogs, data.message]);
        setTimeout(scrollToBottom, 0);
      } else if (data && data.command === 'restoreLogs' && Array.isArray(data.logs)) {
        setLogs(data.logs);
        setTimeout(scrollToBottom, 0);
      } else if (data && data.command === 'clearLogs') {
        setLogs([]);
      }
    };
    
    // Function to handle custom log events
    const handleCustomLogEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.message) {
        setLogs(prevLogs => [...prevLogs, customEvent.detail.message]);
        setTimeout(scrollToBottom, 0);
      }
    };
    
    // Function to handle clear logs event
    const handleClearLogsEvent = () => {
      setLogs([]);
    };
    
    // Listen for log messages from the extension
    window.addEventListener('message', handleMessageEvent);
    window.addEventListener('vscode-log', handleCustomLogEvent);
    window.addEventListener('vscode-clear-logs', handleClearLogsEvent);
    
    // Add initial log message
    setLogs(['LogWindow component mounted at ' + new Date().toISOString()]);
    
    // Cleanup event listeners
    return () => {
      window.removeEventListener('message', handleMessageEvent);
      window.removeEventListener('vscode-log', handleCustomLogEvent);
      window.removeEventListener('vscode-clear-logs', handleClearLogsEvent);
    };
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
        <div>v{packageVersion}</div>
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
        {logs.map((log, index) => {
          // Try to parse the log as JSON to check if it's an assistant message
          try {
            const parsedLog = JSON.parse(log);
            if (parsedLog.type === 'assistant') {
              return <AssistantMessageFormatter key={index} jsonString={log} />;
            }
          } catch {
            // Not valid JSON or not an assistant message
          }
          
          // Default rendering for non-assistant messages
          return (
            <p key={index} style={{ margin: '4px 0', color: 'var(--vscode-foreground)' }}>
              {log}
            </p>
          );
        })}
      </div>
      
    </div>
  );
};