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
  
  // Remove the Groups section header
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(SectionHeader, \{ className: "px-0 py-0 text-xs flex gap-1 mr-2", children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\("div", \{ children: "Groups" \}\) \}\),/g,
    ''
  );
  
  // Also remove the entire Groups section container
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsxs\("div", \{ className: "flex items-center px-4 pt-1 pb-0 text-muted-foreground", children: \[\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(SectionHeader, \{ className: "px-0 py-0 text-xs flex gap-1 mr-2", children: \/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\("div", \{ children: "Groups" \}\) \}\),\s*\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(Separator\$2, \{\}\)\s*\] \}\),/g,
    ''
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Groups heading from sidebar');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
