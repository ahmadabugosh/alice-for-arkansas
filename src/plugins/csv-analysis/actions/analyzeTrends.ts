import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

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
      'decrease', 'rising', 'falling', 'pattern', 'progression'
    ];
    
    const hasTrendKeyword = trendKeywords.some(keyword => text.includes(keyword));
    
    // Check for specific metric keywords
    const metricKeywords = [
      'statewide alice rate', 'cost of living', 'median income',
      'household income', 'inflation', 'economic'
    ];
    
    const hasMetricKeyword = metricKeywords.some(keyword => text.includes(keyword));
    
    // Check if asking about Arkansas/state data over time
    const isTimeQuery = (text.includes('alice') || text.includes('arkansas')) && 
                        (hasTrendKeyword || text.includes('2021') || text.includes('2022') || text.includes('2023'));
    
    // Exclude demographic queries - if it mentions specific demographics, let demographics action handle it
    const isDemographicQuery = ['black', 'white', 'hispanic', 'latino', 'asian', 'native american', 'age', 'household type', 'parent', 'race', 'ethnicity'].some(keyword => text.includes(keyword));
    
    const result = (hasTrendKeyword || hasMetricKeyword || isTimeQuery) && !isDemographicQuery;
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
        content: { text: "According to my data set, here are the Arkansas ALICE trends:\n\nStatewide ALICE Rate:\n2021: 28%\n2022: 29%\n2023: 30%\n\nThe statewide ALICE rate increased by 1% from 2022 to 2023." }
      }
    ]
  ]
};
