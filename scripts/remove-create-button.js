#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../node_modules/@elizaos/server/dist/client/assets/index-l7vDDpLb.js');

try {
  // Read the file
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find and replace just the text content to hide the button
  content = content.replace(/activeTab === "agents" \? "Create New Agent" : "Create New Group"/, '""');
  
  // Also remove the "Create New" text from the sidebar dropdown
  content = content.replace(/"Create New"/g, '""');
  
  // Remove the entire dropdown menu by finding the specific structure and removing it
  const lines = content.split('\n');
  const filteredLines = [];
  let skipLines = 0;
  let inDropdownMenu = false;
  let braceCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (skipLines > 0) {
      skipLines--;
      continue;
    }
    
    // Look for the start of the dropdown menu with the Plus icon
    if (lines[i].includes('jsxRuntimeExports.jsxs(DropdownMenu, { children: [') && 
        i + 5 < lines.length && 
        lines[i + 5] && lines[i + 5].includes('Plus, { className: "w-4 h-4 bg"')) {
      inDropdownMenu = true;
      braceCount = 1;
      continue;
    }
    
    if (inDropdownMenu) {
      // Count braces to find the end of the dropdown structure
      const openBraces = (lines[i].match(/\[/g) || []).length + (lines[i].match(/\{/g) || []).length;
      const closeBraces = (lines[i].match(/\]/g) || []).length + (lines[i].match(/\}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      if (braceCount <= 0) {
        inDropdownMenu = false;
      }
      continue;
    }
    
    filteredLines.push(lines[i]);
  }
  
  content = filteredLines.join('\n');
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Create New Agent button');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
