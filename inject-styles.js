// Inject custom styles to hide menu items in ElizaOS interface
(function() {
    const customStyles = `
        /* Hide the Groups tab in ElizaOS interface */
        [data-state="inactive"][value="groups"],
        [data-state="active"][value="groups"] {
            display: none !important;
        }

        /* Hide Groups section in sidebar if it exists */
        .sidebar-groups-section,
        .groups-section {
            display: none !important;
        }

        /* Hide Documentation menu item */
        [data-state="inactive"][value="documentation"],
        [data-state="active"][value="documentation"],
        a[href*="documentation"],
        .documentation-link,
        .docs-link {
            display: none !important;
        }

        /* Hide Create New Button */
        .create-button,
        .create-new-button,
        button[aria-label*="Create"],
        button[title*="Create"],
        [data-testid*="create"],
        .add-button,
        .new-button {
            display: none !important;
        }

        /* Hide Settings menu item */
        [data-state="inactive"][value="settings"],
        [data-state="active"][value="settings"],
        .settings-button,
        .settings-link,
        a[href*="settings"],
        button[aria-label*="Settings"],
        button[title*="Settings"] {
            display: none !important;
        }

        /* Adjust tab container spacing after hiding tabs */
        .tabs-list {
            gap: 0.5rem;
        }
    `;

    // Create and inject style element
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);

    // Also try to hide elements that might load dynamically
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Re-apply styles to any new elements
                const groupsTabs = document.querySelectorAll('[data-state][value="groups"]');
                const docTabs = document.querySelectorAll('[data-state][value="documentation"]');
                const settingsTabs = document.querySelectorAll('[data-state][value="settings"]');
                const createButtons = document.querySelectorAll('button[aria-label*="Create"], button[title*="Create"]');
                
                [...groupsTabs, ...docTabs, ...settingsTabs, ...createButtons].forEach(el => {
                    el.style.display = 'none';
                });
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Custom ElizaOS styles injected successfully');
})();
