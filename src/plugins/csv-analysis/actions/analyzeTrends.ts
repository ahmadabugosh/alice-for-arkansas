import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';
import { AR_COUNTY_NAMES } from '../constants/arkansasCounties';


// True when the query names a specific county (so the county action, not the
// statewide trends action, should answer). "in Arkansas" alone is the state.
function namesSpecificCounty(text: string): boolean {
  const t = text.toLowerCase().replace(/[-–—]/g, ' ');
  return AR_COUNTY_NAMES.some((c) => {
    const esc = c.replace(/\./g, '\\.');
    if (new RegExp(`\\b${esc}\\s+count(?:y|ies)\\b`, 'i').test(t)) return true;
    return c !== 'arkansas' && new RegExp(`\\b(?:in|for|within)\\s+${esc}\\b`, 'i').test(t);
  });
}

export const analyzeTrendsAction: Action = {
  name: 'Analyzing trends data...',
  similes: [
    'ANALYZE_TRENDS',
    'trends',
    'changes over time',
    'historical',
    'year over year',
    'growth',
    'decline',
    'statewide alice rate',
    'cost of living',
    'median income'
  ],
  description: 'Analyze Arkansas ALICE trends and historical changes',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    console.error('\n*** TRENDS ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // Check for trend-related keywords
    const trendKeywords = [
      'trend', 'trends', 'change', 'changes', 'historical', 'history',
      'over time', 'year', 'years', 'growth', 'decline', 'increase',
      'decrease', 'rising', 'falling', 'pattern', 'progression',
      'grown', 'grow', 'growing', 'grew', 'since', 'collected', 'span'
    ];
    
    const hasTrendKeyword = trendKeywords.some(keyword => text.includes(keyword));
    
    // Check for specific metric keywords
    const metricKeywords = [
      'statewide alice rate', 'cost of living', 'median income',
      'household income', 'inflation', 'economic'
    ];
    
    const hasMetricKeyword = metricKeywords.some(keyword => text.includes(keyword));
    
    // Check if asking about Arkansas/state data over time (any 4-digit year counts)
    const hasYearMention = /\b(19|20)\d{2}\b/.test(text);
    const isTimeQuery = (text.includes('alice') || text.includes('arkansas')) &&
                        (hasTrendKeyword || hasYearMention);
    
    // Exclude demographic queries - if it mentions specific demographics, let demographics action handle it
    const isDemographicQuery = ['black', 'white', 'hispanic', 'latino', 'asian', 'native american', 'age', 'household type', 'parent', 'race', 'ethnicity'].some(keyword => text.includes(keyword));
    
    // Defer to the county action when a specific county is named (it can answer
    // that county's time series); the statewide trends action stays statewide.
    const isCountySpecific = namesSpecificCounty(text);

    const result = (hasTrendKeyword || hasMetricKeyword || isTimeQuery) && !isDemographicQuery && !isCountySpecific;
    console.error('*** Trend keyword:', hasTrendKeyword);
    console.error('*** Metric keyword:', hasMetricKeyword);
    console.error('*** Time query:', isTimeQuery);
    console.error('*** Demographic query (excluded):', isDemographicQuery);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END TRENDS VALIDATION ***\n');
    return result;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      console.error('*** TRENDS ACTION HANDLER TRIGGERED ***');
      const csvService = (runtime as any).csvDataService as CsvDataService;
      const text = message.content.text?.toLowerCase() || '';
      
      if (!csvService) {
        const errorResult = "I cannot access my trends data systems right now. Please try again later.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      const trends = csvService.getAllTrends();
      
      if (!trends || trends.length === 0) {
        const errorResult = "I don't have trends data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      let response = "";
      
      // Sort trends by year for chronological display
      const sortedTrends = [...trends].sort((a, b) => a.year - b.year);
      
      // "How many years of data" / data-coverage questions
      if (text.includes('how many year') || text.includes('years of data') ||
          text.includes('years of alice') ||
          ((text.includes('year') || text.includes('data')) &&
           (text.includes('collected') || text.includes('coverage') || text.includes('span')))) {
        const years = [...new Set(trends.map(t => t.year))].sort((a, b) => a - b);
        if (years.length > 0) {
          const yearsResponse =
            `According to my data set, Arkansas ALICE data covers ${years.length} ` +
            `year${years.length === 1 ? '' : 's'}: ${years.join(', ')}.`;
          const yearsResult = { text: yearsResponse, success: true, action: 'TRENDS_DATA_RETRIEVED' };
          if (callback) {
            callback(yearsResult);
            return true;
          }
          return yearsResult;
        }
      }

      // ALICE household COUNT questions (e.g. "have ALICE households grown since 2020?")
      const asksAliceHouseholdCount =
        text.includes('alice household') ||
        text.includes('number of alice') ||
        (text.includes('alice') && text.includes('household') && !text.includes('rate'));

      if (asksAliceHouseholdCount) {
        const aliceData = sortedTrends.filter(t => t.metric === 'ALICE Households');
        if (aliceData.length >= 2) {
          // Honor an optional "since/from/after/in YYYY" lower bound
          const sinceMatch = text.match(/\b(?:since|from|after|in)\s+((?:19|20)\d{2})\b/);
          const fromYear = sinceMatch ? parseInt(sinceMatch[1], 10) : null;

          let windowed = fromYear ? aliceData.filter(t => t.year >= fromYear) : aliceData;
          // If the cutoff leaves fewer than 2 points, pull in the prior point for context
          if (windowed.length < 2) {
            const startIdx = windowed.length
              ? aliceData.findIndex(t => t.year === windowed[0].year)
              : aliceData.length;
            windowed = startIdx > 0 ? aliceData.slice(startIdx - 1) : aliceData;
          }

          const first = windowed[0];
          const last = windowed[windowed.length - 1];
          const diff = last.value - first.value;
          const pct = first.value > 0
            ? Math.round((diff / first.value) * 1000) / 10
            : 0;

          response = `According to my data set, ALICE households in Arkansas`;
          response += fromYear ? ` since ${first.year}:\n\n` : `:\n\n`;
          windowed.forEach(t => {
            response += `${t.year}: ${t.value.toLocaleString()} households\n`;
          });
          response += `\n`;
          if (diff > 0) {
            response += `ALICE households grew by ${diff.toLocaleString()} (${pct}%) from ${first.year} to ${last.year}.`;
          } else if (diff < 0) {
            response += `ALICE households fell by ${Math.abs(diff).toLocaleString()} (${Math.abs(pct)}%) from ${first.year} to ${last.year}.`;
          } else {
            response += `ALICE households were unchanged from ${first.year} to ${last.year}.`;
          }

          const aliceResult = { text: response, success: true, action: 'TRENDS_DATA_RETRIEVED' };
          if (callback) {
            callback(aliceResult);
            return true;
          }
          return aliceResult;
        }
      }

      // Check what specific trend information is being asked for
      if (text.includes('cost of living') || text.includes('inflation')) {
        // Show cost of living trends
        const costData = sortedTrends.filter(t => t.metric === 'Cost of Living Index');
        if (costData.length > 0) {
          response = "According to my data set, here are Arkansas cost of living trends:\n\n";
          costData.forEach(trend => {
            response += `${trend.year}: ${trend.value} (${trend.unit})`;
            if (trend.change_from_previous) {
              response += ` - ${trend.change_from_previous > 0 ? 'increased' : 'decreased'} by ${Math.abs(trend.change_from_previous)} points`;
            }
            if (trend.notes) {
              response += ` - ${trend.notes}`;
            }
            response += "\n";
          });
        } else {
          const msg =
            'My ALICE trend data tracks household counts over time (2010-2023) - ' +
            'ALICE, poverty, above-ALICE, and total households. It does not include ' +
            'a cost-of-living index, so I cannot chart that. I can show how ALICE ' +
            'household counts have changed over the years instead.';
          const noDataResult = { text: msg, success: true, action: 'TRENDS_DATA_RETRIEVED' };
          if (callback) { callback(noDataResult); return true; }
          return noDataResult;
        }
      } else if (text.includes('income') || text.includes('median') || text.includes('household income')) {
        // Show income trends
        const incomeData = sortedTrends.filter(t => t.metric === 'Median Household Income');
        if (incomeData.length > 0) {
          response = "According to my data set, here are Arkansas median household income trends:\n\n";
          incomeData.forEach(trend => {
            response += `${trend.year}: $${trend.value.toLocaleString()}`;
            if (trend.change_from_previous) {
              response += ` - ${trend.change_from_previous > 0 ? 'increased' : 'decreased'} by $${Math.abs(trend.change_from_previous).toLocaleString()}`;
            }
            if (trend.notes) {
              response += ` - ${trend.notes}`;
            }
            response += "\n";
          });
        } else {
          const msg =
            'My ALICE trend data tracks household counts over time (2010-2023) - ' +
            'ALICE, poverty, above-ALICE, and total households. It does not include ' +
            'median household income figures, so I cannot chart that. I can show how ' +
            'ALICE household counts have changed over the years instead.';
          const noDataResult = { text: msg, success: true, action: 'TRENDS_DATA_RETRIEVED' };
          if (callback) { callback(noDataResult); return true; }
          return noDataResult;
        }
      } else if (text.includes('statewide') || text.includes('alice rate') || text.includes('arkansas rate')) {
      // Show statewide trends
      const statewideData = sortedTrends.filter(t => t.metric === 'Statewide ALICE Rate');
      if (statewideData.length > 0) {
        response += "Statewide ALICE Rate:\n";
        statewideData.forEach(trend => {
          response += `${trend.year}: ${trend.value}${trend.unit}\n`;
        });
        response += "\n";
      }
    } else if (text.includes('employment') || text.includes('job')) {
      // Show employment trends
      const employmentData = sortedTrends.filter(t => t.metric.includes('Employment'));
      if (employmentData.length > 0) {
        response += "Employment Trends:\n";
        employmentData.forEach(trend => {
          response += `${trend.metric} (${trend.year}): ${trend.value}${trend.unit}\n`;
        });
        response += "\n";
      } else {
        const msg =
          'My ALICE trend data tracks household counts over time (2010-2023) - ' +
          'ALICE, poverty, above-ALICE, and total households - not employment ' +
          'figures by year. For current employment data, ask about ALICE rates ' +
          'by occupation or sector instead.';
        const noDataResult = { text: msg, success: true, action: 'TRENDS_DATA_RETRIEVED' };
        if (callback) { callback(noDataResult); return true; }
        return noDataResult;
      }
    } else {
      // Show all trends grouped by metric
      const groupedTrends = trends.reduce((acc, trend) => {
        if (!acc[trend.metric]) acc[trend.metric] = [];
        acc[trend.metric].push(trend);
        return acc;
      }, {} as Record<string, typeof trends>);
      
      Object.entries(groupedTrends).forEach(([metric, data]) => {
        response += `${metric}:\n`;
        data.sort((a, b) => a.year - b.year).forEach(trend => {
          // Format numbers with commas for household counts
          const formattedValue = trend.unit.toLowerCase().includes('households') 
            ? trend.value.toLocaleString() 
            : trend.value;
          response += `${trend.year}: ${formattedValue}${trend.unit}`;
          if (trend.change_from_previous) {
            const formattedChange = trend.unit.toLowerCase().includes('households')
              ? Math.abs(trend.change_from_previous).toLocaleString()
              : Math.abs(trend.change_from_previous);
            response += ` (${trend.change_from_previous > 0 ? '+' : '-'}${formattedChange}${trend.unit} from previous)`;
          }
          response += "\n";
        });
        response += "\n";
      });
    }
    
    // Add analysis if there are multiple years of data
    const statewideRates = trends.filter(t => t.metric === 'Statewide ALICE Rate').sort((a, b) => a.year - b.year);
    if (statewideRates.length > 1) {
      const latest = statewideRates[statewideRates.length - 1];
      const previous = statewideRates[statewideRates.length - 2];
      const change = latest.value - previous.value;
      
      if (change > 0) {
        response += `The statewide ALICE rate increased by ${change}% from ${previous.year} to ${latest.year}.`;
      } else if (change < 0) {
        response += `The statewide ALICE rate decreased by ${Math.abs(change)}% from ${previous.year} to ${latest.year}.`;
      } else {
        response += `The statewide ALICE rate remained stable at ${latest.value}% from ${previous.year} to ${latest.year}.`;
      }
    }
    
    const result = {
      text: response,
      success: true,
      action: 'TRENDS_DATA_RETRIEVED'
    };
    
    // Signal completion to ElizaOS via callback
    if (callback) {
      console.error('*** TRENDS: Calling callback with result ***');
      callback(result);
      // Return early after callback to prevent double response
      return true;
    }
    
    console.error('*** TRENDS: Returning result (no callback) ***');
    return result;
    
    } catch (error: any) {
      const errorMessage = "I cannot access my trends data systems right now. Please try again later.";
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What are the Arkansas ALICE trends?" }
      },
      {
        name: "Alice",
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        content: { text: "According to my data set, here are the Arkansas ALICE trends:\n\nStatewide ALICE Rate:\n[year]: [percent from CSV]%\n[year]: [percent from CSV]%\n[year]: [percent from CSV]%\n\nThe statewide ALICE rate [increased/decreased] by [points from CSV] from [year] to [year]." }
      }
    ]
  ]
};
