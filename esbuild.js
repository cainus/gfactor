const esbuild = require('esbuild');
const { argv } = require('process');

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

if (isWatch) {
  const context = esbuild.context(options);
  context.then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  esbuild.build(options).then(() => {
    console.log('Build complete!');
  }).catch(() => process.exit(1));
}