const esbuild = require('esbuild');
const { argv } = require('process');
const fs = require('fs');
const path = require('path');

const isProduction = argv.includes('--production');
const isWatch = argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
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

/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: ['./src/webview/sidebar-react-app.tsx'],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  outfile: './dist/webview/sidebar-react-app.js',
  sourcemap: !isProduction,
  minify: isProduction,
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
  },
  loader: {
    '.tsx': 'tsx',
    '.jsx': 'jsx'
  },
  jsx: 'automatic',
  external: ['react', 'react-dom']
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
    
    // Copy JS files from src/webview to dist/webview, excluding .tsx files
    const webviewSrcDir = './src/webview';
    if (fs.existsSync(webviewSrcDir)) {
      const files = fs.readdirSync(webviewSrcDir);
      files.forEach(file => {
        // Skip .tsx files as they will be bundled
        if (file.endsWith('.tsx')) {
          return;
        }
        
        const srcPath = path.join(webviewSrcDir, file);
        const destPath = path.join(webviewDistDir, file);
        
        // Only copy if it's a file (not a directory)
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath);
        }
      });
      console.log('Webview files copied to dist directory');
    }
  } catch (error) {
    console.error('Error copying webview files:', error);
  }
}

// Function to build both extension and webview
async function buildAll() {
  try {
    // Build extension
    await esbuild.build(extensionOptions);
    
    // Build webview React app
    await esbuild.build(webviewOptions);
    
    // Copy additional files
    copyTimestampFile();
    copyWebviewFiles();
    
    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Function to watch for changes
async function watchAll() {
  try {
    // Watch extension
    const extensionCtx = await esbuild.context(extensionOptions);
    extensionCtx.watch();
    
    // Watch webview React app
    const webviewCtx = await esbuild.context(webviewOptions);
    webviewCtx.watch();
    
    // Copy additional files
    copyTimestampFile();
    copyWebviewFiles();
    
    console.log('Watching for changes...');
  } catch (error) {
    console.error('Watch setup failed:', error);
    process.exit(1);
  }
}

// Run build or watch
if (isWatch) {
  watchAll();
} else {
  buildAll();
}