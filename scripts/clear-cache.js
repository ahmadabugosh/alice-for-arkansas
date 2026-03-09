#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Cache clearing script for Alice ALICE data system
 * Removes all cached data to ensure fresh CSV data retrieval
 */

const cacheDirectories = [
  '.eliza/.elizadb',
  'node_modules/.cache',
  '.cache',
  'dist'
];

const logFiles = [
  'eliza.log',
  'debug.log',
  'error.log'
];

function clearDirectory(dirPath) {
  const fullPath = path.join(process.cwd(), dirPath);
  if (fs.existsSync(fullPath)) {
    console.log(`Clearing directory: ${fullPath}`);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`✓ Cleared: ${dirPath}`);
  } else {
    console.log(`Directory not found: ${dirPath}`);
  }
}

function clearFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`Clearing file: ${fullPath}`);
    fs.unlinkSync(fullPath);
    console.log(`✓ Cleared: ${filePath}`);
  }
}

console.log('🧹 Starting cache clearing process...');
console.log('This will remove all cached data to ensure fresh CSV data retrieval.\n');

// Clear cache directories
cacheDirectories.forEach(clearDirectory);

// Clear log files
logFiles.forEach(clearFile);

// Clear any remaining ElizaOS cache
const elizaCachePattern = /\.eliza/;
const currentDir = fs.readdirSync(process.cwd());
currentDir.forEach(item => {
  if (elizaCachePattern.test(item)) {
    const itemPath = path.join(process.cwd(), item);
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      clearDirectory(item);
    }
  }
});

console.log('\n✅ Cache clearing completed!');
console.log('All cached data has been removed. CSV data will be freshly loaded on next startup.');
