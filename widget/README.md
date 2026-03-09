# Alice for Arkansas - Chat Widget Integration

A complete solution for embedding the Alice AI chatbot on any website, with special WordPress plugin support.

## 📦 What's Included

### 1. Backend API (`src/services/chatApiService.ts`)
- REST API endpoints for chat functionality
- Session management
- Message history
- CORS support for cross-origin requests

### 2. Chat Widget (`widget/alice-chat-widget.js`)
- Standalone JavaScript widget
- No dependencies
- ~8KB gzipped
- Works on any website (not just WordPress)

### 3. WordPress Plugin (`wordpress-plugin/alice-for-arkansas-chat/`)
- Easy WordPress integration
- Admin settings panel
- Shortcode support
- No coding required

---

## 🚀 Quick Start

### Option A: Universal Widget (Any Website)

Add this single line before `</body>`:

```html
<script 
  src="http://localhost:3000/widget/alice-chat-widget.js"
  data-api-url="http://localhost:3000/api/chat"
  data-title="Chat with Alice"
  data-color="#4F46E5"
></script>
```

### Option B: WordPress Plugin

1. Copy `wordpress-plugin/alice-for-arkansas-chat/` to `/wp-content/plugins/`
2. Activate in WordPress admin
3. Go to **Settings > Alice Chat**
4. Configure and save!

---

## 🔧 API Endpoints

Your ElizaOS server now exposes these endpoints:

### POST `/api/chat`
Send a message and get a response.

**Request:**
```json
{
  "message": "What's the ALICE rate in Pulaski County?",
  "sessionId": "session_123",
  "domain": "example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "According to my compiled dataset, Pulaski County...",
  "sessionId": "session_123"
}
```

### GET `/api/chat/history?sessionId=session_123`
Retrieve conversation history.

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg_1",
      "text": "What's the ALICE rate?",
      "sender": "user",
      "timestamp": 1234567890
    }
  ]
}
```

### POST `/api/chat/clear`
Clear a conversation session.

**Request:**
```json
{
  "sessionId": "session_123"
}
```

---

## 🎨 Widget Customization

### Data Attributes

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-api-url` | `http://localhost:3000/api/chat` | API endpoint |
| `data-title` | `Chat with Alice` | Widget header title |
| `data-subtitle` | `Ask about Arkansas ALICE data` | Widget subtitle |
| `data-color` | `#4F46E5` | Primary color (hex) |
| `data-position` | `bottom-right` | Position on screen |

### Position Options
- `bottom-right`
- `bottom-left`
- `top-right`
- `top-left`

### Example - Custom Styling

```html
<script 
  src="http://localhost:3000/widget/alice-chat-widget.js"
  data-api-url="https://your-server.com/api/chat"
  data-title="Arkansas ALICE Assistant"
  data-subtitle="Get county data instantly"
  data-color="#DC2626"
  data-position="bottom-left"
></script>
```

---

## 📝 WordPress Plugin Usage

### Admin Settings

Navigate to **Settings > Alice Chat** in WordPress admin:

1. **Enable Widget** - Toggle on/off
2. **API URL** - Your Alice API endpoint
3. **Chat Title** - Customize header
4. **Chat Subtitle** - Customize tagline
5. **Primary Color** - Brand color picker
6. **Widget Position** - Choose corner
7. **Display On** - All pages, homepage, or posts only

### Shortcode

Place widget anywhere with:
```
[alice_chat]
```

### PHP Template

In your theme files:
```php
<?php echo do_shortcode('[alice_chat]'); ?>
```

---

## 🧪 Testing

### Test the Widget

1. Start your ElizaOS server:
```bash
npm run dev
```

2. Open the demo page:
```bash
open widget/demo.html
```

3. Click the chat button and try these queries:
- "What's the ALICE rate in Pulaski County?"
- "Tell me about Washington County"
- "What's the statewide ALICE rate?"

### Test API Endpoints

```bash
# Send a message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the ALICE rate for Arkansas?",
    "sessionId": "test_123"
  }'

# Get history
curl http://localhost:3000/api/chat/history?sessionId=test_123

# Clear session
curl -X POST http://localhost:3000/api/chat/clear \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test_123"}'
```

---

## 🚢 Deployment

### 1. Update API URL

In production, change `localhost:3000` to your actual domain:

**For widget:**
```html
data-api-url="https://api.aliceforarkansas.org/api/chat"
```

**For WordPress:**
Update API URL in Settings > Alice Chat

### 2. Serve Widget File

Option A: **From your ElizaOS server**
```html
<script src="https://api.aliceforarkansas.org/widget/alice-chat-widget.js"></script>
```

Option B: **From a CDN**
Upload `alice-chat-widget.js` to a CDN and reference it:
```html
<script src="https://cdn.example.com/alice-widget.js"></script>
```

### 3. WordPress Plugin Distribution

**Self-hosted:**
1. Zip the `alice-for-arkansas-chat` folder
2. Distribute the .zip file
3. Users install via WordPress Admin > Plugins > Add New > Upload

**WordPress.org (Future):**
Submit to wordpress.org/plugins for free distribution

---

## 🔒 Security

### CORS
The API automatically sets CORS headers to allow cross-origin requests. For production, consider restricting to specific domains:

```typescript
// In src/plugin.ts
res.setHeader('Access-Control-Allow-Origin', 'https://trusted-domain.com');
```

### Rate Limiting
Consider adding rate limiting to prevent abuse:

```typescript
// TODO: Implement rate limiting per IP or session
```

### API Keys (Future)
For multi-tenant deployments, add API key authentication.

---

## 📱 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## 🐛 Troubleshooting

### Widget doesn't appear
- Check browser console for errors
- Verify API URL is correct
- Ensure ElizaOS server is running
- Check CORS headers in Network tab

### "Cannot connect to server" error
- Verify API endpoint is accessible
- Check firewall/proxy settings
- Test API endpoint directly with curl

### Styling conflicts
- Widget uses Shadow DOM to prevent style conflicts
- If issues persist, check for CSS specificity problems

### WordPress plugin issues
- Clear WordPress cache
- Check plugin conflict (deactivate other plugins)
- Verify PHP version >= 7.2

---

## 🤝 Contributing

Found a bug or have a feature request?
1. Open an issue
2. Submit a pull request
3. Contact support@aliceforarkansas.org

---

## 📄 License

GPL v2 or later

---

## 🌟 Features Roadmap

- [ ] **WebSocket support** for real-time streaming responses
- [ ] **Multi-language support** (Spanish, etc.)
- [ ] **Voice input** integration
- [ ] **Analytics dashboard** for admin
- [ ] **Custom branding** options
- [ ] **A/B testing** capabilities
- [ ] **Export conversation** feature
- [ ] **Proactive prompts** based on page content

---

## 📞 Support

- **Website:** https://aliceforarkansas.org
- **Email:** support@aliceforarkansas.org
- **Documentation:** https://docs.aliceforarkansas.org

---

Built with ❤️ for Arkansas communities
