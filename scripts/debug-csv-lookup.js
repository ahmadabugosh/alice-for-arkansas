#!/usr/bin/env node

// Direct CSV testing without TypeScript imports
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const path = require('path');

console.log('🔍 Testing CSV Service Lookup...\n');

try {
  // Load and parse CSV data directly
  const csvPath = path.join(process.cwd(), 'data', 'counties.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  const counties = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      if (['households', 'alice_percentage', 'year'].includes(context.column)) {
        return parseInt(value);
      }
      if (context.column === 'priority') {
        return value === 'true';
      }
      return value;
    }
  });
  
  console.log('✅ CSV data loaded successfully\n');
  console.log(`📊 Total counties: ${counties.length}\n`);
  
  // Test specific counties
  const testCounties = ['Johnson County', 'Lee County', 'Izard County', 'Hempstead County'];
  
  testCounties.forEach(countyName => {
    console.log(`🔍 Testing: ${countyName}`);
    
    // Simulate the findCounty logic
    const searchName = countyName.toLowerCase().trim();
    let county = counties.find(c => {
      const countyLower = c.county.toLowerCase();
      const countyWithoutSuffix = countyLower.replace(' county', '');
      
      return countyLower === searchName ||
             countyLower === `${searchName} county` ||
             countyWithoutSuffix === searchName ||
             searchName === `${countyWithoutSuffix} county`;
    });
    
    if (!county) {
      // Try fuzzy matching
      county = counties.find(c => {
        const countyLower = c.county.toLowerCase();
        const countyWithoutSuffix = countyLower.replace(' county', '');
        
        return countyLower.includes(searchName) ||
               searchName.includes(countyWithoutSuffix) ||
               countyWithoutSuffix.includes(searchName);
      });
    }
    
    if (county) {
      console.log(`  ✅ Found: ${county.county}`);
      console.log(`  📊 Households: ${county.households.toLocaleString()}`);
      console.log(`  📈 ALICE Rate: ${county.alice_percentage}%`);
      console.log(`  📅 Year: ${county.year}`);
      console.log(`  🎯 Priority: ${county.priority ? 'Yes' : 'No'}`);
      if (county.notes) {
        console.log(`  📝 Notes: ${county.notes}`);
      }
    } else {
      console.log(`  ❌ Not found!`);
    }
    console.log('');
  });
  
  // Check for any data corruption
  console.log('🔍 Checking for data integrity issues...');
  const problemCounties = counties.filter(c => 
    !c.county || 
    isNaN(c.households) || 
    isNaN(c.alice_percentage) || 
    c.households < 0 || 
    c.alice_percentage < 0 || 
    c.alice_percentage > 100
  );
  
  if (problemCounties.length > 0) {
    console.log('❌ Found data integrity issues:');
    problemCounties.forEach(c => {
      console.log(`  Problem county: ${JSON.stringify(c)}`);
    });
  } else {
    console.log('✅ All county data looks good');
  }
  
} catch (error) {
  console.error('❌ Error testing CSV service:', error);
  console.error('Stack:', error.stack);
}
