import * as React from 'react';
import { styles } from '../styles';

interface ApiKeysFormProps {
  isVisible: boolean;
  hasClaudeKey: boolean;
}

export const ApiKeysForm: React.FC<ApiKeysFormProps> = ({ 
  isVisible,
  hasClaudeKey
}) => {
  const formStyle = {
    ...styles.formSection,
    display: isVisible ? 'block' : 'none'
  };

  return (
    <div id="apiKeysForm" style={formStyle}>
      <h3>Configure API Key</h3>
      <div style={styles.formGroup}>
        <label htmlFor="llmType" style={styles.label}>LLM:</label>
        <div style={styles.radioGroup}>
          <div style={styles.radioOption}>
            <input 
              type="radio" 
              id="claude" 
              name="llmType" 
              value="claude" 
              defaultChecked 
            />
            <span>{hasClaudeKey ? '✓' : '✗'}</span>
            <label htmlFor="claude">Anthropic Claude</label>
          </div>
        </div>
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="apiKey" style={styles.label}>API Key:</label>
        <input 
          type="password" 
          id="apiKey" 
          name="apiKey" 
          placeholder="Enter your API key" 
          style={styles.input}
          defaultValue=""
        />
      </div>
      
      <div style={styles.actionButtons}>
        <button 
          type="button" 
          id="cancelApiKeys" 
          style={{...styles.actionButton, ...styles.cancelButton}}
        >
          Cancel
        </button>
        <button 
          type="button" 
          id="saveApiKeys" 
          style={styles.actionButton}
        >
          Save
        </button>
      </div>
    </div>
  );
};