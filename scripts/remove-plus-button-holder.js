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
  
  // Remove the button holder with Plus icon that remains after dropdown removal
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*Button,\s*\{\s*variant: "ghost",\s*size: "sm",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(Plus, \{ className: "w-4 h-4 bg" \}\),\s*""\s*\]\s*\}\s*\)/g,
    ''
  );
  
  // Also remove any DropdownMenuTrigger that might still contain the button
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuTrigger, \{\s*asChild: true,\s*children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*Button,\s*\{\s*variant: "ghost",\s*size: "sm",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(Plus, \{ className: "w-4 h-4 bg" \}\),\s*""\s*\]\s*\}\s*\) \}\)/g,
    ''
  );
  
  // Remove any remaining Plus icon references in sidebar context
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(Plus, \{ className: "w-4 h-4 bg" \}\),/g,
    ''
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Plus button holder');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
