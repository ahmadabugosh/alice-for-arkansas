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
  
  // Only remove the text content, not the structure
  // Remove "Create New Agent" button text
  content = content.replace(/activeTab === "agents" \? "Create New Agent" : "Create New Group"/, '""');
  
  // Remove "Create New" text from sidebar (but keep the button structure)
  content = content.replace(/"Create New"/g, '""');
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed text content from Create buttons (keeping structure intact)');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
