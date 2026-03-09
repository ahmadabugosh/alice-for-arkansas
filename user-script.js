// ==UserScript==
// @name         Alice ElizaOS Menu Hider
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hide menu items in Alice ElizaOS interface
// @author       You
// @match        https://alice-for-arkansas-production.up.railway.app/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // Load custom CSS from our plugin route
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = '/custom-styles.css';
    document.head.appendChild(link);
    
    // Also inject styles directly for immediate effect
    const style = document.createElement('style');
    style.textContent = `
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
    `;
    document.head.appendChild(style);
    
    console.log('Alice menu items hidden');
})();
