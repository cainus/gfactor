import * as React from 'react';

interface AssistantMessageFormatterProps {
  jsonString: string;
}

export const AssistantMessageFormatter: React.FC<AssistantMessageFormatterProps> = ({ jsonString }) => {
  try {
    // Parse the JSON string
    const data = JSON.parse(jsonString);
    
    // Check if this is an assistant message
    if (data.type !== 'assistant' || !data.message) {
      throw new Error('Not an assistant message');
    }
    
    const message = data.message;
    
    return (
      <div style={{
        backgroundColor: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '3px',
        padding: '10px',
        margin: '4px 0',
        fontFamily: 'var(--vscode-font-family)',
        fontSize: '12px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--vscode-panel-border)',
          paddingBottom: '6px',
          marginBottom: '6px'
        }}>
          <span style={{ 
            fontWeight: 'bold',
            color: 'var(--vscode-charts-blue)'
          }}>
            Assistant Message
          </span>
          <span style={{ 
            color: 'var(--vscode-descriptionForeground)',
            fontSize: '11px'
          }}>
            {message.id}
          </span>
        </div>
        
        <div style={{ marginBottom: '6px' }}>
          <span style={{ fontWeight: 'bold' }}>Model: </span>
          <span>{message.model || 'Unknown'}</span>
        </div>
        
        {message.content && message.content.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Content:</div>
            {message.content.map((item: {type: string, name?: string, input?: {command?: string, description?: string}, id?: string}, index: number) => (
              <div key={index} style={{ 
                marginLeft: '10px',
                marginBottom: '3px'
              }}>
                {item.type === 'tool_use' && (
                  <div>
                    <div>Tool: {item.name}</div>
                    {item.input && (
                      <div style={{ 
                        marginLeft: '10px',
                        borderLeft: '2px solid var(--vscode-panel-border)',
                        paddingLeft: '8px'
                      }}>
                        {item.input.command && (
                          <div>
                            <span style={{ fontStyle: 'italic' }}>Command: </span>
                            <code>{item.input.command}</code>
                          </div>
                        )}
                        {item.input.description && (
                          <div>
                            <span style={{ fontStyle: 'italic' }}>Description: </span>
                            {item.input.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {item.type !== 'tool_use' && (
                  <div>{JSON.stringify(item)}</div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {message.stop_reason && (
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold' }}>Stop Reason: </span>
            <span>{message.stop_reason}</span>
          </div>
        )}
        
        {message.usage && (
          <div style={{ 
            fontSize: '11px',
            color: 'var(--vscode-descriptionForeground)',
            borderTop: '1px solid var(--vscode-panel-border)',
            paddingTop: '6px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Usage:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {Object.entries(message.usage).map(([key, value]) => (
                <div key={key} style={{ marginRight: '12px' }}>
                  {key}: {String(value)}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {data.session_id && (
          <div style={{ 
            fontSize: '10px',
            color: 'var(--vscode-descriptionForeground)',
            marginTop: '6px'
          }}>
            Session: {data.session_id}
          </div>
        )}
      </div>
    );
  } catch {
    // If parsing fails or it's not an assistant message, return null
    // The parent component will handle fallback rendering
    return null;
  }
};