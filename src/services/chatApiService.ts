import { IAgentRuntime, Memory, State } from '@elizaos/core';
import { logger } from '@elizaos/core';
import { aliceActions } from '../plugins/csv-analysis/actions/index';

interface ChatMessage {
  id?: string;
  text: string;
  timestamp: number;
  sender: 'user' | 'agent';
  metadata?: any;
}

interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActivity: number;
  metadata?: {
    domain?: string;
    apiKey?: string;
  };
}

/**
 * Chat API Service
 * Handles HTTP chat requests for embedding Alice on external sites
 */
export class ChatApiService {
  private sessions: Map<string, ChatSession> = new Map();
  private runtime: IAgentRuntime;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    
    // Clean up old sessions periodically
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
  }

  /**
   * Create or get existing chat session
   */
  getSession(sessionId: string, domain?: string, apiKey?: string): ChatSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        messages: [],
        createdAt: Date.now(),
        lastActivity: Date.now(),
        metadata: { domain, apiKey }
      };
      this.sessions.set(sessionId, session);
      logger.info(`[ChatAPI] Created new session: ${sessionId}`);
    } else {
      session.lastActivity = Date.now();
    }
    
    return session;
  }

  /**
   * Process a chat message
   */
  async processChatMessage(
    sessionId: string,
    messageText: string,
    domain?: string,
    apiKey?: string
  ): Promise<{ success: boolean; message?: string; sessionId: string; error?: string }> {
    try {
      logger.info(`[ChatAPI] Processing message for session: ${sessionId}`);
      
      const session = this.getSession(sessionId, domain, apiKey);
      
      // Add user message to session
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        text: messageText,
        timestamp: Date.now(),
        sender: 'user'
      };
      session.messages.push(userMessage);

      // Create memory object compatible with ElizaOS
      // Generate a proper UUID for roomId and message ID
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
      
      const messageId = generateUUID() as `${string}-${string}-${string}-${string}-${string}`;
      
      const memory: Memory = {
        id: messageId,
        entityId: sessionId as `${string}-${string}-${string}-${string}-${string}`,
        roomId: generateUUID() as `${string}-${string}-${string}-${string}-${string}`,
        agentId: this.runtime.agentId,
        content: {
          text: messageText,
          source: 'chat_api'
        }
      };

      // Process with agent
      let agentResponse = '';

      // Use the shared, ordered action registry — the exact same list (and
      // priority order) as the main agent, so the WordPress widget can never
      // drift out of sync with the ElizaOS chat.
      const actions = aliceActions;

      logger.info(`[ChatAPI] Checking ${actions.length} CSV actions`);
      
      for (const action of actions) {
        try {
          // Check if action should handle this message
          const shouldHandle = await action.validate(this.runtime, memory);
          
          if (shouldHandle) {
            logger.info(`[ChatAPI] Action ${action.name} handling message`);
            
            // Call the action handler
            const result = await action.handler(
              this.runtime,
              memory,
              undefined as any, // state
              undefined, // options
              async (response: any) => {
                // Extract text from response
                if (typeof response === 'string') {
                  agentResponse = response;
                } else if (response && response.text) {
                  agentResponse = response.text;
                } else if (response && typeof response === 'object') {
                  agentResponse = JSON.stringify(response);
                }
                return []; // Return empty memory array as required
              }
            );
            
            // Also handle direct returns
            if (!agentResponse && result) {
              if (typeof result === 'string') {
                agentResponse = result;
              } else if (result.text) {
                agentResponse = result.text;
              }
            }
            
            if (agentResponse) {
              break; // Got a response, stop trying actions
            }
          }
        } catch (error) {
          logger.error(`[ChatAPI] Error with action ${action.name}:`, error);
        }
      }

      // If no action matched, fall back to the capability menu. Never invent
      // numbers here: every statistic must come from the CSV actions above
      // (concept questions like "what is the threshold" are handled by the
      // explain-ALICE action, which pulls real figures from the CSV data).
      if (!agentResponse) {
        logger.info('[ChatAPI] No action matched, returning capability menu');
        agentResponse = "I'm here to help with ALICE (Asset Limited, Income Constrained, Employed) data for Arkansas! I can provide information about:\n\n• County-level ALICE rates and household counts\n• City and town data\n• Statewide Arkansas statistics\n• Demographic breakdowns by race and household type\n• Employment sector data\n• Survival and Stability budgets (statewide and by county)\n• Historical trends\n• Comparisons between counties\n\n**I can also explain:**\n• What ALICE means\n• The ALICE threshold\n• The poverty line vs. ALICE\n• How ALICE is calculated\n\nWhat would you like to know?";
      }

      // Add agent response to session
      const agentMessage: ChatMessage = {
        id: `msg_${Date.now()}_agent`,
        text: agentResponse,
        timestamp: Date.now(),
        sender: 'agent'
      };
      session.messages.push(agentMessage);

      return {
        success: true,
        message: agentResponse,
        sessionId
      };

    } catch (error: any) {
      logger.error('[ChatAPI] Error processing message:', error);
      return {
        success: false,
        error: error.message || 'Failed to process message',
        sessionId
      };
    }
  }

  /**
   * Get chat history for a session
   */
  getChatHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * Clear a chat session
   */
  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`[ChatAPI] Cleaned up ${cleaned} inactive sessions`);
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      totalMessages: Array.from(this.sessions.values()).reduce(
        (sum, s) => sum + s.messages.length,
        0
      )
    };
  }
}
