#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * CSV Data Validation Script for Alice ALICE system
 * Validates CSV data integrity and reports any issues
 */

function validateCountiesCSV() {
  console.log('🔍 Validating counties.csv...');
  
  const csvPath = path.join(process.cwd(), 'data', 'counties.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('❌ counties.csv not found at:', csvPath);
    return false;
  }

  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, { column }) => {
        if (column === 'households' || column === 'alice_percentage' || column === 'year') {
          return parseInt(value);
        }
        if (column === 'priority') {
          return value === 'true';
        }
        return value;
      }
    });

    console.log(`✅ Loaded ${records.length} county records`);
    
    // Validate specific counties mentioned in the issue
    const testCounties = ['Izard County', 'Hempstead County', 'Lee County'];
    
    testCounties.forEach(countyName => {
      const county = records.find(r => r.county === countyName);
      if (county) {
        console.log(`✅ ${countyName}: ${county.households} households, ${county.alice_percentage}% ALICE rate`);
      } else {
        console.log(`❌ ${countyName}: NOT FOUND`);
      }
    });

    // Check for data integrity issues
    const issues = [];
    records.forEach((record, index) => {
      if (!record.county || record.county.trim() === '') {
        issues.push(`Row ${index + 1}: Missing county name`);
      }
      if (isNaN(record.households) || record.households <= 0) {
        issues.push(`Row ${index + 1}: Invalid households value: ${record.households}`);
      }
      if (isNaN(record.alice_percentage) || record.alice_percentage < 0 || record.alice_percentage > 100) {
        issues.push(`Row ${index + 1}: Invalid ALICE percentage: ${record.alice_percentage}`);
      }
      if (record.year !== 2023) {
        issues.push(`Row ${index + 1}: Unexpected year: ${record.year}`);
      }
    });

    if (issues.length > 0) {
      console.log('\n⚠️  Data integrity issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
      return false;
    }

    console.log('✅ All county data validation passed');
    return true;

  } catch (error) {
    console.error('❌ Error validating counties.csv:', error.message);
    return false;
  }
}

function checkDataFolderStructure() {
  console.log('\n🔍 Checking data folder structure...');
  
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    console.error('❌ /data folder not found');
    return false;
  }

  const requiredFiles = ['counties.csv', 'demographics.csv', 'employment.csv', 'trends.csv'];
  const missingFiles = [];

  requiredFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      missingFiles.push(file);
    }
  });

  return missingFiles.length === 0;
}

function checkForDocsFolder() {
  console.log('\n🔍 Checking for docs folder (should be removed)...');
  
  const docsDir = path.join(process.cwd(), 'docs');
  if (fs.existsSync(docsDir)) {
    console.log('❌ docs folder still exists - this may cause data conflicts');
    return false;
  } else {
    console.log('✅ docs folder properly removed');
    return true;
  }
}

console.log('🚀 Starting CSV data validation...\n');

const results = {
  csvValid: validateCountiesCSV(),
  structureValid: checkDataFolderStructure(),
  docsRemoved: checkForDocsFolder()
};

console.log('\n📊 Validation Summary:');
console.log(`Counties CSV: ${results.csvValid ? '✅ VALID' : '❌ INVALID'}`);
console.log(`Data Structure: ${results.structureValid ? '✅ VALID' : '❌ INVALID'}`);
console.log(`Docs Removed: ${results.docsRemoved ? '✅ YES' : '❌ NO'}`);

const allValid = Object.values(results).every(result => result === true);
console.log(`\nOverall Status: ${allValid ? '✅ ALL CHECKS PASSED' : '❌ ISSUES FOUND'}`);

if (!allValid) {
  console.log('\n🔧 Recommended actions:');
  if (!results.csvValid) console.log('  - Fix CSV data integrity issues');
  if (!results.structureValid) console.log('  - Ensure all required CSV files exist in /data folder');
  if (!results.docsRemoved) console.log('  - Remove docs folder to prevent data conflicts');
}

process.exit(allValid ? 0 : 1);
