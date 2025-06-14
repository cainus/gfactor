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
  }
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

if (isWatch) {
  const context = esbuild.context(options);
  context.then(ctx => {
    ctx.watch();
    copyTimestampFile();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(options).then(() => {
    copyTimestampFile();
    console.log('Build complete!');
  }).catch(() => process.exit(1));
}