import { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  body: {
    fontFamily: 'var(--vscode-font-family)',
    padding: '20px',
    color: 'var(--vscode-foreground)'
  },
  h2: {
    marginTop: 0,
    marginBottom: '16px'
  },
  h3: {
    marginTop: '16px',
    marginBottom: '8px'
  },
  description: {
    marginBottom: '20px',
    fontSize: '13px',
    lineHeight: 1.4
  },
  button: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    marginBottom: '12px',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left'
  },
  buttonHover: {
    backgroundColor: 'var(--vscode-button-hoverBackground)'
  },
  buttonIcon: {
    marginRight: '8px'
  },
  formSection: {
    display: 'none',
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px'
  },
  refactorForm: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)',
    borderRadius: '4px'
  },
  formGroup: {
    marginBottom: '12px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  input: {
    width: '100%',
    padding: '6px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    fontSize: '12px'
  },
  textarea: {
    width: '100%',
    padding: '6px',
    boxSizing: 'border-box',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    fontSize: '12px',
    minHeight: '60px',
    resize: 'vertical'
  },
  radioGroup: {
    marginTop: '5px'
  },
  radioOption: {
    marginBottom: '5px',
    fontSize: '12px'
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '16px',
    gap: '8px'
  },
  actionButton: {
    width: '100%',
    marginBottom: 0,
    fontSize: '13px',
    padding: '8px 12px',
    textAlign: 'center',
    backgroundColor: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer'
  },
  stopButton: {
    backgroundColor: 'var(--vscode-errorForeground, #f44336)',
    color: 'white',
    border: 'none',
    borderRadius: '2px',
    cursor: 'pointer',
    marginTop: '8px',
    display: 'none'
  },
  hidden: {
    display: 'none !important'
  },
  cancelButton: {
    backgroundColor: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)'
  },
  activeButton: {
    backgroundColor: 'var(--vscode-button-hoverBackground)'
  },
  logWindow: {
    marginTop: '20px',
    border: '1px solid var(--vscode-panel-border)',
    backgroundColor: 'var(--vscode-editor-background)',
    height: '200px',
    overflowY: 'auto',
    padding: '10px',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  logVersion: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '16px'
  },
  headerText: {
    margin: 0
  },
  headerVersion: {
    fontSize: '12px',
    color: 'var(--vscode-descriptionForeground)'
  },
  // Burndown chart styles
  chartContainer: {
    marginTop: '20px'
  },
  chartSvg: {
    backgroundColor: 'var(--vscode-editor-background)',
    border: '1px solid var(--vscode-panel-border)'
  },
  axisLine: {
    stroke: 'var(--vscode-panel-border)',
    strokeWidth: 1
  },
  chartLine: {
    stroke: 'var(--vscode-charts-blue)',
    strokeWidth: 2,
    fill: 'none'
  },
  chartPoint: {
    fill: 'var(--vscode-charts-blue)'
  },
  chartLabel: {
    fontSize: '12px',
    fill: 'var(--vscode-foreground)'
  },
  axisLabel: {
    fontSize: '14px',
    fill: 'var(--vscode-foreground)',
    textAnchor: 'middle'
  },
  dataTable: {
    marginTop: '30px',
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableCell: {
    padding: '8px',
    textAlign: 'left',
    borderBottom: '1px solid var(--vscode-panel-border)'
  },
  tableHeader: {
    backgroundColor: 'var(--vscode-editor-background)'
  }
};