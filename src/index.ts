import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';
import { character } from './character.ts';
import { ProjectStarterTestSuite } from './__tests__/e2e/project-starter.e2e';
import { CsvDataService } from './plugins/csv-analysis/services/csvDataService';

/**
 * Initializes the agent character on runtime startup.
 *
 * @param params - Initialization parameters.
 * @param params.runtime - The active ElizaOS agent runtime.
 * @returns The configured agent character.
 */
const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  return character;
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => {
    await initCharacter({ runtime });
    try {
      logger.info('*** Starting CSV Data Service initialization ***');
      // Initialize and register CSV data service
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
  },
  plugins: [starterPlugin], // Enable the starter plugin with custom CSS routes
  tests: [ProjectStarterTestSuite], // Export tests from ProjectAgent
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';

export default project;
