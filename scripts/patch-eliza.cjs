#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const elizaHtmlPath = path.join(__dirname, '../node_modules/@elizaos/server/dist/client/index.html');
const aliceLogoSrc = path.join(__dirname, '../alice-logo.png');
const aliceLogoDest = path.join(__dirname, '../node_modules/@elizaos/server/dist/client/alice-logo.png');
const aliceAvatarSrc = path.join(__dirname, '../alice-avatar.png');
const aliceAvatarDest = path.join(__dirname, '../node_modules/@elizaos/server/dist/client/alice-avatar.png');

console.log('Patching ElizaOS HTML to hide menu items and copy Alice logo...');

if (!fs.existsSync(elizaHtmlPath)) {
  console.log('ElizaOS HTML file not found, skipping patch');
  process.exit(0);
}

// Copy Alice logo to ElizaOS client directory
if (fs.existsSync(aliceLogoSrc)) {
  fs.copyFileSync(aliceLogoSrc, aliceLogoDest);
  console.log('Alice logo copied to ElizaOS client directory');
} else {
  console.log('Alice logo not found, skipping logo copy');
}

// Copy Alice avatar to ElizaOS client directory
if (fs.existsSync(aliceAvatarSrc)) {
  fs.copyFileSync(aliceAvatarSrc, aliceAvatarDest);
  console.log('Alice avatar copied to ElizaOS client directory');
} else {
  console.log('Alice avatar not found, skipping avatar copy');
}

const originalHtml = fs.readFileSync(elizaHtmlPath, 'utf8');

// Check if already patched
if (originalHtml.includes('Alice custom menu hiding')) {
  console.log('ElizaOS HTML already patched');
  process.exit(0);
}

const patchedHtml = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <script type="module">
              // CommonJS shims for browser compatibility
              if (typeof window !== 'undefined') {
                window.global = window.global || window;
                window.exports = window.exports || {};
                window.module = window.module || { exports: {} };
              }
            </script>

    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <title>ElizaOS - Client</title>
    
    <!-- Alice custom menu hiding -->
    <style>
      /* Hide menu items with CSS */
      [data-state="inactive"][value="groups"],
      [data-state="active"][value="groups"],
      [data-state="inactive"][value="documentation"],
      [data-state="active"][value="documentation"],
      [data-state="inactive"][value="settings"],
      [data-state="active"][value="settings"],
      button[aria-label*="Create"],
      button[title*="Create"],
      .create-button,
      .add-button,
      .new-button {
        display: none !important;
      }
    </style>
    
    <script>
      // Alice custom menu hiding - Hide elements after DOM loads
      document.addEventListener('DOMContentLoaded', function() {
        function hideElements() {
          // Hide Groups tab using data-state selectors
          const groupsTabs = document.querySelectorAll('[data-state="inactive"][value="groups"], [data-state="active"][value="groups"], button[value="groups"], [role="tab"][value="groups"]');
          groupsTabs.forEach(el => el.style.display = 'none');
          
          // Hide Documentation tab
          const docTabs = document.querySelectorAll('[data-state="inactive"][value="documentation"], [data-state="active"][value="documentation"], button[value="documentation"], [role="tab"][value="documentation"]');
          docTabs.forEach(el => el.style.display = 'none');
          
          // Hide Settings tab
          const settingsTabs = document.querySelectorAll('[data-state="inactive"][value="settings"], [data-state="active"][value="settings"], button[value="settings"], [role="tab"][value="settings"]');
          settingsTabs.forEach(el => el.style.display = 'none');
          
          // Hide Create buttons with comprehensive selectors
          const createButtons = document.querySelectorAll('button[aria-label*="Create"], button[title*="Create"], .create-button, .add-button, .new-button, [data-testid*="create"]');
          createButtons.forEach(el => el.style.display = 'none');
          
          // Hide + Create New Agent button in top navigation
          const topCreateButtons = document.querySelectorAll('button');
          topCreateButtons.forEach(btn => {
            if (btn.textContent.includes('Create New Agent') || 
                btn.textContent.includes('Create New Group') ||
                btn.textContent.includes('Create New') || 
                btn.textContent.includes('Create')) {
              btn.style.display = 'none';
            }
            // Also hide buttons with plus icon and "Create" class
            if (btn.className.includes('create') || btn.querySelector('svg')) {
              const hasPlus = btn.innerHTML.includes('Plus') || btn.innerHTML.includes('+');
              if (hasPlus) {
                btn.style.display = 'none';
              }
            }
          });
          
          // Hide plus icon buttons in sidebar
          const plusButtons = document.querySelectorAll('.sidebar button, button[class*="sidebar"]');
          plusButtons.forEach(btn => {
            const svg = btn.querySelector('svg');
            if (svg && !btn.textContent.trim()) {
              btn.style.display = 'none';
            }
          });
          
          // Hide Documentation and Settings links
          const links = document.querySelectorAll('a, button');
          links.forEach(link => {
            if (link.textContent.includes('Documentation') || 
                link.textContent.includes('Settings') ||
                link.href && link.href.includes('eliza.how')) {
              link.style.display = 'none';
            }
          });
          
          // Hide Groups headers and sections
          const allElements = document.querySelectorAll('*');
          allElements.forEach(el => {
            if (el.textContent === 'Groups' && el.tagName !== 'SCRIPT') {
              el.style.display = 'none';
              if (el.parentElement) {
                el.parentElement.style.display = 'none';
              }
            }
          });
          
          // Hide sidebar groups section
          const groupsSections = document.querySelectorAll('.sidebar-groups-section, .groups-section');
          groupsSections.forEach(el => el.style.display = 'none');
          
          // Change logo to Alice logo
          const logoImages = document.querySelectorAll('img[src*="elizaos-logo"], img[alt*="ElizaOS"], img[src*="logo"]');
          logoImages.forEach(img => {
            // Only change main logos, not avatars or profile images
            if (!img.className.includes('avatar') && 
                !img.alt.includes('avatar') && 
                !img.closest('[class*="avatar"]') &&
                !img.closest('[class*="profile"]')) {
              img.src = '/alice-logo.png';
              img.alt = 'ALICE';
            }
          });
          
          // Change agent avatar to Alice avatar
          const avatarImages = document.querySelectorAll('img[src*="elizaos-avatar"], img[src*="avatar"], img[alt*="avatar"], img[class*="avatar"]');
          avatarImages.forEach(img => {
            // Change ElizaOS avatars to Alice avatar
            if (img.src.includes('elizaos-avatar') || 
                img.src.includes('elizaos-icon') ||
                (img.className.includes('avatar') && !img.src.includes('alice-avatar'))) {
              img.src = '/alice-avatar.png';
              img.alt = 'Alice';
            }
          });
          
          console.log('Alice menu items hidden, logo and avatar updated');
        }
        
        // Run immediately and then repeatedly to catch dynamic content
        hideElements();
        setTimeout(hideElements, 1000);
        setTimeout(hideElements, 2000);
        
        // Also observe for dynamic changes
        const observer = new MutationObserver(hideElements);
        observer.observe(document.body, { childList: true, subtree: true });
      });
    </script>
    
    <script type="module" crossorigin src="/assets/index-ofROTcnX.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-BDSOQlwO.js">
    <link rel="stylesheet" crossorigin href="/assets/index-CuhlDCnv.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

fs.writeFileSync(elizaHtmlPath, patchedHtml);
console.log('ElizaOS HTML patched successfully');
console.log('Alice logo and menu hiding applied');
