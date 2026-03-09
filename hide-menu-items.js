// Browser script to hide menu items in ElizaOS
// You can run this in the browser console or save as a bookmarklet

javascript:(function(){
    const styles = `
        /* Hide Groups tab */
        [data-state="inactive"][value="groups"],
        [data-state="active"][value="groups"],
        button[role="tab"][value="groups"],
        .tab-groups,
        [aria-label*="Groups"],
        [title*="Groups"] {
            display: none !important;
        }

        /* Hide Documentation */
        [data-state="inactive"][value="documentation"],
        [data-state="active"][value="documentation"],
        button[role="tab"][value="documentation"],
        .tab-documentation,
        [aria-label*="Documentation"],
        [title*="Documentation"],
        a[href*="docs"] {
            display: none !important;
        }

        /* Hide Settings */
        [data-state="inactive"][value="settings"],
        [data-state="active"][value="settings"],
        button[role="tab"][value="settings"],
        .tab-settings,
        [aria-label*="Settings"],
        [title*="Settings"] {
            display: none !important;
        }

        /* Hide Create/Add buttons */
        button[aria-label*="Create"],
        button[title*="Create"],
        button[aria-label*="Add"],
        button[title*="Add"],
        .create-button,
        .add-button,
        [data-testid*="create"],
        [data-testid*="add"] {
            display: none !important;
        }

        /* Hide common UI elements that might contain these items */
        .sidebar-item:has([title*="Groups"]),
        .sidebar-item:has([title*="Documentation"]),
        .sidebar-item:has([title*="Settings"]),
        .nav-item:has([title*="Groups"]),
        .nav-item:has([title*="Documentation"]),
        .nav-item:has([title*="Settings"]) {
            display: none !important;
        }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
    
    // Also hide elements directly
    const hideSelectors = [
        '[value="groups"]',
        '[value="documentation"]', 
        '[value="settings"]',
        'button[aria-label*="Create"]',
        'button[title*="Create"]'
    ];
    
    hideSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.display = 'none';
        });
    });
    
    console.log('Menu items hidden successfully');
})();
