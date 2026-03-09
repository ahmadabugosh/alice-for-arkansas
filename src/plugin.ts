import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type ActionResult,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { z } from 'zod';
import { searchCountyAction } from './plugins/csv-analysis/actions/searchCounty';
import { compareCountiesAction } from './plugins/csv-analysis/actions/compareCounties';
import { rankCountiesAction } from './plugins/csv-analysis/actions/rankCounties';
import { analyzeTrendsAction } from './plugins/csv-analysis/actions/analyzeTrends';
import { searchEmploymentAction } from './plugins/csv-analysis/actions/searchEmployment';
import { searchDemographicsAction } from './plugins/csv-analysis/actions/searchDemographics';
import { searchStatewideAction } from './plugins/csv-analysis/actions/searchStatewide';
import { explainAliceAction } from './plugins/csv-analysis/actions/explainAlice';
import { CsvDataService } from './plugins/csv-analysis/services/csvDataService';
import { ChatApiService } from './services/chatApiService';
import path from 'path';

/**
 * Define the configuration schema for the plugin with the following properties:
 *
 * @param {string} EXAMPLE_PLUGIN_VARIABLE - The name of the plugin (min length of 1, optional)
 * @returns {object} - The configured schema object
 */
const configSchema = z.object({
  EXAMPLE_PLUGIN_VARIABLE: z
    .string()
    .min(1, 'Example plugin variable is not provided')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('Warning: Example plugin variable is not provided');
      }
      return val;
    }),
});

// Removed knowledgeRetrievalAction to prevent duplicate responses
// Alice now relies solely on the built-in knowledge system

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: 'HELLO_WORLD_PROVIDER',
  description: 'A simple example provider',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    return {
      text: 'I am a provider',
      values: {},
      data: {},
    };
  },
};

export class StarterService extends Service {
  static serviceType = 'starter';
  capabilityDescription =
    'This is a starter service which is attached to the agent through the starter plugin.';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
    logger.info('*** StarterService constructor called ***');
    // Initialize CSV service immediately in constructor
    this.initializeCsvService();
  }

  private initializeCsvService() {
    try {
      logger.info('*** Starting CSV Data Service initialization in constructor ***');
      const csvDataService = new CsvDataService();
      csvDataService.initialize();
      
      // Attach to runtime for action access
      (this.runtime as any).csvDataService = csvDataService;
      logger.info('*** CSV Data Service initialized and attached to runtime successfully ***');
    } catch (error) {
      logger.error('*** CRITICAL: Failed to initialize CSV data service ***', error);
      // Still attach a dummy service to prevent crashes
      (this.runtime as any).csvDataService = null;
    }
  }

  async initialize() {
    logger.info('*** StarterService initialize() called ***');
    // Also initialize CSV service here as backup
    if (!(this.runtime as any).csvDataService) {
      this.initializeCsvService();
    }
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting starter service ***');
    const service = new StarterService(runtime);
    
    // Store runtime globally for API access
    (global as any).runtime = runtime;
    
    // Initialize CSV Data Service
    try {
      logger.info('*** Starting CSV Data Service initialization ***');
      const csvDataService = new CsvDataService();
      csvDataService.initialize();
      
      // Attach to runtime for action access
      (runtime as any).csvDataService = csvDataService;
      logger.info('*** CSV Data Service initialized and attached to runtime successfully ***');
    } catch (error) {
      logger.error('*** CRITICAL: Failed to initialize CSV data service ***', error);
      // Still attach a dummy service to prevent crashes
      (runtime as any).csvDataService = null;
    }
    
    // Initialize Chat API Service
    try {
      logger.info('*** Starting Chat API Service initialization ***');
      const chatApiService = new ChatApiService(runtime);
      (global as any).chatApiService = chatApiService;
      logger.info('*** Chat API Service initialized successfully ***');
    } catch (error) {
      logger.error('*** Failed to initialize Chat API service ***', error);
    }
    
    // Clear knowledge cache immediately on startup to force refresh
    try {
      const knowledgeService = runtime.getService('knowledge') as any;
      if (knowledgeService && typeof knowledgeService.clearCache === 'function') {
        knowledgeService.clearCache();
        logger.info('*** Knowledge cache cleared on startup ***');
      }
      
      // Configure optimized search parameters for higher accuracy
      if (knowledgeService && knowledgeService.searchMemories) {
        const originalSearch = knowledgeService.searchMemories.bind(knowledgeService);
        knowledgeService.searchMemories = function(params: any) {
          // Override default parameters for higher accuracy
          const optimizedParams = {
            ...params,
            match_threshold: 0.85, // Increased from default 0.7
            match_count: Math.min(params.match_count || 10, 5), // Limit to 5 for precision
            unique: true
          };
          logger.info(`*** Optimized search params: threshold=${optimizedParams.match_threshold}, count=${optimizedParams.match_count} ***`);
          return originalSearch(optimizedParams);
        };
      }
    } catch (error) {
      logger.warn('Failed to clear knowledge cache on startup:', error);
    }
    
    // Clear cache periodically to ensure fresh knowledge
    setInterval(() => {
      try {
        const knowledgeService = runtime.getService('knowledge') as any;
        if (knowledgeService && typeof knowledgeService.clearCache === 'function') {
          knowledgeService.clearCache();
          logger.info('*** Knowledge cache cleared (periodic) ***');
        }
      } catch (error) {
        logger.warn('Failed to clear knowledge cache (periodic):', error);
      }
    }, 1800000); // Every 30 minutes
    
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping starter service ***');
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error('Starter service not found');
    }
    service.stop();
  }
  async stop() {
    logger.info('*** Stopping starter service instance ***');
  }
}

logger.info('*** INITIALIZING STARTER PLUGIN WITH CSV ACTIONS ***');

// Diagnostic: Check which actions imported successfully
console.error('*** STARTER PLUGIN ACTION IMPORTS ***');
console.error('*** searchStatewideAction:', !!searchStatewideAction, searchStatewideAction?.name);
console.error('*** searchDemographicsAction:', !!searchDemographicsAction, searchDemographicsAction?.name);
console.error('*** searchEmploymentAction:', !!searchEmploymentAction, searchEmploymentAction?.name);
console.error('*** analyzeTrendsAction:', !!analyzeTrendsAction, analyzeTrendsAction?.name);
console.error('*** searchCountyAction:', !!searchCountyAction, searchCountyAction?.name);
console.error('*** compareCountiesAction:', !!compareCountiesAction, compareCountiesAction?.name);
console.error('*** rankCountiesAction:', !!rankCountiesAction, rankCountiesAction?.name);

const actions = [
  explainAliceAction,     // MUST BE FIRST to handle "tell me about ALICE" concept queries
  searchStatewideAction,  // Second to prevent county action from matching "Arkansas"
  searchDemographicsAction,
  searchEmploymentAction,
  analyzeTrendsAction,
  rankCountiesAction,      // BEFORE searchCounty to prevent county action from intercepting ranking queries
  compareCountiesAction,
  searchCountyAction
].filter(action => {
  if (!action) {
    console.error('*** WARNING: Null/undefined action filtered out ***');
    return false;
  }
  return true;
});

console.error('*** Total actions after filtering:', actions.length);
console.error('*** Action names:', actions.map(a => a.name));

const plugin: Plugin = {
  name: 'starter',
  description: 'Starter plugin with CSV data analysis for Arkansas ALICE statistics',
  // Set lowest priority so real models take precedence
  priority: -1000,
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** Initializing starter plugin ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid plugin configuration: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      _runtime,
      { prompt, stopSequences = [] }: GenerateTextParams
    ) => {
      return 'Never gonna give you up, never gonna let you down, never gonna run around and desert you...';
    },
    [ModelType.TEXT_LARGE]: async (
      _runtime,
      {
        prompt,
        stopSequences = [],
        maxTokens = 8192,
        temperature = 0.7,
        frequencyPenalty = 0.7,
        presencePenalty = 0.7,
      }: GenerateTextParams
    ) => {
      return 'Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you...';
    },
  },
  routes: [
    {
      name: 'helloworld',
      path: '/helloworld',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: 'Hello World!',
        });
      },
    },
    {
      name: 'custom-styles',
      path: '/custom-styles.css',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        const customCSS = `
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
        res.setHeader('Content-Type', 'text/css');
        res.send(customCSS);
      },
    },
    {
      name: 'inject-styles',
      path: '/inject-styles.js',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        const injectScript = `
(function() {
    // Only inject if not already injected
    if (document.getElementById('alice-custom-styles')) return;
    
    const link = document.createElement('link');
    link.id = 'alice-custom-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = '/custom-styles.css';
    document.head.appendChild(link);
    
    // Also inject styles directly for immediate effect
    const style = document.createElement('style');
    style.textContent = \`
        [data-state="inactive"][value="groups"],
        [data-state="active"][value="groups"],
        [data-state="inactive"][value="documentation"],
        [data-state="active"][value="documentation"],
        [data-state="inactive"][value="settings"],
        [data-state="active"][value="settings"],
        button[aria-label*="Create"],
        button[title*="Create"],
        .create-button,
        .add-button {
            display: none !important;
        }
    \`;
    document.head.appendChild(style);
    
    console.log('Alice custom styles injected');
})();
`;
        res.setHeader('Content-Type', 'application/javascript');
        res.send(injectScript);
      },
    },
    {
      name: 'alice-chat-widget',
      path: '/widget/alice-chat-widget.js',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        try {
          const widgetPath = path.join(process.cwd(), 'widget', 'alice-chat-widget.js');
          res.setHeader('Content-Type', 'application/javascript');
          res.sendFile(widgetPath);
        } catch (error) {
          logger.error('Failed to serve Alice chat widget:', error);
          res.status(404).send('// Alice chat widget not found');
        }
      },
    },
    {
      name: 'CHAT_API',
      path: '/api/chat',
      type: 'POST',
      handler: async (req: any, res: any) => {
        try {
          logger.info('[ChatAPI] Route handler called');
          
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          
          // Safely handle cases where req.body might be undefined
          const body = req.body || {};
          const { message, sessionId, domain, apiKey } = body;

          if (!message || !sessionId) {
            res.status(400).json({
              success: false,
              error: 'Missing required fields: message and sessionId'
            });
            return;
          }

          // Get chat service from global or create it
          let chatService = (global as any).chatApiService;
          if (!chatService) {
            const runtime = (global as any).runtime;
            if (!runtime) {
              res.status(500).json({
                success: false,
                error: 'Agent runtime not available'
              });
              return;
            }
            chatService = new ChatApiService(runtime);
            (global as any).chatApiService = chatService;
          }

          // Process the message
          const result = await chatService.processChatMessage(
            sessionId,
            message,
            domain,
            apiKey
          );

          res.json(result);
        } catch (error: any) {
          logger.error('[ChatAPI] Error in chat endpoint:', error);
          res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
          });
        }
      },
    },
    {
      name: 'chat-history',
      path: '/api/chat/history',
      type: 'GET',
      handler: async (req: any, res: any) => {
        try {
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          const sessionId = req.query.sessionId;

          if (!sessionId) {
            res.status(400).json({
              success: false,
              error: 'Missing sessionId parameter'
            });
            return;
          }

          const chatService = (global as any).chatApiService;
          if (!chatService) {
            res.json({
              success: true,
              messages: []
            });
            return;
          }

          const messages = chatService.getChatHistory(sessionId);
          res.json({
            success: true,
            messages
          });
        } catch (error: any) {
          logger.error('[ChatAPI] Error in history endpoint:', error);
          res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
          });
        }
      },
    },
    {
      name: 'chat-clear',
      path: '/api/chat/clear',
      type: 'POST',
      handler: async (req: any, res: any) => {
        try {
          res.setHeader('Access-Control-Allow-Origin', '*');
          
          const { sessionId } = req.body;

          if (!sessionId) {
            res.status(400).json({
              success: false,
              error: 'Missing sessionId'
            });
            return;
          }

          const chatService = (global as any).chatApiService;
          if (chatService) {
            chatService.clearSession(sessionId);
          }

          res.json({
            success: true,
            message: 'Session cleared'
          });
        } catch (error: any) {
          logger.error('[ChatAPI] Error in clear endpoint:', error);
          res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
          });
        }
      },
    },
  ],
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('MESSAGE_RECEIVED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'MESSAGE_RECEIVED param keys');
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('VOICE_MESSAGE_RECEIVED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'VOICE_MESSAGE_RECEIVED param keys');
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.info('WORLD_CONNECTED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'WORLD_CONNECTED param keys');
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.info('WORLD_JOINED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'WORLD_JOINED param keys');
      },
    ],
  },
  services: [StarterService],
  actions: actions,
  providers: [helloWorldProvider],
};

// Initialize CSV service immediately when plugin is loaded
const initializeCsvServiceGlobally = () => {
  try {
    logger.info('*** Initializing CSV Data Service globally during plugin load ***');
    const csvDataService = new CsvDataService();
    csvDataService.initialize();
    
    // Store globally for access
    (global as any).csvDataService = csvDataService;
    logger.info('*** CSV Data Service initialized globally successfully ***');
    return csvDataService;
  } catch (error) {
    logger.error('*** CRITICAL: Failed to initialize CSV data service globally ***', error);
    (global as any).csvDataService = null;
    return null;
  }
};

// Initialize immediately
const globalCsvService = initializeCsvServiceGlobally();

export default plugin;
