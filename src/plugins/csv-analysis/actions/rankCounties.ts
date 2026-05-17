import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const rankCountiesAction: Action = {
  name: 'Ranking locations...',
  similes: ['highest', 'lowest', 'most', 'fewest', 'fewer', 'least', 'minimum', 'maximum', 'rank counties', 'top counties', 'bottom counties', 'worst counties', 'best counties', 'largest', 'smallest', 'greatest'],
  description: 'Rank Arkansas counties and cities by ALICE, threshold, or poverty metrics',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    
    console.error('\n*** RANK COUNTIES VALIDATION ***');
    console.error('*** Query:', text);
    
    // Exclude queries handled by other actions
    const isComparison = text.includes('compare') || text.includes('versus') || text.includes(' vs ');
    const isDemographic = (text.includes('demographic') || text.includes('race') || text.includes('ethnicity') ||
                          text.includes('white household') || text.includes('black household') ||
                          text.includes('hispanic household')) && !text.includes('county') && !text.includes('city');
    const isEmployment = text.includes('worker') || text.includes('occupation') || text.includes('sector') || text.includes('industry');
    const isStatewide = (text.includes('arkansas') || text.includes('statewide')) && 
                       !text.includes('county') && !text.includes('city') && !text.includes('town');
    
    console.error('*** Exclusions - comparison:', isComparison, 'demographic:', isDemographic, 'employment:', isEmployment, 'statewide:', isStatewide);
    
    if (isComparison || isDemographic || isEmployment || isStatewide) {
      console.error('*** EXCLUDED - returning false');
      return false;
    }
    
    // Check for ranking keywords (comprehensive variations)
    const hasRankKeyword = text.includes('highest') || text.includes('lowest') ||
                          text.includes('most') || text.includes('fewest') || text.includes('fewer') ||
                          text.includes('least') || text.includes('minimum') || text.includes('maximum') ||
                          text.includes('rank') || text.includes('top') || text.includes('bottom') ||
                          text.includes('worst') || text.includes('best') ||
                          text.includes('largest') || text.includes('smallest') ||
                          text.includes('greatest') ||
                          (text.includes('percentage') && text.includes('county'));
                          // Note: bare 'more'/'less' deliberately excluded - they
                          // hijack phrases like "tell me more about <county>".
    
    // Check for ALICE-related terms
    const hasAliceTerms = text.includes('alice') || text.includes('threshold') || 
                         text.includes('poverty') || text.includes('poor');
    
    console.error('*** hasRankKeyword:', hasRankKeyword, 'hasAliceTerms:', hasAliceTerms);
    
    const result = hasRankKeyword && hasAliceTerms;
    console.error('*** RANK COUNTIES VALIDATION RESULT:', result ? 'TRUE - WILL TRIGGER' : 'FALSE - WILL NOT TRIGGER');
    
    return result;
  },
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    console.error('*** RANK COUNTIES HANDLER TRIGGERED ***');
    const csvService = (runtime as any).csvDataService as CsvDataService;
    const text = message.content.text?.toLowerCase() || '';
    
    // Parse query intent
    // Determine metric type
    const isThreshold = text.includes('threshold') || text.includes('below alice');
    const isPoverty = text.includes('poverty') || text.includes('poor');
    const isAlice = !isThreshold && !isPoverty; // Default to ALICE
    
    // Determine value type (percentage vs count)
    // Explicit mentions of rate/percentage take priority
    const explicitlyWantsRate = text.includes('rate') || text.includes('percentage') || text.includes('%');
    const explicitlyWantsCount = text.includes('number of') || text.includes('count of') || 
                                 text.includes('how many') || text.includes('total households');
    
    let wantsCount = false;
    let wantsPercentage = false;
    
    if (explicitlyWantsRate) {
      wantsPercentage = true;
      wantsCount = false;
    } else if (explicitlyWantsCount) {
      wantsCount = true;
      wantsPercentage = false;
    } else {
      // Infer from context: if "households" appears with ranking keywords, assume count
      const hasHouseholdsWithRanking = text.includes('households') && 
        (text.includes('most') || text.includes('fewest') || text.includes('fewer') || 
         text.includes('least') || text.includes('maximum') || text.includes('minimum') ||
         text.includes('largest') || text.includes('smallest'));
      
      wantsCount = hasHouseholdsWithRanking;
      wantsPercentage = !wantsCount; // Default to percentage
    }
    
    // Determine location scope: county (default), city/place, or zip code
    const wantsZipCode = text.includes('zip code') || text.includes('zipcode') ||
                         text.includes('zip codes') || /\bzip\b/.test(text);
    const wantsSubcounty = wantsZipCode ||
                          text.includes('city') || text.includes('cities') ||
                          text.includes('town') || text.includes('towns') ||
                          text.includes('place');
    const wantsCounty = !wantsSubcounty; // Default to counties
    
    // Determine sort direction
    const isDescending = text.includes('highest') || text.includes('most') || text.includes('worst') ||
                        text.includes('maximum') || text.includes('greatest') || text.includes('largest') ||
                        text.includes('more');
    const isAscending = text.includes('lowest') || text.includes('fewest') || text.includes('best') ||
                       text.includes('least') || text.includes('fewer') || text.includes('minimum') ||
                       text.includes('smallest') || text.includes('less');
    
    // Build results array
    interface RankResult {
      name: string;
      percentage: number;
      count: number;
      totalHouseholds: number;
    }
    
    let results: RankResult[] = [];
    let locationScope = '';
    let metricName = '';
    let valueType = '';
    
    if (wantsCounty) {
      const allCounties = csvService.getAllCounties();
      
      if (allCounties.length === 0) {
        const errResult = {
          text: "I couldn't access the county data. Please try again.",
          success: false
        };
        if (callback) { callback(errResult); return true; }
        return errResult;
      }
      
      locationScope = 'counties';
      
      if (isAlice && wantsPercentage) {
        metricName = 'ALICE rate';
        valueType = 'percentage';
        results = allCounties.map(c => ({
          name: c.county,
          percentage: c.alice_percentage,
          count: c.alice_housholds,
          totalHouseholds: c.households
        }));
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isAlice && wantsCount) {
        metricName = 'ALICE households';
        valueType = 'count';
        results = allCounties.map(c => ({
          name: c.county,
          percentage: c.alice_percentage,
          count: c.alice_housholds,
          totalHouseholds: c.households
        }));
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      } else if (isThreshold && wantsPercentage) {
        metricName = 'households below ALICE threshold';
        valueType = 'percentage';
        results = allCounties.map(c => ({
          name: c.county,
          percentage: c.below_alice_percentage,
          count: Math.round(c.households * c.below_alice_percentage / 100),
          totalHouseholds: c.households
        }));
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isThreshold && wantsCount) {
        metricName = 'households below ALICE threshold';
        valueType = 'count';
        results = allCounties.map(c => {
          const count = Math.round(c.households * c.below_alice_percentage / 100);
          return {
            name: c.county,
            percentage: c.below_alice_percentage,
            count: count,
            totalHouseholds: c.households
          };
        });
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      } else if (isPoverty && wantsPercentage) {
        metricName = 'poverty rate';
        valueType = 'percentage';
        results = allCounties.map(c => ({
          name: c.county,
          percentage: c.poverty,
          count: Math.round(c.households * c.poverty / 100),
          totalHouseholds: c.households
        }));
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isPoverty && wantsCount) {
        metricName = 'households in poverty';
        valueType = 'count';
        results = allCounties.map(c => {
          const count = Math.round(c.households * c.poverty / 100);
          return {
            name: c.county,
            percentage: c.poverty,
            count: count,
            totalHouseholds: c.households
          };
        });
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      }
    } else {
      // Handle cities/places or zip codes. getAllSubCounty() mixes Place,
      // Sub_County and Zip_Code rows, so filter to the requested type. Also
      // drop very small entries whose rates would be statistical noise.
      const targetType = wantsZipCode ? 'Zip_Code' : 'Place';
      const MIN_HOUSEHOLDS = 500;
      const allSubcounty = csvService.getAllSubCounty()
        .filter(s => s.type === targetType && s.households >= MIN_HOUSEHOLDS);

      if (allSubcounty.length === 0) {
        const errResult = {
          text: "I couldn't access the subcounty data. Please try again.",
          success: false
        };
        if (callback) { callback(errResult); return true; }
        return errResult;
      }

      locationScope = wantsZipCode ? 'zip codes' : 'cities and towns';
      
      if (isAlice && wantsPercentage) {
        metricName = 'ALICE rate';
        valueType = 'percentage';
        results = allSubcounty.map(s => {
          const percentage = s.households > 0 ? Math.round((s.alice_households / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: s.alice_households,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isAlice && wantsCount) {
        metricName = 'ALICE households';
        valueType = 'count';
        results = allSubcounty.map(s => {
          const percentage = s.households > 0 ? Math.round((s.alice_households / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: s.alice_households,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      } else if (isThreshold && wantsPercentage) {
        metricName = 'households below ALICE threshold';
        valueType = 'percentage';
        results = allSubcounty.map(s => {
          const belowThreshold = s.alice_households + s.poverty_households;
          const percentage = s.households > 0 ? Math.round((belowThreshold / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: belowThreshold,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isThreshold && wantsCount) {
        metricName = 'households below ALICE threshold';
        valueType = 'count';
        results = allSubcounty.map(s => {
          const belowThreshold = s.alice_households + s.poverty_households;
          const percentage = s.households > 0 ? Math.round((belowThreshold / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: belowThreshold,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      } else if (isPoverty && wantsPercentage) {
        metricName = 'poverty rate';
        valueType = 'percentage';
        results = allSubcounty.map(s => {
          const percentage = s.households > 0 ? Math.round((s.poverty_households / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: s.poverty_households,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      } else if (isPoverty && wantsCount) {
        metricName = 'households in poverty';
        valueType = 'count';
        results = allSubcounty.map(s => {
          const percentage = s.households > 0 ? Math.round((s.poverty_households / s.households) * 100) : 0;
          return {
            name: s.geo_display_label.split(',')[0].trim(),
            percentage: percentage,
            count: s.poverty_households,
            totalHouseholds: s.households
          };
        });
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      }
    }
    
    // Get top 10
    const top10 = results.slice(0, 10);
    
    // Build response
    const direction = isDescending ? 'highest' : 'lowest';
    let title = `${locationScope} with ${direction} ${metricName}`;
    
    let response = `According to my data set, here are the ${title}:\n\n`;
    
    top10.forEach((item, index) => {
      if (valueType === 'count') {
        response += `${index + 1}. ${item.name}: ${item.count.toLocaleString()} households (${item.percentage}%)\n`;
      } else {
        response += `${index + 1}. ${item.name}: ${item.percentage}% (${item.count.toLocaleString()} households)\n`;
      }
    });
    
    const result = {
      text: response,
      success: true
    };
    
    if (callback) {
      console.error('*** RANK COUNTIES: Calling callback with result ***');
      callback(result);
      return true;
    }
    
    return result;
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Which counties have the highest ALICE rates?" }
      },
      {
        name: "Alice",
        content: { text: "According to my data set, here are the Counties with highest ALICE rates:\n\n1. Lee County: 66% (2,641 households)\n2. Phillips County: 60% (8,234 households)\n3. Johnson County: 54% (10,047 households)" }
      }
    ]
  ]
};
