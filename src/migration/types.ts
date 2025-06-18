export interface RefactorFormData {
  compilerLinterCommand: string;
  testCommand: string;
  filePatterns: string;
  findPattern: string;
  replacePattern: string;
  stopOption: 'afterEachFix' | 'afterEachFile' | 'onlyWhenComplete' | 'custom';
  action?: 'countFiles' | 'migrateOneFile' | 'migrateAllFiles';
}