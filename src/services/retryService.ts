import { Service, type IAgentRuntime, logger } from '@elizaos/core';

/**
 * Retry Service for handling failed responses with exponential backoff
 */
export class RetryService extends Service {
  static serviceType = 'retry';

  async initialize(runtime: IAgentRuntime): Promise<void> {
    logger.info('RetryService initialized for response reliability');
  }

  async stop(): Promise<void> {
    logger.info('RetryService stopped');
  }

  get capabilityDescription(): string {
    return 'Provides retry functionality with exponential and fixed delay backoff strategies';
  }

  /**
   * Retry an operation with exponential backoff
   * @param operation - The async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param baseDelay - Base delay in milliseconds (default: 1000ms)
   * @returns Promise resolving to the operation result
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`Retry attempt ${attempt + 1}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          logger.debug(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`All ${maxRetries} retry attempts failed`);
    throw lastError!;
  }

  /**
   * Retry with linear backoff (constant delay)
   * @param operation - The async operation to retry
   * @param maxRetries - Maximum number of retry attempts
   * @param delay - Fixed delay between retries in milliseconds
   */
  async retryWithFixedDelay<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 2000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.debug(`Fixed delay retry attempt ${attempt + 1}/${maxRetries}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries - 1) {
          logger.debug(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`All ${maxRetries} retry attempts failed with fixed delay`);
    throw lastError!;
  }
}
