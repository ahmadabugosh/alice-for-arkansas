import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const compareCountiesAction: Action = {
  name: 'Comparing counties...',
  similes: ['compare counties', 'county comparison', 'versus', 'vs', 'difference between'],
  description: 'Compare ALICE data between multiple Arkansas counties',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    return (text.includes('compare') && text.includes('count')) ||
           text.includes('versus') ||
           text.includes(' vs ') ||
           text.includes('difference between');
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: Function) => {
    const csvService = (runtime as any).csvDataService as CsvDataService;
    const text = message.content.text || '';
    
    // Extract county names - handle multiple patterns
    let countyNames: string[] = [];
    
    // Pattern 1: "Compare X county and Y county" or "X county vs Y county"
    const pattern1 = /([a-z\s]+?)\s+county/gi;
    const matches = text.match(pattern1);
    
    if (matches && matches.length >= 2) {
      countyNames = matches.map(m => m.replace(/\s+county/i, '').trim());
    }
    
    if (countyNames.length < 2) {
      const result = {
        text: "I need at least two county names to compare. Please use format like: 'Compare Benton County and Pulaski County'",
        success: false
      };
      if (callback) callback(result);
      return result;
    }
    
    // Fetch county data
    const counties = countyNames.map(name => csvService.findCounty(name)).filter(Boolean);
    
    if (counties.length < 2) {
      const result = {
        text: `I couldn't find data for some of the counties you mentioned (${countyNames.join(', ')}). Please check the spelling.`,
        success: false
      };
      if (callback) callback(result);
      return result;
    }
    
    // Build detailed comparison response
    let response = `County Comparison Analysis\n\n`;
    
    // Show individual county stats
    counties.forEach(county => {
      response += `${county!.county}:\n`;
      response += `Total households: ${county!.households.toLocaleString()}\n`;
      response += `ALICE households: ${county!.alice_percentage}% (${county!.alice_housholds.toLocaleString()} households)\n`;
      response += `Poverty rate: ${county!.poverty}%\n`;
      response += `Below ALICE threshold: ${county!.below_alice_percentage}%\n`;
      if (county!.priority) {
        response += `Priority County: Yes\n`;
      }
      response += `\n`;
    });
    
    // Comparative analysis
    response += `Analysis:\n`;
    
    // Compare ALICE rates
    const highest = counties.reduce((max, county) => 
      county!.alice_percentage > max!.alice_percentage ? county : max
    );
    const lowest = counties.reduce((min, county) => 
      county!.alice_percentage < min!.alice_percentage ? county : min
    );
    
    const aliceDiff = highest!.alice_percentage - lowest!.alice_percentage;
    response += `ALICE Rate: ${lowest!.county} has a better (lower) rate at ${lowest!.alice_percentage}%, compared to ${highest!.county} at ${highest!.alice_percentage}% (${aliceDiff} percentage point difference).\n`;
    
    // Compare total below ALICE threshold
    const highestTotal = counties.reduce((max, county) => 
      county!.below_alice_percentage > max!.below_alice_percentage ? county : max
    );
    const lowestTotal = counties.reduce((min, county) => 
      county!.below_alice_percentage < min!.below_alice_percentage ? county : min
    );
    
    if (highestTotal !== lowestTotal) {
      response += `Total Below Threshold: ${lowestTotal!.county} has ${lowestTotal!.below_alice_percentage}% below the ALICE threshold, while ${highestTotal!.county} has ${highestTotal!.below_alice_percentage}%.\n`;
    }
    
    // Compare poverty rates
    const highestPoverty = counties.reduce((max, county) => 
      county!.poverty > max!.poverty ? county : max
    );
    const lowestPoverty = counties.reduce((min, county) => 
      county!.poverty < min!.poverty ? county : min
    );
    
    if (highestPoverty !== lowestPoverty) {
      const povertyDiff = highestPoverty!.poverty - lowestPoverty!.poverty;
      response += `Poverty Rate: ${lowestPoverty!.county} has a lower poverty rate at ${lowestPoverty!.poverty}%, compared to ${highestPoverty!.county} at ${highestPoverty!.poverty}% (${povertyDiff} percentage point difference).\n`;
    }
    
    // Compare population sizes
    const largestPop = counties.reduce((max, county) => 
      county!.households > max!.households ? county : max
    );
    const smallestPop = counties.reduce((min, county) => 
      county!.households < min!.households ? county : min
    );
    
    if (largestPop !== smallestPop) {
      const popRatio = (largestPop!.households / smallestPop!.households).toFixed(1);
      response += `Population Size: ${largestPop!.county} is ${popRatio}x larger with ${largestPop!.households.toLocaleString()} households vs ${smallestPop!.households.toLocaleString()}.\n`;
    }
    
    // Priority county status
    const priorityCounties = counties.filter(c => c!.priority);
    if (priorityCounties.length > 0 && priorityCounties.length < counties.length) {
      response += `Priority Status: ${priorityCounties.map(c => c!.county).join(', ')} ${priorityCounties.length === 1 ? 'is' : 'are'} designated as priority for state assistance.\n`;
    }
    
    const result = {
      text: response,
      success: true
    };
    
    if (callback) callback(result);
    return result;
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Compare Johnson County vs Lee County" }
      },
      {
        name: "Alice",
        content: { text: "According to my data set, here's the comparison:\n\nJohnson County: 10,047 households, 54% below ALICE threshold\nLee County: 2,641 households, 66% below ALICE threshold\n\nLee County has the highest rate at 66%, while Johnson County has the lowest at 54%.\nThe difference between Lee County and Johnson County is 12%." }
      }
    ]
  ]
};
