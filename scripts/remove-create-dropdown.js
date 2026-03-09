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
  
  // Remove the entire DropdownMenu structure with Create New button and menu items
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\(DropdownMenu, \{\s*children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuTrigger, \{\s*asChild: true,\s*children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*Button,\s*\{\s*variant: "ghost",\s*size: "sm",\s*className: "w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(Plus, \{ className: "w-4 h-4 bg" \}\),\s*"Create New"\s*\]\s*\}\s*\) \}\),\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*DropdownMenuContent,\s*\{\s*side: "right",\s*align: "start",\s*className: "w-full min-w-\[var\(--radix-dropdown-menu-trigger-width\)\]",\s*children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuItem, \{ onClick: handleCreateAgent, className: "w-full", children: "Create New Agent" \}\),\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuItem, \{ onClick: handleCreateGroup, className: "w-full", children: "Create New Group" \}\)\s*\]\s*\}\s*\)\s*\]\s*\}\)/g,
    ''
  );
  
  // Also remove any remaining Create New references
  content = content.replace(
    /"Create New"/g,
    '""'
  );
  
  // Remove Create New Agent and Create New Group menu items individually if the above doesn't work
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuItem, \{ onClick: handleCreateAgent, className: "w-full", children: "Create New Agent" \}\),/g,
    ''
  );
  
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(DropdownMenuItem, \{ onClick: handleCreateGroup, className: "w-full", children: "Create New Group" \}\)/g,
    ''
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Create New dropdown menu');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
