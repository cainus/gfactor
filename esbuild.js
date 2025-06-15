const esbuild = require('esbuild');
const { argv } = require('process');
const fs = require('fs');
const path = require('path');

const isProduction = argv.includes('--production');
const isWatch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  platform: 'node',
  target: 'node16',
  outfile: './dist/extension.js',
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
  },
  loader: {
    '.tsx': 'tsx',
    '.jsx': 'jsx'
  },
  jsx: 'transform'
};

// Function to copy timestamp.txt to dist directory
function copyTimestampFile() {
  try {
    const sourceFile = './timestamp.txt';
    const destFile = './dist/timestamp.txt';
    fs.copyFileSync(sourceFile, destFile);
    console.log('Timestamp file copied to dist directory');
  } catch (error) {
    console.error('Error copying timestamp file:', error);
  }
}

// Function to copy webview files to dist directory
function copyWebviewFiles() {
  try {
    // Create dist/webview directory if it doesn't exist
    const webviewDistDir = './dist/webview';
    if (!fs.existsSync(webviewDistDir)) {
      fs.mkdirSync(webviewDistDir, { recursive: true });
    }
    
    // Copy all files from src/webview to dist/webview
    const webviewSrcDir = './src/webview';
    if (fs.existsSync(webviewSrcDir)) {
      const files = fs.readdirSync(webviewSrcDir);
      files.forEach(file => {
        const srcPath = path.join(webviewSrcDir, file);
        const destPath = path.join(webviewDistDir, file);
        fs.copyFileSync(srcPath, destPath);
      });
      console.log('Webview files copied to dist directory');
    }
  } catch (error) {
    console.error('Error copying webview files:', error);
  }
}

if (isWatch) {
  const context = esbuild.context(options);
  context.then(ctx => {
    ctx.watch();
    copyTimestampFile();
    copyWebviewFiles();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(options).then(() => {
    copyTimestampFile();
    copyWebviewFiles();
    console.log('Build complete!');
  }).catch(() => process.exit(1));
}