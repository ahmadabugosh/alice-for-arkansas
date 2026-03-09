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
  
  // Replace the logo reference
  content = content.replace(
    'src: "/elizaos-logo-light.png"',
    'src: "/alice-logo.png"'
  );
  
  // Also update the alt text
  content = content.replace(
    'alt: "elizaos-logo"',
    'alt: "alice-logo"'
  );
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully updated logo reference to alice-logo.png');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
