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
  
  // Remove the entire Button element that's still showing as empty
  content = content.replace(
    /Button,\s*\{\s*variant: "ghost",\s*size: "sm",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*\s*""\s*\]/g,
    'null'
  );
  
  // Also try removing with different whitespace patterns
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*Button,\s*\{\s*variant: "ghost",\s*size: "sm",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*""\s*\]\s*\}\s*\)/g,
    ''
  );
  
  // Remove the specific pattern we found in the grep
  content = content.replace(
    /Button,\s*\{\s*variant: "ghost",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*""\s*\]/g,
    'null'
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed empty button container');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
