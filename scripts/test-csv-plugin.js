#!/usr/bin/env node

/**
 * Quick test script to verify CSV plugin functionality
 * Run with: node scripts/test-csv-plugin.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing CSV Plugin Implementation...\n');

// Test 1: Check if all CSV files exist
const csvFiles = [
  'data/counties.csv',
  'data/demographics.csv', 
  'data/employment.csv',
  'data/trends.csv'
];

console.log('📁 Checking CSV data files:');
csvFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`  ✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
  }
});

// Test 2: Check plugin structure
console.log('\n🔧 Checking plugin structure:');
const pluginFiles = [
  'src/plugins/csv-analysis/index.ts',
  'src/plugins/csv-analysis/services/csvDataService.ts',
  'src/plugins/csv-analysis/actions/searchCounty.ts',
  'src/plugins/csv-analysis/actions/compareCounties.ts',
  'src/plugins/csv-analysis/actions/rankCounties.ts',
  'src/plugins/csv-analysis/actions/analyzeTrends.ts'
];

pluginFiles.forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - NOT FOUND`);
  }
});

// Test 3: Validate CSV data format
console.log('\n📊 Validating CSV data format:');

try {
  // Check counties.csv
  const countiesPath = path.join(__dirname, '..', 'data/counties.csv');
  if (fs.existsSync(countiesPath)) {
    const countiesData = fs.readFileSync(countiesPath, 'utf8');
    const lines = countiesData.split('\n').filter(line => line.trim());
    console.log(`  ✅ counties.csv: ${lines.length - 1} data rows`);
    
    // Check for Lee County specifically
    if (countiesData.includes('Lee County')) {
      console.log('  ✅ Lee County data found');
    } else {
      console.log('  ⚠️  Lee County data not found');
    }
  }

  // Check demographics.csv
  const demographicsPath = path.join(__dirname, '..', 'data/demographics.csv');
  if (fs.existsSync(demographicsPath)) {
    const demographicsData = fs.readFileSync(demographicsPath, 'utf8');
    const lines = demographicsData.split('\n').filter(line => line.trim());
    console.log(`  ✅ demographics.csv: ${lines.length - 1} data rows`);
  }

} catch (error) {
  console.log(`  ❌ Error reading CSV files: ${error.message}`);
}

// Test 4: Check character configuration
console.log('\n⚙️  Checking character configuration:');
try {
  const characterPath = path.join(__dirname, '..', 'src/character.ts');
  if (fs.existsSync(characterPath)) {
    const characterContent = fs.readFileSync(characterPath, 'utf8');
    
    if (characterContent.includes('./src/plugins/csv-analysis')) {
      console.log('  ✅ CSV plugin registered in character.ts');
    } else {
      console.log('  ❌ CSV plugin NOT registered in character.ts');
    }
    
    if (characterContent.includes('CSV analysis system')) {
      console.log('  ✅ System prompt updated for CSV data');
    } else {
      console.log('  ❌ System prompt not updated for CSV data');
    }
  }
} catch (error) {
  console.log(`  ❌ Error reading character.ts: ${error.message}`);
}

console.log('\n🎯 CSV Plugin Test Summary:');
console.log('If all items show ✅, the CSV plugin is ready for testing!');
console.log('Next steps:');
console.log('1. Run: npm test (to run the full test suite)');
console.log('2. Build and deploy Alice with the CSV plugin');
console.log('3. Test queries like "What is Lee County ALICE rate?" to verify accuracy');
