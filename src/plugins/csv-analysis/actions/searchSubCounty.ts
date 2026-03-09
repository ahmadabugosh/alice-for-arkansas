import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const searchSubCountyAction: Action = {
  name: 'Searching subcounty records...',
  description: 'Search for subcounty data including townships, places, and zip codes in Arkansas',
  similes: [
    'SEARCH_SUBCOUNTY',
    'SEARCH_TOWNSHIP',
    'SEARCH_ZIPCODE',
    'SEARCH_PLACE',
    'find zipcode',
    'find zip code',
    'find township',
    'find place',
    'find city',
    'subcounty data',
    'township data',
    'zip code data',
    'place data'
  ],

  validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = (message.content as any).text?.toLowerCase() || '';
    
    console.error('*** SUBCOUNTY ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // Keywords that indicate subcounty queries
    const subcountyKeywords = ['township', 'zip code', 'zipcode', 'zip', 'place', 'city', 'town', 'village', 'cdp'];
    const hasSubCountyKeyword = subcountyKeywords.some(keyword => text.includes(keyword));
    
    // Keywords that indicate ALICE-related queries
    const aliceKeywords = ['alice', 'poverty', 'household', 'below'];
    const hasAliceKeyword = aliceKeywords.some(keyword => text.includes(keyword));
    
    // Exclude if it's clearly a county-level query
    const countyKeywords = ['county', 'counties'];
    const isCountyQuery = countyKeywords.some(keyword => text.includes(keyword)) && 
                          !hasSubCountyKeyword;
    
    const shouldTrigger = hasSubCountyKeyword && hasAliceKeyword && !isCountyQuery;
    
    console.error('*** SubCounty keyword:', hasSubCountyKeyword);
    console.error('*** ALICE keyword:', hasAliceKeyword);
    console.error('*** County query (excluded):', isCountyQuery);
    console.error('*** VALIDATION RESULT:', shouldTrigger ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END SUBCOUNTY VALIDATION ***\n');
    
    return shouldTrigger;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      console.error('*** SUBCOUNTY ACTION HANDLER CALLED ***');
      const text = (message.content as any).text || '';
      console.error('*** Processing query:', text);
      
      // Get CSV service
      let csvService = (runtime as any).csvDataService as CsvDataService;
      if (!csvService) {
        csvService = (global as any).csvDataService as CsvDataService;
      }
      
      if (!csvService) {
        console.error('*** CSV service not available ***');
        return {
          text: "I cannot access subcounty data at this moment. Please try again later.",
          success: false
        };
      }
      
      console.error('*** CSV service found, searching for subcounty data ***');
      
      // Extract search term from the query
      // Try to identify the location name
      let searchTerm = '';
      
      // Check for zip code pattern (5 digits)
      const zipMatch = text.match(/\b(\d{5})\b/);
      if (zipMatch) {
        searchTerm = zipMatch[1];
        console.error('*** Found zip code:', searchTerm);
      } else {
        // Try to extract place/township name
        // Look for patterns like "in [location]" or "[location] township"
        const patterns = [
          /(?:in|for)\s+([A-Za-z\s]+?)(?:\s+(?:township|city|town|place|zip|zipcode))/i,
          /([A-Za-z\s]+?)\s+(?:township|city|town|place)/i,
          /(?:township|city|town|place)\s+(?:of|in)?\s*([A-Za-z\s]+)/i
        ];
        
        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1]) {
            searchTerm = match[1].trim();
            console.error('*** Extracted search term:', searchTerm);
            break;
          }
        }
      }
      
      if (!searchTerm) {
        console.error('*** Could not extract search term from query ***');
        return {
          text: "I couldn't identify the specific location you're asking about. Please specify a township, place, city, or zip code name.",
          success: false
        };
      }
      
      // Search for the subcounty data
      const subcountyData = csvService.findSubCounty(searchTerm);
      
      if (!subcountyData) {
        console.error('*** Subcounty data not found for:', searchTerm);
        return {
          text: `I couldn't find data for "${searchTerm}". Please check the spelling or try a different location name.`,
          success: false
        };
      }
      
      console.error('*** Found subcounty data:', subcountyData.geo_display_label);
      
      // Calculate ALICE percentage
      const alicePercentage = Math.round((subcountyData.alice_households / subcountyData.households) * 100);
      const povertyPercentage = Math.round((subcountyData.poverty_households / subcountyData.households) * 100);
      const combinedThreshold = alicePercentage + povertyPercentage;
      
      // Format type for display
      const typeDisplay = subcountyData.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      
      // Clean up display label by removing ' city' and ' town' suffixes
      const cleanLabel = subcountyData.geo_display_label.replace(/ city,/, ',').replace(/ town,/, ',');
      
      // Build response
      let response = `According to my data set, ${cleanLabel}:\n\n`;
      response += `Type: ${typeDisplay}\n`;
      response += `County: ${subcountyData.county}\n`;
      response += `ALICE households: ${alicePercentage}% (${subcountyData.alice_households.toLocaleString()} households)\n`;
      response += `Households in poverty: ${povertyPercentage}% (${subcountyData.poverty_households.toLocaleString()} households)\n`;
      response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n`;
      response += `Above ALICE threshold: ${subcountyData.above_alice_households.toLocaleString()} households\n`;
      response += `Total households: ${subcountyData.households.toLocaleString()}\n`;
      response += `Year: ${subcountyData.year}\n\n`;
      response += `This means ${subcountyData.alice_households.toLocaleString()} households in this ${typeDisplay.toLowerCase()} are specifically ALICE (above poverty but below the cost of basic needs).`;
      
      console.error('*** Returning successful response ***');
      
      const result = {
        text: response,
        success: true,
        action: 'SUBCOUNTY_DATA_RETRIEVED'
      };
      
      // Signal completion to ElizaOS via callback
      if (callback) {
        console.error('*** SUBCOUNTY: Calling callback with result ***');
        callback(result);
        console.error('*** SUBCOUNTY: Action completed ***');
        // Return early after callback to prevent double response
        return true;
      }
      
      console.error('*** SUBCOUNTY: Returning result (no callback) ***');
      return result;
      
    } catch (error) {
      console.error('*** Error in subcounty handler:', error);
      const errorMessage = "I encountered an error while searching for subcounty data. Please try again.";
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "What's the ALICE rate in Fayetteville city?"
        }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "According to my data set, Fayetteville city, Arkansas...",
          action: "SEARCH_SUBCOUNTY"
        }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "How many ALICE households are in zip code 72701?"
        }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "According to my data set for zip code 72701...",
          action: "SEARCH_SUBCOUNTY"
        }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Tell me about ALICE households in Gum Pond township"
        }
      },
      {
        name: "{{agentName}}",
        content: {
          text: "According to my data set, Gum Pond township...",
          action: "SEARCH_SUBCOUNTY"
        }
      }
    ]
  ]
};
