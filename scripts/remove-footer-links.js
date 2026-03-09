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
  
  // Remove Documentation footer link
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(FooterLink, \{ to: "https:\/\/eliza\.how\/", Icon: Book, label: "Documentation" \}\),/g,
    ''
  );
  
  // Remove Settings footer link
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(FooterLink, \{ to: "\/settings", Icon: Cog, label: "Settings" \}\),/g,
    ''
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Documentation and Settings footer links');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
