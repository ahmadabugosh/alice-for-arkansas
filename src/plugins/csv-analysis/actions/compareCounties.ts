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

    // Full latest-year stats per county from the county time series (which
    // carries the complete ALICE/poverty split), falling back to the legacy
    // county file only if the series is missing. Priority is the designation
    // from the county file.
    const statsOf = (c: any) => {
      const ts = typeof csvService.findCountyTimeSeries === 'function'
        ? csvService.findCountyTimeSeries(c.county)
        : undefined;
      if (ts && ts.households > 0) {
        return {
          county: c.county as string,
          households: ts.households,
          aliceCount: ts.alice,
          alicePct: Math.round((ts.alice / ts.households) * 100),
          povertyCount: ts.poverty,
          povertyPct: Math.round((ts.poverty / ts.households) * 100),
          belowThreshold: Math.round(((ts.alice + ts.poverty) / ts.households) * 100),
          year: ts.year,
          priority: Boolean(c.priority),
        };
      }
      return {
        county: c.county as string,
        households: c.households as number,
        aliceCount: c.alice_housholds as number,
        alicePct: c.alice_percentage as number,
        povertyCount: Math.round(c.households * c.poverty / 100),
        povertyPct: c.poverty as number,
        belowThreshold: c.below_alice_percentage as number,
        year: c.year as number,
        priority: Boolean(c.priority),
      };
    };
    const latestRows = counties.map(c => statsOf(c));
    const comparisonYear = latestRows[0].year;
    const latestOf = (c: any) => statsOf(c);

    const isYesNoComparison = /^\s*(?:is|are|does|do|did)\b/i.test(text);
    const isThresholdComparison = lowerText.includes('threshold') || lowerText.includes('below alice');

    if (isYesNoComparison && isThresholdComparison && counties.length >= 2) {
      const [firstCounty, secondCounty] = counties;
      const first = latestOf(firstCounty);
      const second = latestOf(secondCounty);
      const firstRate = first.belowThreshold;
      const secondRate = second.belowThreshold;
      const answer = firstRate > secondRate ? 'Yes' : 'No';
      const relationship = firstRate > secondRate ? 'higher' : firstRate < secondRate ? 'lower' : 'the same';
      const diff = Math.abs(firstRate - secondRate);
      const yearNote = first.year === second.year ? ` (${first.year})` : '';

      let response =
        `${answer}. Using the county below-ALICE-threshold rate in my dataset${yearNote}, ${firstCounty!.county} is ${relationship} than ${secondCounty!.county}.\n\n`;
      response += `${firstCounty!.county}: ${firstRate}% below the ALICE threshold\n`;
      response += `${secondCounty!.county}: ${secondRate}% below the ALICE threshold`;
      if (diff > 0) {
        response += `\nDifference: ${diff} percentage points`;
      }

      const result = { text: response, success: true };
      if (callback) callback(result);
      return result;
    }
    
    // Build detailed comparison response — every figure from the same
    // (latest) year, labeled once up front.
    let response = `County Comparison Analysis (${comparisonYear}, latest available)\n\n`;

    // Show individual county stats
    latestRows.forEach(row => {
      response += `${row.county}:\n`;
      response += `Total households: ${row.households.toLocaleString()}\n`;
      response += `ALICE households: ${row.alicePct}% (${row.aliceCount.toLocaleString()} households)\n`;
      response += `Households in poverty: ${row.povertyPct}% (${row.povertyCount.toLocaleString()} households)\n`;
      response += `Below ALICE threshold: ${row.belowThreshold}% (ALICE + poverty combined)\n`;
      response += `\n`;
    });

    // Comparative analysis
    response += `Analysis:\n`;

    // Compare ALICE rates
    const highest = latestRows.reduce((max, r) => (r.alicePct > max.alicePct ? r : max));
    const lowest = latestRows.reduce((min, r) => (r.alicePct < min.alicePct ? r : min));

    if (highest !== lowest) {
      const aliceDiff = highest.alicePct - lowest.alicePct;
      response += `ALICE Rate: ${lowest.county} has a better (lower) rate at ${lowest.alicePct}%, compared to ${highest.county} at ${highest.alicePct}% (${aliceDiff} percentage point difference).\n`;
    }

    // Compare total below ALICE threshold
    const highestTotal = latestRows.reduce((max, r) => (r.belowThreshold > max.belowThreshold ? r : max));
    const lowestTotal = latestRows.reduce((min, r) => (r.belowThreshold < min.belowThreshold ? r : min));

    if (highestTotal !== lowestTotal) {
      response += `Total Below Threshold: ${lowestTotal.county} has ${lowestTotal.belowThreshold}% below the ALICE threshold, while ${highestTotal.county} has ${highestTotal.belowThreshold}%.\n`;
    }

    // Compare poverty rates
    const highestPoverty = latestRows.reduce((max, r) => (r.povertyPct > max.povertyPct ? r : max));
    const lowestPoverty = latestRows.reduce((min, r) => (r.povertyPct < min.povertyPct ? r : min));

    if (highestPoverty !== lowestPoverty) {
      const povertyDiff = highestPoverty.povertyPct - lowestPoverty.povertyPct;
      response += `Poverty Rate: ${lowestPoverty.county} has a lower poverty rate at ${lowestPoverty.povertyPct}%, compared to ${highestPoverty.county} at ${highestPoverty.povertyPct}% (${povertyDiff} percentage point difference).\n`;
    }

    // Compare population sizes
    const largestPop = latestRows.reduce((max, r) => (r.households > max.households ? r : max));
    const smallestPop = latestRows.reduce((min, r) => (r.households < min.households ? r : min));

    if (largestPop !== smallestPop) {
      const popRatio = (largestPop.households / smallestPop.households).toFixed(1);
      response += `Population Size: ${largestPop.county} is ${popRatio}x larger with ${largestPop.households.toLocaleString()} households vs ${smallestPop.households.toLocaleString()}.\n`;
    }

    // Priority county status
    const priorityCounties = latestRows.filter(r => r.priority);
    if (priorityCounties.length > 0 && priorityCounties.length < latestRows.length) {
      response += `Priority Status: ${priorityCounties.map(r => r.county).join(', ')} ${priorityCounties.length === 1 ? 'is' : 'are'} designated as priority for state assistance.\n`;
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
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        name: "Alice",
        content: { text: "According to my data set, here's the comparison:\n\n[County A]: [households from CSV] households, [percent from CSV]% below ALICE threshold\n[County B]: [households from CSV] households, [percent from CSV]% below ALICE threshold\n\n[County B] has the higher rate at [percent from CSV]%, a [difference] percentage point difference ([year from CSV])." }
      }
    ]
  ]
};
