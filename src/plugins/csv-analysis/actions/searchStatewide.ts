import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const searchStatewideAction: Action = {
  name: 'Searching Arkansas statewide data...',
  similes: [
    'SEARCH_STATEWIDE',
    'statewide',
    'arkansas as a whole',
    'entire state',
    'all of arkansas',
    'state level',
    'arkansas total',
    'arkansas overall'
  ],
  description: 'Search statewide Arkansas ALICE data and statistics',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    // Normalize hyphens so "single-parent" matches "single parent", etc.
    const text = (message.content.text?.toLowerCase() || '').replace(/[-–—]/g, ' ');
    console.error('\n*** STATEWIDE ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // Check for statewide keywords (more flexible matching)
    const hasStatewideKeyword = 
      text.includes('statewide') || 
      text.includes('entire state') || 
      text.includes('whole state') ||
      text.includes('state as a whole') ||
      text.includes('state level') ||
      (text.includes('arkansas') && text.includes('overall')) ||
      (text.includes('arkansas') && text.includes('total')) ||
      (text.includes('all of arkansas'));
    
    // Check if asking about Arkansas (not a specific county) with ALICE data
    const isArkansasQuery = text.includes('arkansas') && 
      !text.includes('county') && 
      !text.includes('counties');
    
    // Check for general Arkansas questions about ALICE rates/households
    const isGeneralArkansasAlice = text.includes('arkansas') && 
      (text.includes('alice') || text.includes('household')) &&
      (text.includes('rate') || text.includes('percentage') || text.includes('how many'));
    
    // Exclude demographic queries (race, ethnicity, age, household type) - let the demographics action handle them
    // Word-boundary matching: plain substring checks misfire badly here
    // ("how MANy" contains "man", "wAGE"/"averAGE" contain "age").
    const isDemographicQuery = [
      'black', 'white', 'hispanic', 'latino', 'asian', 'native american',
      'biracial', 'multiracial', 'race', 'ethnicity', 'ethnic', 'age',
      'household type', 'single parent', 'two parent', 'single adult', 'parent',
      'gender', 'female', 'male', 'woman', 'women', 'man', 'men'
    ].some(keyword => new RegExp(`\\b${keyword}\\b`).test(text));

    // Exclude trend / change-over-time queries - let the trends action handle them
    const isTrendQuery = [
      'trend', 'change', 'over time', 'historical', 'history', 'year over year',
      'grown', 'grow', 'growing', 'grew', 'growth', 'decline', 'declined',
      'increase', 'increased', 'decrease', 'decreased', 'rising', 'falling',
      'since', 'year', 'years'
    ].some(keyword => new RegExp(`\\b${keyword}\\b`).test(text));

    const isCountyQuery = text.includes('county') || text.includes('counties');

    // Bare state-overview queries ("tell me about Arkansas") — "Arkansas"
    // alone means the state, never Arkansas County (that requires the word
    // "county", which is excluded above anyway).
    const isBareStateOverview = isArkansasQuery &&
      /\b(?:tell me )?about\s+(?:the\s+state\s+of\s+)?arkansas\b|\boverview of arkansas\b/.test(text);

    const result = (hasStatewideKeyword || isGeneralArkansasAlice || isBareStateOverview ||
                    (isArkansasQuery && text.includes('alice'))) &&
                   !isDemographicQuery && !isTrendQuery && !isCountyQuery;
    
    console.error('*** Statewide keyword:', hasStatewideKeyword);
    console.error('*** Arkansas query:', isArkansasQuery);
    console.error('*** General Arkansas ALICE:', isGeneralArkansasAlice);
    console.error('*** Demographic query (excluded):', isDemographicQuery);
    console.error('*** Trend query (excluded):', isTrendQuery);
    console.error('*** County query (excluded):', isCountyQuery);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END STATEWIDE VALIDATION ***\n');
    return result;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      console.error('*** STATEWIDE ACTION HANDLER TRIGGERED ***');
      
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
      
      const csvService = ((runtime as any).csvDataService ||
        (global as any).csvDataService) as CsvDataService;
      const text = message.content.text || '';
      
      if (!csvService) {
        const errorResult = {
          text: "I cannot access my statewide data systems right now. Please try again later.",
          success: false
        };
        if (callback) {
          callback(errorResult);
          return true;
        }
        return errorResult;
      }
      
      // Get all statewide data
      const statewideData = csvService.getAllStatewide();
      
      if (!statewideData || statewideData.length === 0) {
        const errorResult = {
          text: "I don't have statewide data available right now.",
          success: false
        };
        if (callback) {
          callback(errorResult);
          return true;
        }
        return errorResult;
      }
      
      let response = "";
      const lowerText = text.toLowerCase();
      
      // Helper function to find data by category
      const findData = (category: string) => 
        statewideData.find(d => d.category.toLowerCase().includes(category.toLowerCase()));
      
      // Latest-year statewide snapshot (computed from the trend series), so
      // statewide answers default to the newest year available.
      const snapshot =
        typeof csvService.getLatestStatewideSnapshot === 'function'
          ? csvService.getLatestStatewideSnapshot()
          : undefined;

      // Check what specific information is being asked for
      if (lowerText.includes('alice rate') || lowerText.includes('alice percentage')) {
        if (snapshot) {
          response = `According to my data set, Arkansas statewide ALICE statistics for ${snapshot.year} (latest available):\n\n`;
          response += `ALICE Rate: ${snapshot.alicePct}%\n`;
          response += `ALICE Households: ${snapshot.alice.toLocaleString()}\n`;
          response += `Total Households: ${snapshot.households.toLocaleString()}\n\n`;
          response += `This means ${snapshot.alicePct}% of Arkansas households (${snapshot.alice.toLocaleString()} households) are ALICE - Asset Limited, Income Constrained, Employed. `;
          response += `These families earn above the federal poverty line but below the cost of basic necessities. `;
          response += `I also have data for earlier years if you'd like to see how this has changed.`;
        } else {
          const aliceRate = findData('ALICE Percentage');
          const aliceHouseholds = findData('ALICE Households');
          const totalHouseholds = findData('Total Households');

          if (aliceRate && aliceHouseholds && totalHouseholds) {
            response = `According to my data set, Arkansas statewide ALICE statistics for ${aliceRate.year}:\n\n`;
            response += `ALICE Rate: ${aliceRate.value}%\n`;
            response += `ALICE Households: ${aliceHouseholds.value.toLocaleString()}\n`;
            response += `Total Households: ${totalHouseholds.value.toLocaleString()}\n\n`;
            response += `This means ${aliceRate.value}% of Arkansas households (${aliceHouseholds.value.toLocaleString()} households) are ALICE - Asset Limited, Income Constrained, Employed. `;
            response += `These families earn above the federal poverty line but below the cost of basic necessities.`;
          }
        }
      } else if (lowerText.includes('poverty') || lowerText.includes('below poverty')) {
        if (snapshot) {
          response = `According to my data set, Arkansas poverty statistics for ${snapshot.year} (latest available):\n\n`;
          response += `Poverty Rate: ${snapshot.povertyPct}%\n`;
          response += `Households in Poverty: ${snapshot.poverty.toLocaleString()}\n\n`;
          response += `${snapshot.povertyPct}% of Arkansas households (${snapshot.poverty.toLocaleString()} households) live below the federal poverty line. `;
          response += `I also have data for earlier years if you'd like to see how this has changed.`;
        } else {
          const povertyRate = findData('Poverty Percentage');
          const povertyHouseholds = findData('Poverty Households');

          if (povertyRate && povertyHouseholds) {
            response = `According to my data set, Arkansas poverty statistics for ${povertyRate.year}:\n\n`;
            response += `Poverty Rate: ${povertyRate.value}%\n`;
            response += `Households in Poverty: ${povertyHouseholds.value.toLocaleString()}\n\n`;
            response += `${povertyRate.value}% of Arkansas households (${povertyHouseholds.value.toLocaleString()} households) live below the federal poverty line.`;
          }
        }
      } else if (lowerText.includes('rural') || lowerText.includes('urban')) {
        const ruralHouseholds = findData('Rural Households');
        const ruralAlice = findData('Rural ALICE Percentage');
        const urbanHouseholds = findData('Urban Households');
        const urbanAlice = findData('Urban ALICE Percentage');
        
        if (lowerText.includes('rural') && ruralHouseholds && ruralAlice) {
          const ruralAliceCount = findData('Rural ALICE Households');
          response = `According to my data set, Arkansas rural statistics for ${ruralHouseholds.year}:\n\n`;
          response += `Rural Households: ${ruralHouseholds.value.toLocaleString()}\n`;
          response += `Rural ALICE Rate: ${ruralAlice.value}%\n`;
          if (ruralAliceCount) {
            response += `Rural ALICE Households: ${ruralAliceCount.value.toLocaleString()}\n`;
          }
          response += `\nRural Arkansas has a ${ruralAlice.value}% ALICE rate, higher than the statewide average.`;
        } else if (lowerText.includes('urban') && urbanHouseholds && urbanAlice) {
          const urbanAliceCount = findData('Urban ALICE Households');
          response = `According to my data set, Arkansas urban statistics for ${urbanHouseholds.year}:\n\n`;
          response += `Urban Households: ${urbanHouseholds.value.toLocaleString()}\n`;
          response += `Urban ALICE Rate: ${urbanAlice.value}%\n`;
          if (urbanAliceCount) {
            response += `Urban ALICE Households: ${urbanAliceCount.value.toLocaleString()}\n`;
          }
          response += `\nUrban Arkansas has a ${urbanAlice.value}% ALICE rate, slightly lower than the statewide average.`;
        } else if (ruralHouseholds && ruralAlice && urbanHouseholds && urbanAlice) {
          response = `According to my data set, Arkansas rural vs urban breakdown for ${ruralHouseholds.year}:\n\n`;
          response += `Rural Arkansas:\n`;
          response += `Households: ${ruralHouseholds.value.toLocaleString()}\n`;
          response += `ALICE Rate: ${ruralAlice.value}%\n\n`;
          response += `Urban Arkansas:\n`;
          response += `Households: ${urbanHouseholds.value.toLocaleString()}\n`;
          response += `ALICE Rate: ${urbanAlice.value}%\n\n`;
          response += `Rural areas have a ${ruralAlice.value}% ALICE rate compared to ${urbanAlice.value}% in urban areas.`;
        }
      } else if (lowerText.includes('priority') && lowerText.includes('count')) {
        const priorityCounties = findData('Priority Counties');
        const totalCounties = findData('Total Counties');
        
        if (priorityCounties && totalCounties) {
          response = `According to my data set:\n\n`;
          response += `Priority Counties: ${priorityCounties.value} out of ${totalCounties.value} total counties\n\n`;
          response += `Arkansas has ${priorityCounties.value} high-need priority counties that require focused attention for ALICE support and economic development.`;
        }
      } else {
        // General overview — lead with the latest year from the trend series.
        if (snapshot) {
          response = `According to my data set, Arkansas statewide ALICE overview for ${snapshot.year} (latest available):\n\n`;
          response += `Total Households: ${snapshot.households.toLocaleString()}\n`;
          response += `ALICE Households: ${snapshot.alice.toLocaleString()} (${snapshot.alicePct}%)\n`;
          response += `Households in Poverty: ${snapshot.poverty.toLocaleString()} (${snapshot.povertyPct}%)\n`;
          response += `Below ALICE Threshold: ${snapshot.below.toLocaleString()} (${snapshot.belowPct}%, ALICE + poverty combined)\n`;
          response += `\n${snapshot.alicePct}% of Arkansas households are ALICE - Asset Limited, Income Constrained, Employed. `;
          response += `These ${snapshot.alice.toLocaleString()} families earn above poverty but below the cost of basic household necessities. `;
          response += `I also have earlier years plus detailed breakdowns (rural vs urban, race/ethnicity, priority counties) if you'd like them.`;
        } else {
          const totalHouseholds = findData('Total Households');
          const aliceHouseholds = findData('ALICE Households');
          const aliceRate = findData('ALICE Percentage');
          const povertyRate = findData('Poverty Percentage');
          const belowThreshold = findData('Below ALICE Threshold Percentage');

          if (totalHouseholds && aliceHouseholds && aliceRate) {
            response = `According to my data set, Arkansas statewide ALICE overview for ${totalHouseholds.year}:\n\n`;
            response += `Total Households: ${totalHouseholds.value.toLocaleString()}\n`;
            response += `ALICE Households: ${aliceHouseholds.value.toLocaleString()}\n`;
            response += `ALICE Rate: ${aliceRate.value}%\n`;
            if (povertyRate) {
              response += `Poverty Rate: ${povertyRate.value}%\n`;
            }
            if (belowThreshold) {
              response += `Below ALICE Threshold: ${belowThreshold.value}% (ALICE + poverty combined)\n`;
            }
            response += `\n${aliceRate.value}% of Arkansas households are ALICE - Asset Limited, Income Constrained, Employed. `;
            response += `These ${aliceHouseholds.value.toLocaleString()} families earn above poverty but below the cost of basic household necessities.`;
          }
        }
      }
      
      if (!response) {
        response = "I have Arkansas statewide data available. What specific information would you like to know? I can provide:\n";
        response += "Overall ALICE rate and household counts\n";
        response += "Rural vs urban breakdown\n";
        response += "Poverty statistics\n";
        response += "Priority county information";
      }
      
      console.error('*** Statewide response generated:', response.substring(0, 100) + '...');
      
      const result = {
        text: response,
        success: true
      };
      
      if (callback) {
        callback(result);
        return true;
      }
      
      return result;
      
    } catch (error) {
      console.error('*** ERROR in statewide handler:', error);
      const errorResult = {
        text: "I encountered an error accessing statewide data. Please try again.",
        success: false
      };
      if (callback) {
        callback(errorResult);
        return true;
      }
      return errorResult;
    }
  }
};
