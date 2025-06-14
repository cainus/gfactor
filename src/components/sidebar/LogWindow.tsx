import * as React from 'react';
import { styles } from '../styles';

interface LogWindowProps {
  packageVersion: string;
  timestampContent: string;
}

export const LogWindow: React.FC<LogWindowProps> = ({ 
  packageVersion, 
  timestampContent 
}) => {
  return (
    <div id="logWindow" style={styles.logWindow}>
      <div style={styles.logHeader}>
        <h3 style={{ margin: 0 }}>Log Output</h3>
        <div style={styles.logVersion}>v{packageVersion} | {timestampContent}</div>
      </div>
      <div id="logContent"></div>
    </div>
  );
};