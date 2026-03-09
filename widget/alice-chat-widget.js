/**
 * Alice Chat Widget
 * Embeddable chat interface for Alice for Arkansas
 */
(function() {
  'use strict';

  // Configuration
  const DEFAULT_CONFIG = {
    apiUrl: 'http://localhost:3000/api/chat',
    title: 'Chat with Alice',
    subtitle: 'Ask me about ALICE data in Arkansas',
    primaryColor: '#1d4c4b',
    position: 'bottom-right',
    avatar: '',
    placeholder: 'Type your message...',
    showPopup: true,
    popupText: 'Chat with Alice',
    initialMessage: 'Hi! I\'m Alice. I can help you with ALICE (Asset Limited, Income Constrained, Employed) data for Arkansas. Ask me about county statistics, demographics, employment sectors, trends, or what ALICE means!'
  };

  class AliceChatWidget {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.sessionId = this.getOrCreateSessionId();
      this.isOpen = false;
      this.messages = this.loadMessages();
      
      this.init();
    }

    init() {
      this.injectStyles();
      this.createWidget();
      this.attachEventListeners();
      
      // Show initial message if no messages exist
      if (this.messages.length === 0 && this.config.initialMessage) {
        this.addMessage(this.config.initialMessage, 'agent');
      }
      
      // Show popup notification if enabled
      if (this.config.showPopup && !localStorage.getItem('alice_popup_dismissed')) {
        this.showPopupNotification();
      }
    }

    getOrCreateSessionId() {
      let sessionId = localStorage.getItem('alice_chat_session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('alice_chat_session_id', sessionId);
      }
      return sessionId;
    }

    loadMessages() {
      try {
        const saved = localStorage.getItem('alice_chat_messages');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }

    saveMessages() {
      try {
        localStorage.setItem('alice_chat_messages', JSON.stringify(this.messages));
      } catch (e) {
        console.error('Failed to save messages:', e);
      }
    }

    injectStyles() {
      if (document.getElementById('alice-chat-styles')) return;

      const style = document.createElement('style');
      style.id = 'alice-chat-styles';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        .alice-chat-widget {
          font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          position: fixed;
          ${this.config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
          ${this.config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
          z-index: 999999;
        }

        .alice-chat-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .alice-chat-button.hidden {
          display: none;
        }

        .alice-chat-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .alice-chat-button svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        .alice-chat-window {
          display: none;
          flex-direction: column;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 100px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          overflow: hidden;
        }

        .alice-chat-window.open {
          display: flex;
        }

        .alice-chat-header {
          background: ${this.config.primaryColor};
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .alice-chat-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .alice-chat-expand,
        .alice-chat-minimize,
        .alice-chat-reset,
        .alice-chat-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          font-size: 20px;
          line-height: 1;
          opacity: 0.9;
        }
        
        .alice-chat-expand:hover,
        .alice-chat-minimize:hover,
        .alice-chat-reset:hover,
        .alice-chat-close:hover {
          opacity: 1;
        }

        .alice-chat-header-text h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }

        .alice-chat-header-text p {
          margin: 4px 0 0 0;
          font-size: 13px;
          opacity: 0.9;
        }


        .alice-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f9fafb;
        }

        .alice-chat-message {
          display: flex;
          gap: 8px;
          max-width: 80%;
        }

        .alice-chat-message.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .alice-chat-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
          overflow: hidden;
        }
        
        .alice-chat-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .alice-chat-message.agent .alice-chat-message-avatar {
          background: ${this.config.primaryColor};
          color: white;
        }

        .alice-chat-message.user .alice-chat-message-avatar {
          background: #e5e7eb;
          color: #374151;
        }

        .alice-chat-message-bubble {
          padding: 10px 14px;
          border-radius: 12px;
          word-wrap: break-word;
          line-height: 1.5;
        }

        .alice-chat-message.agent .alice-chat-message-bubble {
          background: #24b7a5;
          color: white;
          border: none;
        }

        .alice-chat-message.user .alice-chat-message-bubble {
          background: ${this.config.primaryColor};
          color: white;
        }

        .alice-chat-input-container {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background: white;
        }

        .alice-chat-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .alice-chat-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
        }

        .alice-chat-input:focus {
          border-color: ${this.config.primaryColor};
        }

        .alice-chat-send {
          padding: 10px 18px;
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: opacity 0.2s;
        }

        .alice-chat-send:hover:not(:disabled) {
          opacity: 0.9;
        }

        .alice-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .alice-chat-typing {
          display: flex;
          gap: 4px;
          padding: 10px 14px;
        }

        .alice-chat-typing span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9ca3af;
          animation: alice-typing 1.4s infinite;
        }

        .alice-chat-typing span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .alice-chat-typing span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes alice-typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .alice-chat-popup {
          position: absolute;
          ${this.config.position.includes('right') ? 'right: 70px;' : 'left: 70px;'}
          ${this.config.position.includes('bottom') ? 'bottom: 15px;' : 'top: 15px;'}
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 250px;
          animation: alice-popup-slide 0.3s ease-out;
        }
        
        .alice-chat-popup-text {
          flex: 1;
          font-size: 14px;
          color: #1f2937;
          font-weight: 500;
        }
        
        .alice-chat-popup-close {
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          font-size: 18px;
          line-height: 1;
          flex-shrink: 0;
        }
        
        .alice-chat-popup-close:hover {
          color: #4b5563;
        }
        
        @keyframes alice-popup-slide {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 480px) {
          .alice-chat-window {
            width: calc(100vw - 40px);
            height: calc(100vh - 100px);
          }
          
          .alice-chat-popup {
            max-width: 200px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    createWidget() {
      const container = document.createElement('div');
      container.className = 'alice-chat-widget';
      container.innerHTML = `
        <button class="alice-chat-button" aria-label="Open chat">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </button>
        <div class="alice-chat-window">
          <div class="alice-chat-header">
            <div class="alice-chat-header-text">
              <h3>${this.config.title}</h3>
              <p>${this.config.subtitle}</p>
            </div>
            <div class="alice-chat-header-actions">
              <button class="alice-chat-reset" aria-label="Reset chat" title="Clear conversation">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                  <path d="M3 21v-5h5"></path>
                </svg>
              </button>
              <button class="alice-chat-expand" aria-label="Expand to new window" title="Open in new window">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              <button class="alice-chat-minimize" aria-label="Minimize chat" title="Minimize">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              <button class="alice-chat-close" aria-label="Close chat">&times;</button>
            </div>
          </div>
          <div class="alice-chat-messages"></div>
          <div class="alice-chat-input-container">
            <div class="alice-chat-input-wrapper">
              <input type="text" class="alice-chat-input" placeholder="${this.escapeHtml(this.config.placeholder)}" />
              <button class="alice-chat-send">Send</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      this.container = container;
      this.elements = {
        button: container.querySelector('.alice-chat-button'),
        window: container.querySelector('.alice-chat-window'),
        resetButton: container.querySelector('.alice-chat-reset'),
        expandButton: container.querySelector('.alice-chat-expand'),
        minimizeButton: container.querySelector('.alice-chat-minimize'),
        closeButton: container.querySelector('.alice-chat-close'),
        messages: container.querySelector('.alice-chat-messages'),
        input: container.querySelector('.alice-chat-input'),
        sendButton: container.querySelector('.alice-chat-send')
      };

      // Render existing messages
      this.messages.forEach(msg => this.renderMessage(msg.text, msg.sender, false));
    }

    attachEventListeners() {
      this.elements.button.addEventListener('click', () => this.toggleChat());
      this.elements.closeButton.addEventListener('click', () => this.toggleChat());
      this.elements.minimizeButton.addEventListener('click', () => this.toggleChat());
      this.elements.resetButton.addEventListener('click', () => this.resetChat());
      this.elements.expandButton.addEventListener('click', () => this.expandToNewWindow());
      this.elements.sendButton.addEventListener('click', () => this.sendMessage());
      this.elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.sendMessage();
      });
    }
    
    resetChat() {
      // Clear messages array
      this.messages = [];
      
      // Clear the messages container
      this.elements.messages.innerHTML = '';
      
      // Add welcome message back
      this.addMessage(this.config.initialMessage, 'agent');
      
      // Save the reset state
      this.saveMessages();
      
      // Clear input field
      this.elements.input.value = '';
      
      // Scroll to show welcome message
      requestAnimationFrame(() => {
        const firstMessage = this.elements.messages.querySelector('.alice-chat-message');
        if (firstMessage) {
          firstMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
    
    showPopupNotification() {
      const popup = document.createElement('div');
      popup.className = 'alice-chat-popup';
      popup.innerHTML = `
        <div class="alice-chat-popup-text">${this.escapeHtml(this.config.popupText)}</div>
        <button class="alice-chat-popup-close" aria-label="Dismiss">&times;</button>
      `;
      
      this.container.appendChild(popup);
      
      const closeBtn = popup.querySelector('.alice-chat-popup-close');
      closeBtn.addEventListener('click', () => {
        popup.remove();
        localStorage.setItem('alice_popup_dismissed', 'true');
      });
      
      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        if (popup.parentNode) {
          popup.remove();
          localStorage.setItem('alice_popup_dismissed', 'true');
        }
      }, 10000);
    }
    
    expandToNewWindow() {
      // Create a new window with the chat interface
      const width = 400;
      const height = 650;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      
      const newWindow = window.open(
        '',
        'AliceChatWindow',
        'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes'
      );
      
      if (!newWindow) {
        alert('Please allow popups to open chat in a new window');
        return;
      }
      
      // Helper to safely escape text for HTML
      const safeText = (text) => {
        return String(text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
      
      // Pre-escape all values
      const safeTitle = safeText(this.config.title);
      const safeSubtitle = safeText(this.config.subtitle);
      const safePlaceholder = safeText(this.config.placeholder);
      const safeColor = this.config.primaryColor;
      const safeAvatar = this.config.avatar || '';
      const safeSessionId = this.sessionId;
      
      // Safely serialize config and messages for script
      const configStr = JSON.stringify(this.config);
      const messagesStr = JSON.stringify(this.messages);
      
      // Build HTML string without template literals
      const html = '<!DOCTYPE html>' +
        '<html>' +
        '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>' + safeTitle + '</title>' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; height: 100vh; display: flex; flex-direction: column; background: #f9fafb; }' +
        '.chat-header { background: ' + safeColor + '; color: white; padding: 16px 20px; }' +
        '.chat-header h3 { font-size: 18px; font-weight: 600; margin: 0; color: white; }' +
        '.chat-header p { font-size: 13px; opacity: 0.9; margin: 4px 0 0 0; }' +
        '.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }' +
        '.chat-message { display: flex; gap: 8px; max-width: 80%; }' +
        '.chat-message.user { align-self: flex-end; flex-direction: row-reverse; }' +
        '.chat-message-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; overflow: hidden; }' +
        '.chat-message-avatar img { width: 100%; height: 100%; object-fit: cover; }' +
        '.chat-message.agent .chat-message-avatar { background: ' + safeColor + '; color: white; }' +
        '.chat-message.user .chat-message-avatar { background: #e5e7eb; color: #374151; }' +
        '.chat-message-bubble { padding: 10px 14px; border-radius: 12px; word-wrap: break-word; line-height: 1.5; }' +
        '.chat-message.agent .chat-message-bubble { background: white; color: #1f2937; border: 1px solid #e5e7eb; }' +
        '.chat-message.user .chat-message-bubble { background: ' + safeColor + '; color: white; }' +
        '.chat-input-container { padding: 16px; border-top: 1px solid #e5e7eb; background: white; }' +
        '.chat-input-wrapper { display: flex; gap: 8px; }' +
        '.chat-input { flex: 1; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; font-family: inherit; }' +
        '.chat-input:focus { border-color: ' + safeColor + '; }' +
        '.chat-send { padding: 10px 18px; background: ' + safeColor + '; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; }' +
        '.chat-send:hover:not(:disabled) { opacity: 0.9; }' +
        '.chat-send:disabled { opacity: 0.5; cursor: not-allowed; }' +
        '</style>' +
        '</head>' +
        '<body>' +
        '<div class="chat-header">' +
        '<h3>' + safeTitle + '</h3>' +
        '<p>' + safeSubtitle + '</p>' +
        '</div>' +
        '<div class="chat-messages" id="messages"></div>' +
        '<div class="chat-input-container">' +
        '<div class="chat-input-wrapper">' +
        '<input type="text" class="chat-input" id="input" placeholder="' + safePlaceholder + '" />' +
        '<button class="chat-send" id="send">Send</button>' +
        '</div>' +
        '</div>' +
        '<script>' +
        'var config = ' + configStr + ';' +
        'var sessionId = "' + safeSessionId + '";' +
        'var messages = ' + messagesStr + ';' +
        'var messagesEl = document.getElementById("messages");' +
        'var inputEl = document.getElementById("input");' +
        'var sendBtn = document.getElementById("send");' +
        'function escapeHtml(text) {' +
        '  var div = document.createElement("div");' +
        '  div.textContent = text;' +
        '  return div.innerHTML.replace(/\\n/g, "<br>");' +
        '}' +
        'function getAvatarHtml(sender) {' +
        '  if (sender === "agent") {' +
        '    return config.avatar ? "<img src=\\"" + config.avatar + "\\" alt=\\"Alice\\" />" : "🤖";' +
        '  }' +
        '  return "👤";' +
        '}' +
        'function renderMessage(text, sender) {' +
        '  var div = document.createElement("div");' +
        '  div.className = "chat-message " + sender;' +
        '  div.innerHTML = "<div class=\\"chat-message-avatar\\">" + getAvatarHtml(sender) + "</div>" + "<div class=\\"chat-message-bubble\\">" + escapeHtml(text) + "</div>";' +
        '  messagesEl.appendChild(div);' +
        '  messagesEl.scrollTop = messagesEl.scrollHeight;' +
        '}' +
        'messages.forEach(function(msg) { renderMessage(msg.text, msg.sender); });' +
        'function sendMessage() {' +
        '  var text = inputEl.value.trim();' +
        '  if (!text) return;' +
        '  inputEl.value = "";' +
        '  inputEl.disabled = true;' +
        '  sendBtn.disabled = true;' +
        '  renderMessage(text, "user");' +
        '  fetch(config.apiUrl, {' +
        '    method: "POST",' +
        '    headers: { "Content-Type": "application/json" },' +
        '    body: JSON.stringify({ message: text, sessionId: sessionId })' +
        '  }).then(function(response) { return response.json(); })' +
        '  .then(function(data) {' +
        '    if (data.success && data.message) {' +
        '      renderMessage(data.message, "agent");' +
        '    } else {' +
        '      renderMessage("Sorry, I encountered an error.", "agent");' +
        '    }' +
        '  }).catch(function(error) {' +
        '    renderMessage("Sorry, I could not connect to the server.", "agent");' +
        '  }).finally(function() {' +
        '    inputEl.disabled = false;' +
        '    sendBtn.disabled = false;' +
        '    inputEl.focus();' +
        '  });' +
        '}' +
        'sendBtn.addEventListener("click", sendMessage);' +
        'inputEl.addEventListener("keypress", function(e) {' +
        '  if (e.key === "Enter") sendMessage();' +
        '});' +
        'inputEl.focus();' +
        '<\/script>' +
        '</body>' +
        '</html>';
      
      // Write the chat interface to the new window
      newWindow.document.write(html);
      newWindow.document.close();
    }

    toggleChat() {
      this.isOpen = !this.isOpen;
      this.elements.window.classList.toggle('open', this.isOpen);
      this.elements.button.classList.toggle('hidden', this.isOpen);
      
      if (this.isOpen) {
        this.elements.input.focus();
        
        // If there's only the welcome message, scroll to show its top
        // Otherwise scroll to bottom to show latest messages
        if (this.messages.length === 1) {
          requestAnimationFrame(() => {
            const firstMessage = this.elements.messages.querySelector('.alice-chat-message');
            if (firstMessage) {
              firstMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
        } else {
          this.scrollToBottom();
        }
      }
    }

    async sendMessage() {
      const text = this.elements.input.value.trim();
      if (!text) return;

      // Disable input
      this.elements.input.value = '';
      this.elements.input.disabled = true;
      this.elements.sendButton.disabled = true;

      // Add user message
      this.addMessage(text, 'user');

      // Show typing indicator
      this.showTyping();

      try {
        const response = await fetch(this.config.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: text,
            sessionId: this.sessionId,
            domain: window.location.hostname
          })
        });

        const data = await response.json();
        
        this.hideTyping();

        if (data.success && data.message) {
          this.addMessage(data.message, 'agent');
        } else {
          this.addMessage('Sorry, I encountered an error. Please try again.', 'agent');
        }
      } catch (error) {
        console.error('Chat error:', error);
        this.hideTyping();
        this.addMessage('Sorry, I couldn\'t connect to the server. Please check your connection and try again.', 'agent');
      } finally {
        this.elements.input.disabled = false;
        this.elements.sendButton.disabled = false;
        this.elements.input.focus();
      }
    }

    addMessage(text, sender) {
      const message = { text, sender, timestamp: Date.now() };
      this.messages.push(message);
      this.saveMessages();
      this.renderMessage(text, sender);
    }

    renderMessage(text, sender, scroll = true) {
      const messageDiv = document.createElement('div');
      messageDiv.className = `alice-chat-message ${sender}`;
      
      let avatarHtml;
      if (sender === 'agent' && this.config.avatar) {
        avatarHtml = `<img src="${this.escapeHtml(this.config.avatar)}" alt="Alice" />`;
      } else {
        const avatar = sender === 'agent' ? '🤖' : '👤';
        avatarHtml = avatar;
      }
      
      messageDiv.innerHTML = `
        <div class="alice-chat-message-avatar">${avatarHtml}</div>
        <div class="alice-chat-message-bubble">${this.escapeHtml(text)}</div>
      `;

      this.elements.messages.appendChild(messageDiv);
      
      if (scroll) {
        // Scroll to show the TOP of the new message, not the bottom
        requestAnimationFrame(() => {
          messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }

    showTyping() {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'alice-chat-message agent alice-typing-container';
      
      let avatarHtml;
      if (this.config.avatar) {
        avatarHtml = `<img src="${this.escapeHtml(this.config.avatar)}" alt="Alice" />`;
      } else {
        avatarHtml = '🤖';
      }
      
      typingDiv.innerHTML = `
        <div class="alice-chat-message-avatar">${avatarHtml}</div>
        <div class="alice-chat-message-bubble alice-chat-typing">
          <span></span>
          <span></span>
          <span></span>
        </div>
      `;
      this.elements.messages.appendChild(typingDiv);
      this.scrollToBottom();
    }

    hideTyping() {
      const typing = this.elements.messages.querySelector('.alice-typing-container');
      if (typing) typing.remove();
    }

    scrollToBottom(smooth = false) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (smooth) {
          this.elements.messages.scrollTo({
            top: this.elements.messages.scrollHeight,
            behavior: 'smooth'
          });
        } else {
          this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
        }
      });
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML.replace(/\n/g, '<br>');
    }
  }

  // Initialize widget when DOM is ready
  function init() {
    // Try document.currentScript first, then search for the script tag
    let script = document.currentScript;
    
    if (!script) {
      // Fallback: find script by src containing 'alice-chat-widget.js'
      const scripts = document.querySelectorAll('script[src*="alice-chat-widget.js"]');
      script = scripts[scripts.length - 1]; // Get the last one (most recent)
    }
    
    const config = {
      apiUrl: script?.getAttribute('data-api-url') || DEFAULT_CONFIG.apiUrl,
      title: script?.getAttribute('data-title') || DEFAULT_CONFIG.title,
      subtitle: script?.getAttribute('data-subtitle') || DEFAULT_CONFIG.subtitle,
      primaryColor: script?.getAttribute('data-color') || DEFAULT_CONFIG.primaryColor,
      position: script?.getAttribute('data-position') || DEFAULT_CONFIG.position,
      avatar: script?.getAttribute('data-avatar') || DEFAULT_CONFIG.avatar,
      placeholder: script?.getAttribute('data-placeholder') || DEFAULT_CONFIG.placeholder,
      showPopup: script?.getAttribute('data-show-popup') === 'true',
      popupText: script?.getAttribute('data-popup-text') || DEFAULT_CONFIG.popupText
    };

    new AliceChatWidget(config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for manual initialization
  window.AliceChatWidget = AliceChatWidget;
})();
