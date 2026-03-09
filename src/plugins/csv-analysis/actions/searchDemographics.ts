import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const searchDemographicsAction: Action = {
  name: 'Searching demographic data...',
  similes: [
    'demographics',
    'demographic breakdown',
    'by race',
    'by ethnicity',
    'by age',
    'white',
    'black',
    'hispanic',
    'latino',
    'asian',
    'native american',
    'age groups',
    'single parent',
    'two parent',
    'household type'
  ],
  description: 'Search Arkansas demographic data by race, ethnicity, age, and household type',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    console.error('\n*** DEMOGRAPHICS ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // EXCLUDE county ranking queries (e.g., "What county has the highest percentage of ALICE households?")
    const isCountyRanking = text.includes('county') && (
      text.includes('highest') || text.includes('lowest') || 
      text.includes('most') || text.includes('fewest') || text.includes('least') ||
      text.includes('rank') || text.includes('top') || text.includes('bottom')
    );
    
    if (isCountyRanking) {
      console.error('*** EXCLUDED - county ranking query, not demographics');
      console.error('*** END DEMOGRAPHICS VALIDATION ***\n');
      return false;
    }
    
    // Check for demographic keywords
    const demographicKeywords = [
      'demographic', 'race', 'ethnicity', 'ethnic', 'age', 'household type'
    ];
    
    const hasDemographicKeyword = demographicKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // Check for specific demographic categories
    const categoryKeywords = [
      'white', 'black', 'hispanic', 'latino', 'asian', 'native american',
      'biracial', 'multiracial', 'two or more races', 'mixed race',
      'single parent', 'two parent', 'single adult', 'age 18', 'age 25',
      'age 35', 'age 45', 'age 55', 'age 65'
    ];
    
    const hasCategoryKeyword = categoryKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // Check for ALICE rate queries about demographics
    const hasAliceDemographicQuery = text.includes('alice') && 
      (text.includes('rate') || text.includes('percentage') || text.includes('breakdown')) &&
      (hasDemographicKeyword || hasCategoryKeyword);
    
    const result = hasDemographicKeyword || hasCategoryKeyword || hasAliceDemographicQuery;
    console.error('*** Demographic keyword:', hasDemographicKeyword);
    console.error('*** Category keyword:', hasCategoryKeyword);
    console.error('*** ALICE demographic query:', hasAliceDemographicQuery);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END DEMOGRAPHICS VALIDATION ***\n');
    return result;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      console.error('*** DEMOGRAPHICS ACTION HANDLER TRIGGERED ***');
      
      // Response deduplication - prevent processing the same message twice
      const messageId = message.id || message.content?.messageId || message.content?.text;
      console.error('*** Checking message ID for deduplication:', messageId);
      
      if ((global as any).processedMessages?.has(messageId)) {
        console.error('*** Message already processed, skipping to prevent duplicate response ***');
        return true;
      }
      
      // Initialize processed messages set if it doesn't exist
      if (!(global as any).processedMessages) {
        (global as any).processedMessages = new Set();
        console.error('*** Initialized processedMessages set ***');
      }
      
      // Mark this message as being processed
      (global as any).processedMessages.add(messageId);
      console.error('*** Marked message as processed:', messageId);
      
      const csvService = (runtime as any).csvDataService as CsvDataService;
      const text = message.content.text || '';
      
      if (!csvService) {
        const errorResult = "I cannot access my demographic data systems right now. Please try again later.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      // Get all demographic data
      const demographicData = csvService.getAllDemographics();
      
      if (!demographicData || demographicData.length === 0) {
        const errorResult = "I don't have demographic data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      let response = "";
      
      // Check if asking for specific demographic breakdown
      const lowerText = text.toLowerCase();
      
      // Check if asking about specific race/ethnicity
      const raceKeywords = ['white', 'black', 'hispanic', 'latino', 'asian', 'native american', 'race', 'ethnic'];
      const isRaceQuery = raceKeywords.some(keyword => lowerText.includes(keyword));
      
      if (isRaceQuery) {
        const raceData = demographicData.filter(d => {
          const category = d.category.trim();
          return ['White', 'Black', 'Hispanic/Latino', 'Asian', 'Native American', 'Two or More Races'].includes(category);
        });
        
        // Check if asking about a specific race
        const specificRace = {
          'white': 'White',
          'black': 'Black',
          'hispanic': 'Hispanic/Latino',
          'latino': 'Hispanic/Latino',
          'asian': 'Asian',
          'native american': 'Native American'
        };
        
        let matchedRace = null;
        for (const [keyword, category] of Object.entries(specificRace)) {
          if (lowerText.includes(keyword)) {
            matchedRace = category;
            break;
          }
        }
        
        if (matchedRace) {
          // Return data for specific race
          const specificData = demographicData.find(d => d.category.trim() === matchedRace);
          if (specificData) {
            const combinedThreshold = specificData.alice_percentage + specificData.poverty_percent;
            response = `According to my data set, ${specificData.category} households in Arkansas:\n\n`;
            response += `ALICE households: ${specificData.alice_percentage}% (${specificData.alice_households.toLocaleString()} households)\n`;
            response += `Households in poverty: ${specificData.poverty_percent}%\n`;
            response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n\n`;
            response += `This means ${specificData.alice_households.toLocaleString()} ${specificData.category} households are specifically ALICE (above poverty but below the cost of basic needs).`;
          } else {
            response = `I don't have specific ALICE data for ${matchedRace} households in my dataset.`;
          }
        } else {
          // Return all race data
          response = "According to my data set, here are ALICE rates by race/ethnicity in Arkansas:\n\n";
          raceData.forEach(demo => {
            const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
            response += `${demo.category}:\n`;
            response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()})\n`;
            response += `  Households in poverty: ${demo.poverty_percent}%\n`;
            response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
          });
          response += "Note: ALICE households are above poverty but below the cost of basic needs. The ALICE threshold includes both ALICE households and households in poverty.";
        }
        
      } else if (text.includes('age')) {
        const ageData = demographicData.filter(d => d.category.startsWith('Age'));
        
        response = "According to my data set, here are ALICE rates by age group in Arkansas:\n\n";
        ageData.forEach(demo => {
          const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
          response += `${demo.category}:\n`;
          response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()})\n`;
          response += `  Households in poverty: ${demo.poverty_percent}%\n`;
          response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
        });
        response += "Note: ALICE households are above poverty but below the cost of basic needs.";
        
      } else if (text.includes('household') || text.includes('parent')) {
        const householdData = demographicData.filter(d => 
          d.category.includes('Parent') || d.category.includes('Adult') || d.category.includes('Couples') || d.category.includes('Single')
        );
        
        response = "According to my data set, here are ALICE rates by household type in Arkansas:\n\n";
        householdData.forEach(demo => {
          const combinedThreshold = demo.alice_percentage + demo.poverty_percent;
          response += `${demo.category}:\n`;
          response += `  ALICE households: ${demo.alice_percentage}% (${demo.alice_households.toLocaleString()})\n`;
          response += `  Households in poverty: ${demo.poverty_percent}%\n`;
          response += `  Total below ALICE threshold: ${combinedThreshold}%\n\n`;
        });
        response += "Note: ALICE households are above poverty but below the cost of basic needs.";
        
      } else {
        // General demographic overview
        const totalData = demographicData.find(d => d.category === 'Total Arkansas');
        
        response = `According to my data set, here's Arkansas demographic data:\n\n`;
        
        if (totalData) {
          const combinedThreshold = totalData.alice_percentage + totalData.poverty_percent;
          response += `Overall Arkansas households:\n`;
          response += `ALICE households: ${totalData.alice_percentage}% (${totalData.alice_households.toLocaleString()} households)\n`;
          response += `Households in poverty: ${totalData.poverty_percent}%\n`;
          response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n\n`;
          response += `This means ${totalData.alice_households.toLocaleString()} Arkansas households are specifically ALICE (above poverty but below the cost of basic needs).\n\n`;
        }
        
        // Show highest and lowest rates
        const nonTotalData = demographicData.filter(d => d.category !== 'Total Arkansas');
        const highest = nonTotalData.reduce((max, demo) => 
          demo.alice_percentage > max.alice_percentage ? demo : max
        );
        const lowest = nonTotalData.reduce((min, demo) => 
          demo.alice_percentage < min.alice_percentage ? demo : min
        );
        
        response += `Highest ALICE rate: ${highest.category} at ${highest.alice_percentage}%\n`;
        response += `Lowest ALICE rate: ${lowest.category} at ${lowest.alice_percentage}%\n\n`;
        response += `This shows significant variation across demographic groups in Arkansas.`;
      }
      
      const result = {
        text: response,
        success: true,
        action: 'DEMOGRAPHICS_DATA_RETRIEVED'
      };
      
      // Clean up old processed messages (keep only last 5 seconds worth)
      setTimeout(() => {
        if ((global as any).processedMessages?.has(messageId)) {
          (global as any).processedMessages.delete(messageId);
          console.error('*** Cleaned up processed message:', messageId);
        }
      }, 5000);
      
      // Signal completion to ElizaOS via callback
      if (callback) {
        console.error('*** DEMOGRAPHICS: Calling callback with result ***');
        callback(result);
        console.error('*** DEMOGRAPHICS: Action completed, should not process again ***');
        // Return early after callback to prevent double response
        return true;
      }
      
      console.error('*** DEMOGRAPHICS: Returning result (no callback) ***');
      return result;
    } catch (error: any) {
      const errorMessage = "I cannot access my demographic data systems right now. Please try again later.";
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What are the ALICE rates by race?" }
      },
      {
        name: "Alice",
        content: { text: "According to my data set, here are ALICE rates by race/ethnicity in Arkansas:\n\nWhite: 25% (246,914 of 987,654 households)\nBlack: 41% (75,806 of 185,432 households)\nHispanic/Latino: 35% (31,193 of 89,123 households)" }
      }
    ]
  ]
};
