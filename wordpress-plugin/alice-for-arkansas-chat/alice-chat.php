<?php
/**
 * Plugin Name: Alice for Arkansas Chat
 * Plugin URI: https://aliceforarkansas.org
 * Description: Embed Alice AI chatbot on your WordPress site to provide ALICE data for Arkansas counties.
 * Version: 1.0.0
 * Author: Alice for Arkansas
 * Author URI: https://aliceforarkansas.org
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: alice-chat
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('ALICE_CHAT_VERSION', '1.0.0');
define('ALICE_CHAT_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ALICE_CHAT_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Main plugin class
 */
class Alice_Chat_Plugin {
    
    private static $instance = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
    }
    
    /**
     * Initialize WordPress hooks
     */
    private function init_hooks() {
        // Admin hooks
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        
        // Frontend hooks
        add_action('wp_footer', array($this, 'render_chat_widget'));
        
        // Shortcode
        add_shortcode('alice_chat', array($this, 'chat_shortcode'));
        
        // Plugin activation/deactivation
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            'Alice Chat Settings',
            'Alice Chat',
            'manage_options',
            'alice-chat-settings',
            array($this, 'render_settings_page')
        );
    }
    
    /**
     * Register plugin settings
     */
    public function register_settings() {
        // Register settings
        register_setting('alice_chat_settings', 'alice_chat_api_url', array(
            'type' => 'string',
            'default' => 'http://localhost:3000/api/chat',
            'sanitize_callback' => 'esc_url_raw'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_enabled', array(
            'type' => 'boolean',
            'default' => true
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_title', array(
            'type' => 'string',
            'default' => 'Chat with Alice',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_subtitle', array(
            'type' => 'string',
            'default' => 'Ask about Arkansas ALICE data',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_color', array(
            'type' => 'string',
            'default' => '#1d4c4b',
            'sanitize_callback' => 'sanitize_hex_color'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_position', array(
            'type' => 'string',
            'default' => 'bottom-right',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_pages', array(
            'type' => 'string',
            'default' => 'all',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_avatar', array(
            'type' => 'string',
            'default' => '',
            'sanitize_callback' => 'esc_url_raw'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_placeholder', array(
            'type' => 'string',
            'default' => 'Type your message...',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_show_popup', array(
            'type' => 'boolean',
            'default' => false
        ));
        
        register_setting('alice_chat_settings', 'alice_chat_popup_text', array(
            'type' => 'string',
            'default' => 'Chat with Alice',
            'sanitize_callback' => 'sanitize_text_field'
        ));
        
        // Add settings sections
        add_settings_section(
            'alice_chat_main_section',
            'Main Settings',
            array($this, 'render_section_description'),
            'alice-chat-settings'
        );
        
        // Add settings fields
        add_settings_field(
            'alice_chat_enabled',
            'Enable Chat Widget',
            array($this, 'render_enabled_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_api_url',
            'API URL',
            array($this, 'render_api_url_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_title',
            'Chat Title',
            array($this, 'render_title_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_subtitle',
            'Chat Subtitle',
            array($this, 'render_subtitle_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_color',
            'Primary Color',
            array($this, 'render_color_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_position',
            'Widget Position',
            array($this, 'render_position_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_pages',
            'Display On',
            array($this, 'render_pages_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_avatar',
            'Avatar Image',
            array($this, 'render_avatar_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_placeholder',
            'Input Placeholder',
            array($this, 'render_placeholder_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_show_popup',
            'Show Popup Notification',
            array($this, 'render_show_popup_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
        
        add_settings_field(
            'alice_chat_popup_text',
            'Popup Text',
            array($this, 'render_popup_text_field'),
            'alice-chat-settings',
            'alice_chat_main_section'
        );
    }
    
    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        
        // Check if settings updated
        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'alice_chat_messages',
                'alice_chat_message',
                'Settings Saved',
                'updated'
            );
        }
        
        settings_errors('alice_chat_messages');
        
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <div class="notice notice-info">
                <p>
                    <strong>📚 Quick Start:</strong> 
                    Enable the widget below and configure your API URL. 
                    The chat widget will automatically appear on your site.
                </p>
            </div>
            
            <form action="options.php" method="post">
                <?php
                settings_fields('alice_chat_settings');
                do_settings_sections('alice-chat-settings');
                submit_button('Save Settings');
                ?>
            </form>
            
            <hr style="margin: 40px 0;">
            
            <h2>📖 Usage</h2>
            <div class="card" style="max-width: none;">
                <h3>Automatic Display</h3>
                <p>The chat widget will automatically appear on your site when enabled.</p>
                
                <h3 style="margin-top: 20px;">Manual Placement with Shortcode</h3>
                <p>Use this shortcode to manually place the chat widget:</p>
                <code style="background: #f0f0f1; padding: 8px 12px; border-radius: 4px; display: inline-block;">[alice_chat]</code>
                
                <h3 style="margin-top: 20px;">PHP Template</h3>
                <p>Add this to your theme files:</p>
                <code style="background: #f0f0f1; padding: 8px 12px; border-radius: 4px; display: inline-block;">&lt;?php echo do_shortcode('[alice_chat]'); ?&gt;</code>
            </div>
            
            <hr style="margin: 40px 0;">
            
            <div class="card" style="max-width: none; background: #fef3c7; border-left: 4px solid #f59e0b;">
                <h3>🔗 Need Help?</h3>
                <p>
                    Visit <a href="https://aliceforarkansas.org" target="_blank">aliceforarkansas.org</a> 
                    for documentation and support.
                </p>
            </div>
        </div>
        <?php
    }
    
    /**
     * Render section description
     */
    public function render_section_description() {
        echo '<p>Configure your Alice chat widget settings below.</p>';
    }
    
    /**
     * Render enabled field
     */
    public function render_enabled_field() {
        $enabled = get_option('alice_chat_enabled', true);
        ?>
        <label>
            <input type="checkbox" name="alice_chat_enabled" value="1" <?php checked($enabled, true); ?> />
            Enable the chat widget on your site
        </label>
        <?php
    }
    
    /**
     * Render API URL field
     */
    public function render_api_url_field() {
        $api_url = get_option('alice_chat_api_url', 'http://localhost:3000/api/chat');
        ?>
        <input type="url" 
               name="alice_chat_api_url" 
               value="<?php echo esc_attr($api_url); ?>" 
               class="regular-text" 
               placeholder="https://your-server.com/api/chat" />
        <p class="description">The URL of your Alice API endpoint</p>
        <?php
    }
    
    /**
     * Render title field
     */
    public function render_title_field() {
        $title = get_option('alice_chat_title', 'Chat with Alice');
        ?>
        <input type="text" 
               name="alice_chat_title" 
               value="<?php echo esc_attr($title); ?>" 
               class="regular-text" />
        <?php
    }
    
    /**
     * Render subtitle field
     */
    public function render_subtitle_field() {
        $subtitle = get_option('alice_chat_subtitle', 'Ask about Arkansas ALICE data');
        ?>
        <input type="text" 
               name="alice_chat_subtitle" 
               value="<?php echo esc_attr($subtitle); ?>" 
               class="regular-text" />
        <?php
    }
    
    /**
     * Render color field
     */
    public function render_color_field() {
        $color = get_option('alice_chat_color', '#1d4c4b');
        ?>
        <input type="text" 
               name="alice_chat_color" 
               value="<?php echo esc_attr($color); ?>" 
               class="alice-color-picker" />
        <script>
            jQuery(document).ready(function($) {
                $('.alice-color-picker').wpColorPicker();
            });
        </script>
        <?php
    }
    
    /**
     * Render position field
     */
    public function render_position_field() {
        $position = get_option('alice_chat_position', 'bottom-right');
        $positions = array(
            'bottom-right' => 'Bottom Right',
            'bottom-left' => 'Bottom Left',
            'top-right' => 'Top Right',
            'top-left' => 'Top Left'
        );
        ?>
        <select name="alice_chat_position">
            <?php foreach ($positions as $value => $label): ?>
                <option value="<?php echo esc_attr($value); ?>" <?php selected($position, $value); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <?php
    }
    
    /**
     * Render pages field
     */
    public function render_pages_field() {
        $pages = get_option('alice_chat_pages', 'all');
        ?>
        <label>
            <input type="radio" name="alice_chat_pages" value="all" <?php checked($pages, 'all'); ?> />
            All pages
        </label><br>
        <label>
            <input type="radio" name="alice_chat_pages" value="homepage" <?php checked($pages, 'homepage'); ?> />
            Homepage only
        </label><br>
        <label>
            <input type="radio" name="alice_chat_pages" value="posts" <?php checked($pages, 'posts'); ?> />
            Posts only
        </label>
        <?php
    }
    
    /**
     * Render avatar field
     */
    public function render_avatar_field() {
        $avatar = get_option('alice_chat_avatar', '');
        ?>
        <div class="alice-avatar-upload">
            <input type="hidden" id="alice_chat_avatar" name="alice_chat_avatar" value="<?php echo esc_attr($avatar); ?>" />
            <div class="alice-avatar-preview" style="margin-bottom: 10px;">
                <?php if ($avatar): ?>
                    <img src="<?php echo esc_url($avatar); ?>" style="max-width: 100px; height: auto; border-radius: 50%;" />
                <?php else: ?>
                    <div style="width: 100px; height: 100px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 40px;">🤖</div>
                <?php endif; ?>
            </div>
            <button type="button" class="button alice-upload-avatar-button">Upload Avatar</button>
            <?php if ($avatar): ?>
                <button type="button" class="button alice-remove-avatar-button">Remove Avatar</button>
            <?php endif; ?>
            <p class="description">Upload a custom avatar image for the chat bot. Recommended size: 100x100px</p>
        </div>
        <?php
    }
    
    /**
     * Render placeholder field
     */
    public function render_placeholder_field() {
        $placeholder = get_option('alice_chat_placeholder', 'Type your message...');
        ?>
        <input type="text" 
               name="alice_chat_placeholder" 
               value="<?php echo esc_attr($placeholder); ?>" 
               class="regular-text" 
               placeholder="Type your message..." />
        <p class="description">The placeholder text shown in the message input box</p>
        <?php
    }
    
    /**
     * Render show popup field
     */
    public function render_show_popup_field() {
        $show_popup = get_option('alice_chat_show_popup', false);
        ?>
        <label>
            <input type="checkbox" name="alice_chat_show_popup" value="1" <?php checked($show_popup, true); ?> />
            Show a dismissible popup notification above the chat button
        </label>
        <?php
    }
    
    /**
     * Render popup text field
     */
    public function render_popup_text_field() {
        $popup_text = get_option('alice_chat_popup_text', 'Chat with Alice');
        ?>
        <input type="text" 
               name="alice_chat_popup_text" 
               value="<?php echo esc_attr($popup_text); ?>" 
               class="regular-text" 
               placeholder="Chat with Alice" />
        <p class="description">The text shown in the popup notification</p>
        <?php
    }
    
    /**
     * Enqueue admin scripts
     */
    public function enqueue_admin_scripts($hook) {
        if ($hook !== 'settings_page_alice-chat-settings') {
            return;
        }
        
        wp_enqueue_media();
        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('wp-color-picker');
        
        wp_add_inline_script('wp-color-picker', '
            jQuery(document).ready(function($) {
                // Avatar upload
                var mediaUploader;
                $(".alice-upload-avatar-button").on("click", function(e) {
                    e.preventDefault();
                    if (mediaUploader) {
                        mediaUploader.open();
                        return;
                    }
                    mediaUploader = wp.media({
                        title: "Choose Avatar Image",
                        button: { text: "Use this image" },
                        multiple: false
                    });
                    mediaUploader.on("select", function() {
                        var attachment = mediaUploader.state().get("selection").first().toJSON();
                        $("#alice_chat_avatar").val(attachment.url);
                        $(".alice-avatar-preview").html("<img src=\"" + attachment.url + "\" style=\"max-width: 100px; height: auto; border-radius: 50%;\" />");
                        if (!$(".alice-remove-avatar-button").length) {
                            $(".alice-upload-avatar-button").after("<button type=\"button\" class=\"button alice-remove-avatar-button\">Remove Avatar</button>");
                        }
                    });
                    mediaUploader.open();
                });
                
                // Avatar remove
                $(document).on("click", ".alice-remove-avatar-button", function(e) {
                    e.preventDefault();
                    $("#alice_chat_avatar").val("");
                    $(".alice-avatar-preview").html("<div style=\"width: 100px; height: 100px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 40px;\">🤖</div>");
                    $(".alice-remove-avatar-button").remove();
                });
            });
        ');
    }
    
    /**
     * Render chat widget on frontend
     */
    public function render_chat_widget() {
        // Check if enabled
        if (!get_option('alice_chat_enabled', true)) {
            return;
        }
        
        // Check page conditions
        $pages = get_option('alice_chat_pages', 'all');
        if ($pages === 'homepage' && !is_front_page()) {
            return;
        }
        if ($pages === 'posts' && !is_single()) {
            return;
        }
        
        $this->output_widget_script();
    }
    
    /**
     * Chat shortcode
     */
    public function chat_shortcode($atts) {
        ob_start();
        $this->output_widget_script();
        return ob_get_clean();
    }
    
    /**
     * Output widget script
     */
    private function output_widget_script() {
        $api_url = esc_js(get_option('alice_chat_api_url', 'http://localhost:3000/api/chat'));
        $title = esc_js(get_option('alice_chat_title', 'Chat with Alice'));
        $subtitle = esc_js(get_option('alice_chat_subtitle', 'Ask about Arkansas ALICE data'));
        $color = esc_js(get_option('alice_chat_color', '#1d4c4b'));
        $position = esc_js(get_option('alice_chat_position', 'bottom-right'));
        $avatar = esc_js(get_option('alice_chat_avatar', ''));
        $placeholder = esc_js(get_option('alice_chat_placeholder', 'Type your message...'));
        $show_popup = get_option('alice_chat_show_popup', true) ? 'true' : 'false';
        $popup_text = esc_js(get_option('alice_chat_popup_text', 'Chat with Alice'));
        
        // The widget is served by the same Alice server as the chat API:
        // derive its URL from the API origin (strip the /api/chat suffix)
        // instead of relying on dot-segment path resolution.
        $server_origin = preg_replace('#/api/chat/?$#', '', $api_url);

        // Output the widget script
        ?>
        <script
            src="<?php echo esc_url($server_origin); ?>/widget/alice-chat-widget.js"
            data-api-url="<?php echo $api_url; ?>"
            data-title="<?php echo $title; ?>"
            data-subtitle="<?php echo $subtitle; ?>"
            data-color="<?php echo $color; ?>"
            data-position="<?php echo $position; ?>"
            data-avatar="<?php echo $avatar; ?>"
            data-placeholder="<?php echo $placeholder; ?>"
            data-show-popup="<?php echo $show_popup; ?>"
            data-popup-text="<?php echo $popup_text; ?>"
        ></script>
        <?php
    }
    
    /**
     * Plugin activation
     */
    public function activate() {
        // Set default options
        add_option('alice_chat_enabled', true);
        add_option('alice_chat_api_url', 'http://localhost:3000/api/chat');
        add_option('alice_chat_title', 'Chat with Alice');
        add_option('alice_chat_subtitle', 'Ask about Arkansas ALICE data');
        add_option('alice_chat_color', '#1d4c4b');
        add_option('alice_chat_position', 'bottom-right');
        add_option('alice_chat_pages', 'all');
        add_option('alice_chat_avatar', '');
        add_option('alice_chat_placeholder', 'Type your message...');
        add_option('alice_chat_show_popup', false);
        add_option('alice_chat_popup_text', 'Chat with Alice');
    }
    
    /**
     * Plugin deactivation
     */
    public function deactivate() {
        // Clean up if needed
    }
}

// Initialize plugin
Alice_Chat_Plugin::get_instance();
