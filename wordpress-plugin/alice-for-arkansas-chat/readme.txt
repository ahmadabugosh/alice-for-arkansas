=== Alice for Arkansas Chat ===
Contributors: aliceforarkansas
Tags: chatbot, alice, arkansas, data, ai
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed Alice AI chatbot on your WordPress site to provide ALICE data for Arkansas counties.

== Description ==

Alice for Arkansas Chat is a powerful WordPress plugin that adds an AI-powered chatbot to your website. Alice provides accurate, data-driven information about ALICE (Asset Limited, Income Constrained, Employed) statistics for Arkansas counties.

= Features =

* 🤖 **AI-Powered Responses** - Get accurate ALICE data instantly
* 💬 **Real-time Chat** - Smooth, responsive chat experience
* 🎨 **Customizable** - Match your brand colors and style
* 📱 **Mobile Responsive** - Works perfectly on all devices
* ⚡ **Lightweight** - Fast loading, no performance impact
* 🔒 **Privacy Focused** - Conversations stored locally
* 🎯 **Easy Setup** - Configure in minutes

= What is ALICE? =

ALICE (Asset Limited, Income Constrained, Employed) represents households that earn above the Federal Poverty Level but below the actual cost of living. This plugin provides access to comprehensive ALICE data for all Arkansas counties.

= Example Questions =

* "What's the ALICE rate in Pulaski County?"
* "Tell me about Washington County demographics"
* "What's the statewide ALICE rate for Arkansas?"
* "Compare Benton and Sebastian counties"

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/alice-for-arkansas-chat`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > Alice Chat to configure
4. Enter your Alice API URL
5. Customize appearance and behavior
6. Save settings and visit your site!

= Quick Start =

1. Install and activate the plugin
2. Configure your API URL in Settings > Alice Chat
3. The chat widget will automatically appear on your site
4. Customize colors, position, and display rules as needed

== Frequently Asked Questions ==

= Do I need an API key? =

Yes, you need access to an Alice API server. Contact aliceforarkansas.org for setup assistance.

= Can I customize the widget appearance? =

Yes! You can customize the title, colors, position, and more through the settings page.

= Will this slow down my website? =

No, the widget is lightweight (~8KB) and loads asynchronously without impacting page speed.

= Can I control where the widget appears? =

Yes, you can choose to display it on all pages, homepage only, or posts only. You can also use the shortcode for manual placement.

= How do I use the shortcode? =

Use `[alice_chat]` in any post, page, or widget area to manually place the chat widget.

= Is mobile responsive? =

Yes, the widget automatically adapts to mobile devices for the best user experience.

== Screenshots ==

1. Chat widget in action on a WordPress site
2. Admin settings page with customization options
3. Mobile responsive design
4. Example conversation about county data

== Changelog ==

= 1.0.0 =
* Initial release
* Real-time chat functionality
* Customizable appearance
* Admin settings panel
* Shortcode support
* Mobile responsive design

== Upgrade Notice ==

= 1.0.0 =
Initial release of Alice for Arkansas Chat.

== Configuration ==

After activation, go to **Settings > Alice Chat** to configure:

* **API URL** - Your Alice API endpoint (required)
* **Enable/Disable** - Toggle the widget on/off
* **Chat Title** - Customize the header title
* **Chat Subtitle** - Set a subtitle/tagline
* **Primary Color** - Match your brand color
* **Position** - Choose corner placement
* **Display On** - Control which pages show the widget

== Usage ==

**Automatic Display:**
The widget automatically appears based on your settings.

**Shortcode:**
Use `[alice_chat]` to manually place the widget.

**PHP Template:**
```php
<?php echo do_shortcode('[alice_chat]'); ?>
```

== Support ==

For support, documentation, and API access:
Visit: https://aliceforarkansas.org
Email: support@aliceforarkansas.org

== Privacy ==

This plugin stores conversation history locally in the user's browser using localStorage. No personal data is transmitted to third parties except the Alice API server for processing queries.

== Credits ==

Powered by ElizaOS and built to serve Arkansas communities.
