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
  
  // Remove the entire DropdownMenu structure that's still rendering
  content = content.replace(
    /return \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(DropdownMenu, \{ children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuTrigger, \{ asChild: true, children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(\s*null\s*\}\s*\) \}\),\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(\s*DropdownMenuContent,\s*\{\s*align: "start",\s*className: "w-full min-w-\[var\(--radix-dropdown-menu-trigger-width\)\]",\s*children: \[\s*\s*\s*\]\s*\}\s*\)\s*\] \}\);/g,
    'return null;'
  );
  
  // Also try a more specific pattern match for the broken structure
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(DropdownMenu, \{ children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuTrigger, \{ asChild: true, children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(\s*null[\s\S]*?\] \}\);/g,
    'null;'
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed entire dropdown structure');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
