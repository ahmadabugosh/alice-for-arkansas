import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

export const rankCountiesAction: Action = {
  name: 'Ranking locations...',
  similes: ['highest', 'lowest', 'most', 'fewest', 'fewer', 'least', 'minimum', 'maximum', 'rank counties', 'top counties', 'bottom counties', 'worst counties', 'best counties', 'largest', 'biggest', 'smallest', 'greatest'],
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
                          text.includes('largest') || text.includes('biggest') || text.includes('smallest') ||
                          text.includes('greatest') ||
                          (text.includes('percentage') && text.includes('county'));
                          // Note: bare 'more'/'less' deliberately excluded - they
                          // hijack phrases like "tell me more about <county>".
    
    // Check for ALICE-related terms
    const hasAliceTerms = text.includes('alice') || text.includes('threshold') || 
                         text.includes('poverty') || text.includes('poor');
    const isLocationSizeQuery =
      (text.includes('city') || text.includes('cities') || text.includes('town') || text.includes('towns') || text.includes('place')) &&
      (text.includes('largest') || text.includes('biggest') || text.includes('smallest'));
    
    console.error('*** hasRankKeyword:', hasRankKeyword, 'hasAliceTerms:', hasAliceTerms);
    
    const result = hasRankKeyword && (hasAliceTerms || isLocationSizeQuery);
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
    const hasAliceTerms = text.includes('alice') || text.includes('threshold') ||
                         text.includes('poverty') || text.includes('poor');
    
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
      // Infer from context: a count noun (households / people / members / etc.)
      // with a ranking keyword means the user wants absolute counts, e.g.
      // "most members of the ALICE community" -> most ALICE households.
      const hasCountNoun = /\b(households?|people|persons?|residents?|families|individuals?|members?|population)\b/.test(text);
      const hasRankingKeyword =
        text.includes('most') || text.includes('fewest') || text.includes('fewer') ||
        text.includes('least') || text.includes('maximum') || text.includes('minimum') ||
        text.includes('largest') || text.includes('biggest') || text.includes('smallest');

      wantsCount = hasCountNoun && hasRankingKeyword;
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
                        text.includes('maximum') || text.includes('greatest') || text.includes('largest') || text.includes('biggest') ||
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
    
    const countyForLocationSize = !wantsZipCode && wantsSubcounty
      ? csvService.getAllCounties().find((county) => {
        const countyName = county.county.toLowerCase().replace(/\s+county$/, '');
        return new RegExp(`\\b${countyName.replace(/\./g, '\\.')}\\b`).test(text);
      })
      : undefined;
    // Pure size questions ("biggest town in Scott County?") aren't ALICE
    // questions — decline and steer toward questions the data can answer.
    const isLocationSizeQuery =
      wantsSubcounty && !wantsZipCode &&
      (text.includes('largest') || text.includes('biggest') || text.includes('smallest')) &&
      !hasAliceTerms;

    if (isLocationSizeQuery) {
      // Bare "Arkansas" means the state, not Arkansas County.
      const countyName =
        countyForLocationSize?.county === 'Arkansas County' && !text.includes('arkansas county')
          ? undefined
          : countyForLocationSize?.county;
      let response = `I focus on ALICE data for Arkansas — households that are Asset Limited, Income Constrained, Employed — so ranking cities or towns by size isn't something my data set covers.\n\n`;
      response += `I'd be happy to help with an ALICE question instead. For example:\n`;
      if (countyName) {
        response += `- What's the ALICE rate in ${countyName}?\n`;
        response += `- How many households in ${countyName} are below the ALICE threshold?\n`;
        response += `- Which Arkansas city has the highest ALICE rate?`;
      } else {
        response += `- What's the ALICE rate in Arkansas?\n`;
        response += `- Which county has the highest ALICE rate?\n`;
        response += `- Which Arkansas city has the highest ALICE rate?`;
      }

      const result = { text: response, success: true };
      if (callback) { callback(result); return true; }
      return result;
    }

    let rankingYear: number | undefined;

    if (wantsCounty) {
      // Rank on the latest-year county time series (exact counts per ALICE
      // band), falling back to the legacy 2023 county file if it's missing.
      const tsRows =
        typeof csvService.getCountyTimeSeriesByYear === 'function'
          ? csvService.getCountyTimeSeriesByYear()
          : [];
      const countyRows = tsRows.length
        ? tsRows.map(r => ({
            county: /\bcounty$/i.test(r.county) ? r.county : `${r.county} County`,
            households: r.households,
            alice_count: r.alice,
            alice_percentage: r.households > 0 ? Math.round((r.alice / r.households) * 100) : 0,
            poverty_count: r.poverty,
            poverty_percentage: r.households > 0 ? Math.round((r.poverty / r.households) * 100) : 0,
            below_count: r.alice + r.poverty,
            below_percentage: r.households > 0 ? Math.round(((r.alice + r.poverty) / r.households) * 100) : 0,
            year: r.year
          }))
        : csvService.getAllCounties().map(c => ({
            county: c.county,
            households: c.households,
            alice_count: c.alice_housholds,
            alice_percentage: c.alice_percentage,
            poverty_count: Math.round(c.households * c.poverty / 100),
            poverty_percentage: c.poverty,
            below_count: Math.round(c.households * c.below_alice_percentage / 100),
            below_percentage: c.below_alice_percentage,
            year: c.year
          }));

      if (countyRows.length === 0) {
        const errResult = {
          text: "I couldn't access the county data. Please try again.",
          success: false
        };
        if (callback) { callback(errResult); return true; }
        return errResult;
      }

      locationScope = 'counties';
      rankingYear = countyRows[0].year;

      if (isAlice) {
        metricName = wantsCount ? 'ALICE households' : 'ALICE rate';
        valueType = wantsCount ? 'count' : 'percentage';
        results = countyRows.map(c => ({
          name: c.county,
          percentage: c.alice_percentage,
          count: c.alice_count,
          totalHouseholds: c.households
        }));
      } else if (isThreshold) {
        metricName = 'households below ALICE threshold';
        valueType = wantsCount ? 'count' : 'percentage';
        results = countyRows.map(c => ({
          name: c.county,
          percentage: c.below_percentage,
          count: c.below_count,
          totalHouseholds: c.households
        }));
      } else if (isPoverty) {
        metricName = wantsCount ? 'households in poverty' : 'poverty rate';
        valueType = wantsCount ? 'count' : 'percentage';
        results = countyRows.map(c => ({
          name: c.county,
          percentage: c.poverty_percentage,
          count: c.poverty_count,
          totalHouseholds: c.households
        }));
      }
      if (valueType === 'count') {
        results.sort((a, b) => isDescending ? b.count - a.count : a.count - b.count);
      } else {
        results.sort((a, b) => isDescending ? b.percentage - a.percentage : a.percentage - b.percentage);
      }
    } else {
      // Handle cities/towns/places or zip codes on the latest-year subcounty
      // set, so every entry in the ranking comes from the same (newest) year.
      // The data mixes Place, Sub_County and Zip_Code rows, so filter to the
      // requested type; also drop very small entries whose rates would be
      // statistical noise.
      const targetType = wantsZipCode ? 'Zip_Code' : 'Place';
      const MIN_HOUSEHOLDS = 500;
      const wantsCityOnly = !wantsZipCode && (text.includes('city') || text.includes('cities'));
      const wantsTownOnly = !wantsZipCode && !wantsCityOnly && (text.includes('town') || text.includes('towns'));
      const allSubcounty = csvService.getAllSubCountyLatest()
        .filter(s => {
          if (s.type !== targetType || s.households < MIN_HOUSEHOLDS) {
            return false;
          }

          const label = s.geo_display_label.toLowerCase();
          if (wantsCityOnly) {
            return label.includes(' city,');
          }
          if (wantsTownOnly) {
            return label.includes(' town,');
          }
          return true;
        });

      if (allSubcounty.length === 0) {
        const errResult = {
          text: "I couldn't access the subcounty data. Please try again.",
          success: false
        };
        if (callback) { callback(errResult); return true; }
        return errResult;
      }

      locationScope = wantsZipCode ? 'zip codes' : wantsCityOnly ? 'cities' : wantsTownOnly ? 'towns' : 'places';
      rankingYear = allSubcounty[0]?.year;
      
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
    // Every ranking uses the latest year available for its geography level.
    const yearLabel = rankingYear ? ` (${rankingYear} data, latest available)` : '';

    let response = `According to my data set, here are the ${title}${yearLabel}:\n\n`;
    
    top10.forEach((item, index) => {
      if (valueType === 'count') {
        response += `${index + 1}. ${item.name}: ${item.count.toLocaleString()} households (${item.percentage}%)\n`;
      } else {
        response += `${index + 1}. ${item.name}: ${item.percentage}% (${item.count.toLocaleString()} households)\n`;
      }
    });

    // "Lowest/fewest" place rankings are shaped by the small-place filter -
    // say so instead of implying every tiny town was considered.
    if (!wantsCounty && !isDescending) {
      response += `\nNote: this ranking only includes ${locationScope} with at least 500 households, so very small places aren't listed.`;
    }

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
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        name: "Alice",
        content: { text: "According to my data set, here are the counties with highest ALICE rate ([year from CSV] data):\n\n1. [County]: [percent from CSV]% ([count from CSV] households)\n2. [County]: [percent from CSV]% ([count from CSV] households)\n3. [County]: [percent from CSV]% ([count from CSV] households)" }
      }
    ]
  ]
};
