import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const compareCountiesAction: Action = {
  name: 'Comparing counties...',
  similes: ['compare counties', 'county comparison', 'versus', 'vs', 'difference between'],
  description: 'Compare ALICE data between multiple Arkansas counties',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content.text?.toLowerCase() || '').replace(/[-–—]/g, ' ');

    // Explicit comparison verbs
    const hasCompareVerb =
      text.includes('compare') ||
      text.includes('comparison') ||
      text.includes('versus') ||
      text.includes(' vs ') || text.includes(' vs.') ||
      text.includes('difference between');

    // County names, used both for explicit phrasing ("Compare X and Y", with or
    // without the word "county") and implicit comparisons ("Is X higher than Y?").
    const arkansasCounties = [
      'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
      'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
      'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
      'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
      'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
      'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
      'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
      'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell'
    ];
    const namesFound = arkansasCounties.filter(c => {
      // "arkansas" is also the state name - only count it when written "arkansas county"
      const re = c === 'arkansas'
        ? /\barkansas count(?:y|ies)\b/i
        : new RegExp(`\\b${c.replace(/\./g, '\\.')}\\b`, 'i');
      return re.test(text);
    });
    const hasComparative =
      text.includes('than') || text.includes('compared to') ||
      text.includes('higher') || text.includes('lower') ||
      text.includes('more') || text.includes('less') ||
      text.includes('better') || text.includes('worse');

    // Explicit comparison: a compare verb paired with either the word "count(y)"
    // or two recognised county names ("Compare Washington and Union").
    if (hasCompareVerb && (text.includes('count') || namesFound.length >= 2)) {
      return true;
    }

    // Implicit comparison: two county names plus a comparative word,
    // e.g. "Is the ALICE threshold higher in Benton County than Washington County?"
    return namesFound.length >= 2 && hasComparative;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: Function) => {
    const csvService = (runtime as any).csvDataService as CsvDataService;
    const text = message.content.text || '';
    
    // Extract county names by matching the message against the known county
    // list, so natural phrasing works ("Compare Washington and Union counties",
    // "X vs Y", "difference between X and Y", with or without the word "county").
    const arkansasCounties = [
      'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
      'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
      'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
      'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
      'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
      'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
      'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
      'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell'
    ];

    const lowerText = text.toLowerCase().replace(/[-–—]/g, ' ');

    // Find each county that appears, in order of appearance. Longer names are
    // checked first so "little river" / "hot spring" win over a short substring.
    const foundCounties: { name: string; index: number }[] = [];
    for (const county of [...arkansasCounties].sort((a, b) => b.length - a.length)) {
      // "arkansas" is also the state name - only treat it as a county when
      // explicitly written as "arkansas county/counties".
      const pattern = county === 'arkansas'
        ? /\barkansas count(?:y|ies)\b/i
        : new RegExp(`\\b${county.replace(/\./g, '\\.')}\\b`, 'i');
      const match = pattern.exec(lowerText);
      if (match && !foundCounties.some(f => f.name === county)) {
        foundCounties.push({ name: county, index: match.index });
      }
    }

    let countyNames: string[] = foundCounties
      .sort((a, b) => a.index - b.index)
      .map(f => f.name);

    // Fallback: original "X county / Y counties" suffix pattern
    if (countyNames.length < 2) {
      const suffixMatches = text.match(/([a-z\s]+?)\s+count(?:y|ies)/gi);
      if (suffixMatches && suffixMatches.length >= 2) {
        countyNames = suffixMatches.map(m => m.replace(/\s+count(?:y|ies)/i, '').trim());
      }
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

    const isYesNoComparison = /^\s*(?:is|are|does|do|did)\b/i.test(text);
    const isThresholdComparison = lowerText.includes('threshold') || lowerText.includes('below alice');

    if (isYesNoComparison && isThresholdComparison && counties.length >= 2) {
      const [firstCounty, secondCounty] = counties;
      const firstRate = firstCounty!.below_alice_percentage;
      const secondRate = secondCounty!.below_alice_percentage;
      const answer = firstRate > secondRate ? 'Yes' : 'No';
      const relationship = firstRate > secondRate ? 'higher' : firstRate < secondRate ? 'lower' : 'the same';
      const diff = Math.abs(firstRate - secondRate);

      let response =
        `${answer}. Using the county below-ALICE-threshold rate in my dataset, ${firstCounty!.county} is ${relationship} than ${secondCounty!.county}.\n\n`;
      response += `${firstCounty!.county}: ${firstRate}% below the ALICE threshold\n`;
      response += `${secondCounty!.county}: ${secondRate}% below the ALICE threshold`;
      if (diff > 0) {
        response += `\nDifference: ${diff} percentage points`;
      }

      const result = { text: response, success: true };
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
