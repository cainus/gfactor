#!/usr/bin/env node

/**
 * Version management script for package.json
 *
 * Usage:
 *   node scripts/version.js [major|minor|patch]
 *
 * Examples:
 *   node scripts/version.js patch  # Increments the patch version (0.0.1 -> 0.0.2)
 *   node scripts/version.js minor  # Increments the minor version (0.0.1 -> 0.1.0)
 *   node scripts/version.js major  # Increments the major version (0.0.1 -> 1.0.0)
 */

// This script is meant to be run directly with Node.js, not through ESLint
// We're using CommonJS here for simplicity and compatibility
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

// Get the package.json path
const packageJsonPath = path.join(__dirname, '..', 'package.json');

// Read the package.json file
const packageJson = require(packageJsonPath);

// Get the current version
const [major, minor, patch] = packageJson.version.split('.').map(Number);

// Get the version type from command line arguments
const versionType = process.argv[2] || 'patch';

// Update the version based on the version type
switch (versionType.toLowerCase()) {
  case 'major':
    packageJson.version = `${major + 1}.0.0`;
    break;
  case 'minor':
    packageJson.version = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    packageJson.version = `${major}.${minor}.${patch + 1}`;
    break;
}

// Write the updated package.json back to disk
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`Version updated to ${packageJson.version}`);