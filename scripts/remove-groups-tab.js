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
  
  // Remove Groups tab from main navigation
  content = content.replace(
    /\/\* @__PURE__ \*\/ jsxRuntimeExports\.jsx\(\s*TabsTrigger,\s*\{\s*value: "groups",\s*className: "rounded-full data-\[state=active\]:border-b-0 data-\[state=active\]:bg-white data-\[state=active\]:text-black data-\[state=active\]:font-bold cursor-pointer text-lg py-1",\s*children: "Groups"\s*\}\s*\)/g,
    ''
  );
  
  // Remove the Groups tab trigger
  const groupsTabPattern = /,\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(\s*TabsTrigger,\s*\{\s*value:\s*"groups",\s*className:\s*"[^"]*",\s*children:\s*"Groups"\s*\}\s*\)/g;
  
  content = content.replace(groupsTabPattern, '');
  
  // Also remove any Groups sidebar sections
  const groupsSidebarPattern = /\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(SectionHeader,\s*\{\s*className:\s*"[^"]*",\s*children:\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\("div",\s*\{\s*children:\s*"Groups"\s*\}\)\s*\}\)/g;
  
  content = content.replace(groupsSidebarPattern, '');
  
  // Remove "Create New" dropdown button from sidebar
  const createNewButtonPattern = /\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(\s*DropdownMenuTrigger,\s*\{\s*asChild:\s*true,\s*children:\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsxs\(\s*Button,\s*\{\s*variant:\s*"ghost",\s*className:\s*"w-full bg-sidebar-accent hover:bg-sidebar-accent\/80 h-10 rounded justify-start",\s*children:\s*\[\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(Plus,\s*\{\s*className:\s*"w-4 h-4 bg"\s*\}\),\s*"Create New"\s*\]\s*\}\s*\)\s*\}\s*\)/g;
  
  content = content.replace(createNewButtonPattern, '');
  
  // Remove "Create New Agent" button from top right - using simpler pattern
  const createAgentButtonPattern1 = /activeTab\s*===\s*"agents"\s*\?\s*"Create New Agent"\s*:\s*"Create New Group"/g;
  const createAgentButtonPattern2 = /"create-agent-button cursor-pointer gap-1"/g;
  
  // Replace the text content first
  content = content.replace(createAgentButtonPattern1, '""');
  
  // Then find and remove the entire button element by looking for the className
  const lines = content.split('\n');
  const filteredLines = [];
  let skipLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (skipLines > 0) {
      skipLines--;
      continue;
    }
    
    if (lines[i].includes('create-agent-button cursor-pointer gap-1')) {
      // Skip this line and the next few lines that are part of the button
      let j = i;
      while (j < lines.length && !lines[j].includes('}')) {
        j++;
      }
      skipLines = j - i;
      continue;
    }
    
    filteredLines.push(lines[i]);
  }
  
  content = filteredLines.join('\n');
  
  // Remove dropdown menu content for Create New options
  const createDropdownPattern = /\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsxs\(\s*DropdownMenuContent,\s*\{\s*align:\s*"start",\s*className:\s*"w-full min-w-\[var\(--radix-dropdown-menu-trigger-width\)\]",\s*children:\s*\[\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(DropdownMenuItem,\s*\{\s*onClick:\s*handleCreateAgent,\s*className:\s*"w-full",\s*children:\s*"Create New Agent"\s*\}\),\s*\/\*\s*@__PURE__\s*\*\/\s*jsxRuntimeExports\.jsx\(DropdownMenuItem,\s*\{\s*onClick:\s*handleCreateGroup,\s*className:\s*"w-full",\s*children:\s*"Create New Group"\s*\}\)\s*\]\s*\}\s*\)/g;
  
  content = content.replace(createDropdownPattern, '');
  
  // Write the modified content back
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log('✅ Successfully removed Groups tab, Create New menu, and Create New Agent button from ElizaOS interface');
  
} catch (error) {
  console.error('❌ Error modifying file:', error.message);
  process.exit(1);
}
