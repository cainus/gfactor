import * as React from 'react';
import { styles } from '../styles';
import { RefactorFormData } from '../../migration/types';

interface RefactorFormProps {
  savedFormData?: RefactorFormData;
}

export const RefactorForm: React.FC<RefactorFormProps> = ({ savedFormData }) => {
  return (
    <div id="refactorForm" style={styles.refactorForm}>
      <h3 style={{ marginTop: 0 }}>Code Migration</h3>
      <div style={styles.formGroup}>
        <label htmlFor="compilerLinterCommand" style={styles.label}>
          How to run the compiler/linter:
        </label>
        <input
          type="text"
          id="compilerLinterCommand"
          name="compilerLinterCommand"
          placeholder="e.g., npm run lint"
          required
          defaultValue={savedFormData?.compilerLinterCommand || ''}
          style={styles.input}
        />
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="testCommand" style={styles.label}>
          How to run the tests:
        </label>
        <input
          type="text"
          id="testCommand"
          name="testCommand"
          placeholder="e.g., npm test"
          required
          defaultValue={savedFormData?.testCommand || ''}
          style={styles.input}
        />
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="filePatterns" style={styles.label}>
          What file patterns to investigate:
        </label>
        <input
          type="text"
          id="filePatterns"
          name="filePatterns"
          placeholder="e.g., src/**/*.ts"
          required
          defaultValue={savedFormData?.filePatterns || ''}
          style={styles.input}
        />
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="findPattern" style={styles.label}>
          How to find the pattern to migrate away from:
        </label>
        <textarea
          id="findPattern"
          name="findPattern"
          placeholder="Describe the pattern to find (can include code examples)"
          required
          defaultValue={savedFormData?.findPattern || ''}
          style={styles.textarea}
        />
      </div>
      
      <div style={styles.formGroup}>
        <label htmlFor="replacePattern" style={styles.label}>
          How to fix or replace the pattern:
        </label>
        <textarea
          id="replacePattern"
          name="replacePattern"
          placeholder="Describe how to fix or replace the pattern (can include code examples)"
          required
          defaultValue={savedFormData?.replacePattern || ''}
          style={styles.textarea}
        />
      </div>
      
      <div style={styles.actionButtons}>
        <button
          type="button"
          id="countFiles"
          className="action-button"
          style={styles.actionButton}
        >
          Count the files to migrate
        </button>
        <button
          type="button"
          id="migrateOneFile"
          className="action-button"
          style={styles.actionButton}
        >
          Migrate 1 file
        </button>
        <button
          type="button"
          id="migrateAllFiles"
          className="action-button"
          style={styles.actionButton}
        >
          Migrate all files
        </button>
        <button
          type="button"
          id="stopMigration"
          className="stop-button"
          style={styles.stopButton}
          disabled
        >
          Cancel Migration
        </button>
      </div>
    </div>
  );
};