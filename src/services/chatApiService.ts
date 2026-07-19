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

      // If no response from actions, try to generate a response using the character's knowledge
      if (!agentResponse) {
        logger.info('[ChatAPI] No action matched, using character knowledge');
        
        // For generic ALICE questions, provide a helpful response
        const lowerText = messageText.toLowerCase();
        
        // ALICE Threshold questions
        if (lowerText.includes('threshold') && (lowerText.includes('alice') || lowerText.includes('what is') || lowerText.includes('explain'))) {
          agentResponse = "The **ALICE Threshold** (Household Survival Budget) is the minimum income a household needs to afford basic necessities without assistance.\n\nIt includes:\n• Housing (rent/mortgage)\n• Childcare (if applicable)\n• Food\n• Transportation\n• Healthcare\n• Technology (phone/internet)\n• Taxes\n\nThe threshold **varies by county and household size** in Arkansas. For example:\n• Single adult: ~$30,000-$35,000/year\n• Family of 4: ~$60,000-$75,000/year\n\nUnlike the Federal Poverty Level, the ALICE Threshold reflects the **actual cost of living** in each county. ALICE households earn above poverty but below this threshold.\n\nWant to know the ALICE rate for a specific Arkansas county?";
        }
        // Poverty line / Federal Poverty Level questions
        // Allow 'in Arkansas' (state) but not 'in [X] County' (county-specific)
        else if (lowerText.includes('poverty line') || lowerText.includes('poverty level') || lowerText.includes('fpl') || lowerText.includes('federal poverty')) {
          const hasCountySpecific = /\bcounty\b/i.test(lowerText);
          if (!hasCountySpecific) {
            agentResponse = "The **Federal Poverty Level (FPL)** is the government's official poverty measure. For 2023 in Arkansas:\n\n• Individual: $14,580/year\n• Family of 2: $19,720/year\n• Family of 3: $24,860/year\n• Family of 4: $30,000/year\n\n**Key difference from ALICE:**\nThe FPL was created in the 1960s and doesn't account for:\n• Geographic cost differences\n• Childcare needs\n• Healthcare costs\n• Transportation\n• Actual cost of living\n\nThe **ALICE Threshold** is more accurate—it's based on real costs in each Arkansas county. Many households earn above the FPL but still can't afford basics (that's ALICE).\n\nIn Arkansas, 13% live below the FPL, but 28% are ALICE—meaning 41% total struggle financially.\n\nWant specific data for an Arkansas county?";
          }
        }
        // What is ALICE / ALICE meaning
        else if (lowerText.includes('what is alice') || lowerText.includes('define alice') || 
            lowerText.includes('explain alice') || lowerText.includes('alice mean') || lowerText.includes('alice stand for')) {
          agentResponse = "**ALICE stands for: Asset Limited, Income Constrained, Employed**\n\nALICE households are working families who:\n• Earn ABOVE the Federal Poverty Level\n• But still can't afford basic necessities\n• Live paycheck to paycheck\n• Are one crisis away from financial trouble\n\nWho is ALICE?\n• Early education workers & childcare providers\n• Home health aides & nursing assistants\n• Retail workers & cashiers\n• Food service workers\n• Office assistants\n• Truck drivers & delivery workers\n\n**In Arkansas (2023):**\n• 28% of households are ALICE (~537,000 households)\n• 13% live in poverty\n• Combined: 41% of Arkansas families struggle financially\n\nALICE families work hard but wages haven't kept up with the cost of living. They're the backbone of our communities but often invisible in poverty statistics.\n\nI can provide specific ALICE data for any Arkansas county, city, demographic, or employment sector. What would you like to know?";
        }
        // How is ALICE calculated
        else if (lowerText.includes('how') && lowerText.includes('alice') && (lowerText.includes('calculated') || lowerText.includes('measured') || lowerText.includes('determined'))) {
          agentResponse = "A household is classified as **ALICE** if their income is:\n\n1. **Above** the Federal Poverty Level\n2. **Below** the ALICE Threshold (Household Survival Budget) for their county\n\n**The ALICE Threshold varies by:**\n• County (cost of living differs across Arkansas)\n• Household size (number of adults and children)\n• Ages of children (infant care costs more than school-age)\n\n**Example for a family of 4 in Arkansas:**\n• Federal Poverty Level: $30,000/year\n• ALICE Threshold: $60,000-$75,000/year (depending on county)\n• If income is $30,001-$74,999: They're ALICE\n• Below $30,000: They're in poverty\n• Above threshold: They can afford basics\n\nThe threshold is calculated using **actual local costs** for housing, childcare, food, transportation, healthcare, technology, and taxes in each county.\n\nWant to see ALICE data for a specific Arkansas county?";
        }
        // General help / fallback
        else {
          agentResponse = "I'm here to help with ALICE (Asset Limited, Income Constrained, Employed) data for Arkansas! I can provide information about:\n\n• County-level ALICE rates and household counts\n• City and town data\n• Statewide Arkansas statistics\n• Demographic breakdowns by race and household type\n• Employment sector data\n• Historical trends\n• Comparisons between counties\n\n**I can also explain:**\n• What ALICE means\n• The ALICE threshold\n• The poverty line vs. ALICE\n• How ALICE is calculated\n\nWhat would you like to know?";
        }
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
