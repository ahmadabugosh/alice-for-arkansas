import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, CountyData } from '../services/csvDataService';
import { searchStatewideAction } from './searchStatewide';

// Build a single-county response, defaulting the FULL breakdown to the latest
// year available. The county time series carries the complete ALICE/poverty
// split per year, so nothing has to fall back to an earlier year unless the
// time series is missing entirely.
function buildCountyResponse(csvService: CsvDataService, countyData: CountyData): string {
  let response = `According to my data set, ${countyData.county}:\n\n`;

  const ts =
    typeof csvService.findCountyTimeSeries === 'function'
      ? csvService.findCountyTimeSeries(countyData.county)
      : undefined;

  if (ts && ts.year >= countyData.year && ts.households > 0) {
    const alicePct = Math.round((ts.alice / ts.households) * 100);
    const povertyPct = Math.round((ts.poverty / ts.households) * 100);
    const below = ts.alice + ts.poverty;
    const belowPct = Math.round((below / ts.households) * 100);
    response += `ALICE households: ${alicePct}% (${ts.alice.toLocaleString()} households)\n`;
    response += `Households in poverty: ${povertyPct}% (${ts.poverty.toLocaleString()} households)\n`;
    response += `Total below ALICE threshold: ${belowPct}% (${below.toLocaleString()} households, ALICE + poverty combined)\n`;
    response += `Total households: ${ts.households.toLocaleString()}\n`;
    response += `Year: ${ts.year} (latest available)\n`;
    if (countyData.priority) response += `Priority County: Yes\n`;
    response += `\nThis means ${ts.alice.toLocaleString()} households in ${countyData.county} are specifically ALICE (above poverty but below the cost of basic needs). I also have data for earlier years if you'd like to see the trend.`;
  } else {
    response += `ALICE households: ${countyData.alice_percentage}% (${countyData.alice_housholds.toLocaleString()} households)\n`;
    response += `Households in poverty: ${countyData.poverty}%\n`;
    response += `Total below ALICE threshold: ${countyData.below_alice_percentage}% (ALICE + poverty combined)\n`;
    response += `Total households: ${countyData.households.toLocaleString()}\n`;
    response += `Year: ${countyData.year}\n`;
    if (countyData.priority) response += `Priority County: Yes\n`;
    response += `\nThis means ${countyData.alice_housholds.toLocaleString()} households in ${countyData.county} are specifically ALICE (above poverty but below the cost of basic needs).`;
  }
  return response;
}

export const searchCountyAction: Action = {
  name: 'SEARCH_COUNTY_DATA',
  similes: [
    'SEARCH_COUNTY_DATA',
    'search county',
    'find county',
    'county data', 
    'county statistics',
    'alice rate',
    'households in',
    'tell me about',
    'data for',
    'zip code',
    'zipcode',
    '72560',
    '72701',
    'township',
    'city',
    'town',
    'place',
    'lee county',
    'izard county',
    'hempstead county',
    'pulaski county',
    'randolph county',
    'saline county',
    'little river county'
  ],
  description: 'Search for Arkansas county, zip code, township, city, or place ALICE data - PRIORITY ACTION',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    console.error('\n*** COUNTY ACTION VALIDATION CALLED ***');
    console.error('*** Input text:', text);
    console.error('*** Message content:', JSON.stringify(message.content));
    
    // Match county queries AND subcounty queries (zip codes, townships, places)
    const countyKeywords = ['county', 'counties'];
    const subcountyKeywords = ['township', 'zip code', 'zipcode', 'zip', 'place', 'city', 'town'];
    const allCounties = [
      'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
      'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
      'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
      'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
      'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
      'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
      'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
      'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell'
    ];
    
    // Check for 5-digit zip code (e.g., "72703", "tell me about 72703")
    const zipCodeMatch = text.match(/\b\d{5}\b/);
    const hasZipCode = zipCodeMatch !== null;
    
    // Check for matches
    const hasCountyKeyword = countyKeywords.some(keyword => text.includes(keyword));
    // Use word boundary matching to prevent partial matches (e.g., 'how' matching 'howard')
    // Bare "arkansas" means the state; Arkansas County requires the explicit
    // "Arkansas County" form.
    const hasSpecificCounty = allCounties.some(county => {
      if (county === 'arkansas') return /\barkansas\s+county\b/i.test(text);
      const regex = new RegExp(`\\b${county}\\b`, 'i');
      return regex.test(text);
    });
    const hasSubCountyKeyword = subcountyKeywords.some(keyword => text.includes(keyword));

    // "... in Arkansas" (the state) as the trailing location is a statewide
    // reference, not a county/place this action serves.
    const isBareStateReference =
      /\b(?:in|for|about)\s+(?:the\s+state\s+of\s+)?arkansas\s*[?.!]*$/i.test(text) &&
      !/\barkansas\s+county\b/i.test(text);
    
    // Check if query might be asking about a township/place without using the keyword
    // Look for ALICE-related terms + "in/for/about" + potential location name
    const aliceTerms = ['alice', 'rate', 'data', 'statistics', 'households', 'poverty', 'what', 'tell', 'show', 'how'];
    const hasAliceTerm = aliceTerms.some(term => text.includes(term));
    const hasLocationPreposition = text.includes(' in ') || text.includes(' for ') || text.includes(' about ');
    
    // EXCLUDE queries asking about ALICE itself (e.g., "tell me about ALICE", "what is the ALICE threshold?")
    // Also exclude general concept queries like poverty line, federal poverty level, etc.
    // These patterns take PRIORITY over county/location matching
    // Key distinction: "in Arkansas" (state) is NOT county context, but "in [X] County" IS
    // BUT: "ALICE in [location]" is a LOCATION query, not a concept query
    const hasExplicitCountyKeyword = /\bcounty\b/i.test(text);
    const hasAliceInLocationPattern = /alice\s+in\s+[a-z]/i.test(text);
    
    const isAskingAboutAliceConcept = !hasExplicitCountyKeyword && !hasAliceInLocationPattern && (
      /(?:what\s+is|tell\s+me\s+about|about)\s+alice(?:\s|\?|$)/i.test(text) ||
      /(?:what\s+is|tell me about|explain).*(?:alice\s+threshold|threshold)/i.test(text) ||
      /(?:how\s+is\s+alice|alice\s+(?:mean|stand for|calculated|defined))/i.test(text) ||
      /(?:what\s+is|tell me about).*(?:poverty\s+line|federal\s+poverty|poverty\s+level|fpl)/i.test(text)
    );
    
    // Check if there's a word after the preposition (potential location)
    const hasWordAfterPreposition = /(?:in|for|about)\s+[a-z]+/i.test(text);
    
    const mightBeSubcountyQuery = hasAliceTerm && hasLocationPreposition && hasWordAfterPreposition && !hasSpecificCounty && !isAskingAboutAliceConcept && !isBareStateReference;
    
    // Exclude employment and demographic queries from county action
    const isEmploymentQuery = text.includes('employment') || text.includes('job') || text.includes('occupation') || 
                             text.includes('sector') || text.includes('worker') || text.includes('wage');
    
    // Only exclude demographic queries that are NOT county-specific or subcounty-specific or zip code
    const isDemographicQuery = (text.includes('demographic') || text.includes('race') || text.includes('ethnicity') || 
                              text.includes('age group') || text.includes('household type')) ||
                              // Exclude "households" only if it's NOT in a county/subcounty/zipcode context
                              (text.includes('households') && !hasCountyKeyword && !hasSpecificCounty && !hasSubCountyKeyword && !hasZipCode && !mightBeSubcountyQuery);
    
    // Exclude comparison queries - these should be handled by compareCounties action
    const isComparisonQuery = text.includes('compare') || text.includes('versus') || text.includes(' vs ') || 
                             text.includes('difference between');
    
    // Exclude ranking queries - these should be handled by rankCounties action
    const isRankingQuery = text.includes('highest') || text.includes('lowest') || 
                          text.includes('most') || text.includes('fewest') || text.includes('fewer') ||
                          text.includes('least') || text.includes('minimum') || text.includes('maximum') ||
                          text.includes('rank') || text.includes('top') || text.includes('bottom') ||
                          text.includes('worst') || text.includes('best') ||
                          text.includes('largest') || text.includes('smallest') ||
                          text.includes('greatest');
    // Note: bare 'more'/'less' excluded so "tell me more about <county>" is not
    // misclassified as a ranking query (kept in sync with rankCounties).
    
    // DEBUG: Log all conditions
    console.error('*** VALIDATION DEBUG ***');
    console.error('hasAliceTerm:', hasAliceTerm);
    console.error('hasLocationPreposition:', hasLocationPreposition);
    console.error('hasWordAfterPreposition:', hasWordAfterPreposition);
    console.error('hasAliceInLocationPattern:', hasAliceInLocationPattern);
    console.error('isAskingAboutAliceConcept:', isAskingAboutAliceConcept);
    console.error('mightBeSubcountyQuery:', mightBeSubcountyQuery);
    console.error('hasCountyKeyword:', hasCountyKeyword);
    console.error('hasSpecificCounty:', hasSpecificCounty);
    console.error('hasSubCountyKeyword:', hasSubCountyKeyword);
    console.error('hasZipCode:', hasZipCode);
    console.error('isEmploymentQuery:', isEmploymentQuery);
    console.error('isDemographicQuery:', isDemographicQuery);
    console.error('isComparisonQuery:', isComparisonQuery);
    console.error('isRankingQuery:', isRankingQuery);
    
    // Trigger for county-specific queries OR subcounty queries OR zip codes OR potential township queries (but not employment/demographic/comparison/ranking)
    const shouldTrigger = ((hasCountyKeyword || hasSpecificCounty) || hasSubCountyKeyword || hasZipCode || mightBeSubcountyQuery) && !isEmploymentQuery && !isDemographicQuery && !isAskingAboutAliceConcept && !isComparisonQuery && !isRankingQuery;
    
    console.error('shouldTrigger:', shouldTrigger);
    
    if (shouldTrigger) {
      console.error('*** CSV Action returning TRUE - COUNTY/SUBCOUNTY MATCH ***');
      console.error('*** Match details: county=', hasCountyKeyword, 'specific=', hasSpecificCounty, 'subcounty=', hasSubCountyKeyword, 'zipCode=', hasZipCode, 'employment=', isEmploymentQuery, 'demographic=', isDemographicQuery);
      return true;
    }
    
    console.error('*** CSV Action returning FALSE - no match ***');
    return false;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    console.error('\n\n*** !!! HANDLER EXECUTING !!! ***');
    console.error('*** SEARCH_COUNTY_DATA action triggered ***');
    console.error('*** DIAGNOSTIC: Action started at', new Date().toISOString(), '***');
    console.error('*** Message text:', message.content.text);
    console.error('*** Callback exists:', !!callback);
    
    try {
      
      // Wrap the entire operation in a timeout
      const timeoutMs = parseInt(process.env.CSV_ACTION_TIMEOUT || '15000'); // 15 seconds default
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('CSV action timeout')), timeoutMs)
      );
      
      const actionPromise = async () => {
        // Ensure CSV service is available with retry mechanism
        let csvService = (runtime as any).csvDataService as CsvDataService;
        if (!csvService) {
          csvService = (global as any).csvDataService as CsvDataService;
        }
        
        // If still no service, initialize it now with retry
        if (!csvService) {
          console.error('*** Initializing CSV service on-demand ***');
          let retryCount = 0;
          const maxRetries = parseInt(process.env.CSV_INIT_RETRIES || '3');
          
          while (retryCount < maxRetries && !csvService) {
            try {
              csvService = new CsvDataService();
              await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
              csvService.initialize();
              
              // Store on both runtime and global for future use
              (runtime as any).csvDataService = csvService;
              (global as any).csvDataService = csvService;
              console.error('*** CSV service initialized successfully on-demand ***');
              break;
            } catch (initError) {
              retryCount++;
              console.error(`*** ERROR: Failed to initialize CSV service (attempt ${retryCount}/${maxRetries}) ***`, initError);
              if (retryCount < maxRetries) {
                const delay = parseInt(process.env.CSV_RETRY_DELAY || '200') * retryCount;
                await new Promise(resolve => setTimeout(resolve, delay)); // Exponential backoff
              }
            }
          }
          
          if (!csvService) {
            return {
              success: false,
              text: "I cannot access my data systems right now. Please try again later."
            };
          }
        }
        
        return csvService;
      };
      
      // Race between the action and timeout
      const csvService = await Promise.race([actionPromise(), timeoutPromise]) as CsvDataService;
      
      console.error('*** CSV service found, proceeding with search ***');
      console.error('*** CSV service initialized status:', csvService ? 'YES' : 'NO');
      
      if (!csvService) {
        console.error('*** CRITICAL: CSV service is null after initialization ***');
        const errResult = {
          success: false,
          text: "I cannot access my data systems right now. Please try again later."
        };
        if (callback) callback(errResult);
        return errResult;
      }

      const text = message.content.text || '';
      const isCountyThresholdOrBudgetQuery =
        /\b(?:threshold|survival budget|stability budget|household survival budget|household stability budget)\b/i.test(text);
      console.error('*** Processing query:', text);
      
      // Check if this is a subcounty query (zip code, township, place)
      const subcountyKeywords = ['township', 'zip code', 'zipcode', 'zip', 'place', 'city', 'town'];
      const hasZipCode = /\b\d{5}\b/.test(text);
      const hasSubcountyKeyword = subcountyKeywords.some(keyword => text.toLowerCase().includes(keyword));
      
      // Also check if it might be a subcounty query without the keyword
      const aliceTerms = ['alice', 'rate', 'data', 'statistics', 'households', 'poverty', 'what', 'tell', 'show', 'how'];
      const hasAliceTerm = aliceTerms.some(term => text.toLowerCase().includes(term));
      const hasLocationPreposition = text.toLowerCase().includes(' in ') || text.toLowerCase().includes(' for ') || text.toLowerCase().includes(' about ');
      const hasWordAfterPreposition = /(?:in|for|about)\s+[a-z]+/i.test(text.toLowerCase());
      const allCounties = [
        'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
        'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
        'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
        'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
        'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
        'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
        'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
        'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell'
      ];
      // Use word boundary matching to prevent partial matches (e.g., 'how' matching 'howard')
      // Bare "arkansas" means the state; Arkansas County requires "Arkansas County".
      const hasSpecificCounty = allCounties.some(county => {
        if (county === 'arkansas') return /\barkansas\s+county\b/i.test(text);
        const regex = new RegExp(`\\b${county}\\b`, 'i');
        return regex.test(text);
      });

      // Safety net for the non-deterministic (ElizaOS) path: a query whose only
      // location is the state itself belongs to the statewide action.
      const isBareStateReference =
        /\b(?:in|for|about)\s+(?:the\s+state\s+of\s+)?arkansas\s*[?.!]*$/i.test(text) &&
        !/\barkansas\s+county\b/i.test(text);
      if (isBareStateReference && !hasSpecificCounty && !hasZipCode &&
          !hasSubcountyKeyword && !/\bcounty\b/i.test(text)) {
        console.error('*** Bare "in Arkansas" state reference — delegating to statewide action ***');
        return searchStatewideAction.handler(runtime, message, state, options, callback);
      }
      // Bare names (e.g. "Benton") can go through the lookup table so it can
      // disambiguate Benton city vs Benton County. But when the user explicitly
      // writes "county" (e.g. "...for Benton County"), it is a county query -
      // do NOT divert it to the subcounty/place lookup path.
      const hasExplicitCountyWord = /\bcounty\b/i.test(text);
      const mightBeSubcountyQuery = hasAliceTerm && hasLocationPreposition &&
        hasWordAfterPreposition && !hasExplicitCountyWord;
      
      const isSubCountyQuery = hasSubcountyKeyword || hasZipCode || mightBeSubcountyQuery;
      
      if (isSubCountyQuery) {
        console.error('*** Detected SUBCOUNTY query, searching subcounty data ***');
        
        // Check for explicit type keywords
        const hasExplicitCountyKeyword = text.toLowerCase().includes('county');
        const hasExplicitSubcountyKeyword = text.toLowerCase().includes('subcounty') || text.toLowerCase().includes('township');
        
        // Extract search term
        let searchTerm = '';
        const zipMatch = text.match(/\b(\d{5})\b/);
        if (zipMatch) {
          searchTerm = zipMatch[1];
          console.error('*** Found zip code:', searchTerm);
        } else {
          const lowerText = text.toLowerCase();
          
          // Extract location name - enhanced patterns
          const patterns = [
            // Pattern 1: "for/in/about [Name] township/town/city/place"
            /(?:in|for|about)\s+([a-z\s]+?)(?:\s+(?:township|city|town|place))/i,
            // Pattern 2: "[Name] township/town/city/place" 
            /([a-z\s]+?)\s+(?:township|city|town|place)(?:\s|$|\?)/i,
            // Pattern 3: Simple "tell me about [Name]" or "what is [Name]" (for county-only queries)
            // Stop before 'county' keyword to allow consistent extraction
            /(?:tell me about|what is|show me|about)\s+([a-z][a-z\s]{1,})(?=\s+(?:county|counties)|\s*\?|$)/i,
          ];
          
          for (const pattern of patterns) {
            const match = lowerText.match(pattern);
            if (match && match[1]) {
              let extracted = match[1].trim();
              
              // Strip ALICE-related keywords and common words from the extracted term
              const aliceKeywords = ['alice', 'rate', 'data', 'statistics', 'households', 'poverty', 'about', 'in', 'for', 'at', 'the', 'a', 'an', 'what', 'is', 'are', 'how', 'many'];
              const words = extracted.split(/\s+/);
              const cleanedWords = words.filter(word => !aliceKeywords.includes(word));
              
              if (cleanedWords.length > 0) {
                searchTerm = cleanedWords.join(' ');
                console.error('*** Extracted subcounty search term from pattern:', searchTerm);
                break;
              }
            }
          }
          
          // If no match yet, try to find location after the last "in/for/about"
          if (!searchTerm) {
            // Find all matches of "in/for/about [location]"
            const allMatches = lowerText.matchAll(/(?:in|for|about)\s+([a-z]+(?:\s+[a-z]+)?(?:\s+[a-z]+)?)\b/gi);
            const matchArray = Array.from(allMatches);
            
            // Take the last match (most likely to be the actual location)
            if (matchArray.length > 0) {
              const lastMatch = matchArray[matchArray.length - 1];
              const extracted = lastMatch[1].trim();
              
              // Filter out ALICE-related keywords
              const aliceKeywords = ['alice', 'rate', 'data', 'statistics', 'households', 'poverty', 'what', 'tell', 'show', 'about'];
              if (!aliceKeywords.includes(extracted)) {
                searchTerm = extracted;
                console.error('*** Extracted subcounty search term from last match:', searchTerm);
              }
            }
          }
          
          // If still no match but has township/town keywords, try to extract word before the keyword
          if (!searchTerm && (lowerText.includes('township') || lowerText.includes('town') || lowerText.includes('city') || lowerText.includes('place'))) {
            const beforeKeywordMatch = lowerText.match(/\b([a-z]+(?:\s+[a-z]+)*)\s+(?:township|city|town|place)/i);
            if (beforeKeywordMatch && beforeKeywordMatch[1]) {
              searchTerm = beforeKeywordMatch[1].trim();
              console.error('*** Extracted term before keyword:', searchTerm);
            }
          }

          // A trailing "arkansas" is the state suffix ("Springdale Arkansas"),
          // not part of the place name; and "arkansas" alone means the state —
          // unless anchored to a place keyword ("Arkansas City").
          if (searchTerm) {
            const words = searchTerm.split(/\s+/);
            if (words.length > 1 && words[words.length - 1] === 'arkansas') {
              searchTerm = words.slice(0, -1).join(' ');
              console.error('*** Stripped trailing state suffix, search term:', searchTerm);
            } else if (searchTerm === 'arkansas' && !hasSubcountyKeyword) {
              console.error('*** Bare "arkansas" is the state, not a place — clearing search term');
              searchTerm = '';
            }
          }
        }
        
        if (searchTerm) {
          // For zip codes, use the existing findSubCounty method
          if (zipMatch) {
            const subcountyData = csvService.findSubCounty(searchTerm);
            if (!subcountyData) {
              const errResult = {
                text: `I couldn't find data for zip code "${searchTerm}". Please check the zip code or try searching for cities, towns, counties, or subcounties.`,
                success: false
              };
              if (callback) callback(errResult);
              return errResult;
            }
            
            // Build zip code response (no ambiguity check needed for zip codes)
            const alicePercentage = Math.round((subcountyData.alice_households / subcountyData.households) * 100);
            const povertyPercentage = Math.round((subcountyData.poverty_households / subcountyData.households) * 100);
            const combinedThreshold = Math.round(
              ((subcountyData.alice_households + subcountyData.poverty_households) / subcountyData.households) * 100
            );
            
            let typeDescription = subcountyData.type === 'Sub_County' ? 'Subcounty/Township' : 
              subcountyData.geo_display_label.includes('city') ? 'City' : 
              subcountyData.geo_display_label.includes('town') ? 'Town' : 'Place';
            
            // Clean up display label by removing ' city' and ' town' suffixes
            const cleanLabel = subcountyData.geo_display_label.replace(/ city,/, ',').replace(/ town,/, ',');
            
            let response = `According to my data set, ${cleanLabel}:\n\n`;
            response += `Type: ${typeDescription}\n`;
            response += `County: ${subcountyData.county}\n`;
            response += `ALICE households: ${alicePercentage}% (${subcountyData.alice_households.toLocaleString()} households)\n`;
            response += `Households in poverty: ${povertyPercentage}% (${subcountyData.poverty_households.toLocaleString()} households)\n`;
            response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n`;
            response += `Above ALICE threshold: ${subcountyData.above_alice_households.toLocaleString()} households\n`;
            response += `Total households: ${subcountyData.households.toLocaleString()}\n`;
            response += `Year: ${subcountyData.year} (latest available for this location)`;
            
            const result = { text: response, success: true };
            if (callback) callback(result);
            return result;
          }
          
          // For location names, use lookup table with prioritization
          console.error('*** Looking up location in index:', searchTerm);
          const locationEntries = csvService.lookupLocation(searchTerm);
          
          if (locationEntries.length === 0) {
            // Fallback: Check if search term matches a known county name
            console.error('*** Lookup table returned no results, checking if it\'s a county name:', searchTerm);
            const allCounties = [
              'arkansas', 'ashley', 'baxter', 'benton', 'boone', 'bradley', 'calhoun', 'carroll', 'chicot', 'clark',
              'clay', 'cleburne', 'cleveland', 'columbia', 'conway', 'craighead', 'crawford', 'crittenden', 'cross',
              'dallas', 'desha', 'drew', 'faulkner', 'franklin', 'fulton', 'garland', 'grant', 'greene', 'hempstead',
              'hot spring', 'howard', 'independence', 'izard', 'jackson', 'jefferson', 'johnson', 'lafayette',
              'lawrence', 'lee', 'lincoln', 'little river', 'logan', 'lonoke', 'madison', 'marion', 'miller',
              'mississippi', 'monroe', 'montgomery', 'nevada', 'newton', 'ouachita', 'perry', 'phillips', 'pike',
              'poinsett', 'polk', 'pope', 'prairie', 'pulaski', 'randolph', 'saline', 'scott', 'searcy', 'sebastian',
              'sevier', 'sharp', 'st. francis', 'stone', 'union', 'van buren', 'washington', 'white', 'woodruff', 'yell'
            ];
            
            const normalizedSearch = searchTerm.toLowerCase().trim();
            if (allCounties.includes(normalizedSearch)) {
              console.error('*** Search term matches county name, falling back to direct county data fetch');
              
              // Directly fetch county data using the CSV service
              const countyData = csvService.findCounty(searchTerm);
              
              if (countyData) {
                const response = buildCountyResponse(csvService, countyData);
                const result = { text: response, success: true };
                if (callback) callback(result);
                return result;
              }
            }
            
            const errResult = {
              text: `I couldn't find data for "${searchTerm}". Please check the spelling or try searching for cities, towns, counties, subcounties, or zip codes.`,
              success: false
            };
            if (callback) callback(errResult);
            return errResult;
          }
          
          // Only proceed if we have locationEntries
          if (locationEntries.length > 0) {
          
          console.error(`*** Found ${locationEntries.length} entries for "${searchTerm}":`, 
            locationEntries.map(e => `${e.type}(priority ${e.priority})`).join(', '));
          
          // Determine which entry to return based on explicit keywords and priority
          let selectedEntry = locationEntries[0]; // Default to highest priority
          
          if (hasExplicitCountyKeyword) {
            // User explicitly asked for county
            const countyEntry = locationEntries.find(e => e.type === 'County');
            if (countyEntry) {
              selectedEntry = countyEntry;
              console.error('*** Explicit "county" keyword - selecting County');
            }
          } else if (hasExplicitSubcountyKeyword) {
            // User explicitly asked for subcounty/township
            const subcountyEntry = locationEntries.find(e => e.type === 'Subcounty');
            if (subcountyEntry) {
              selectedEntry = subcountyEntry;
              console.error('*** Explicit "subcounty/township" keyword - selecting Subcounty');
            }
          }
          // Otherwise use default (highest priority = first entry)
          
          console.error(`*** Selected entry: ${selectedEntry.type} (priority ${selectedEntry.priority})`);
          
          // Check if there's ambiguity (and we didn't use explicit keyword)
          const hasAmbiguity = locationEntries.length > 1 && !hasExplicitCountyKeyword && !hasExplicitSubcountyKeyword;
          let ambiguityNote = '';
          
          if (hasAmbiguity) {
            // Find if there's a county with the same name
            const countyEntry = locationEntries.find(e => e.type === 'County');
            if (countyEntry && selectedEntry.type !== 'County') {
              ambiguityNote = `\n\nThere is also ${selectedEntry.name}. To see county-level data, please add "county" to your query.`;
            }
            // Find if there's a subcounty with the same name
            const subcountyEntry = locationEntries.find(e => e.type === 'Subcounty');
            if (subcountyEntry && selectedEntry.type !== 'Subcounty') {
              ambiguityNote += `\n\nThere is also ${selectedEntry.name} township data. To see township-level data, please add "township" to your query.`;
            }
          }
          
          // Get the data reference
          const selectedData = selectedEntry.dataRef;
          
          // Handle based on type
          if (selectedEntry.type === 'County') {
            // Return county data with ambiguity note
            const countyData = selectedData as CountyData;

            let response = buildCountyResponse(csvService, countyData);

            // Add ambiguity note
            response += ambiguityNote;
            
            const result = { text: response, success: true };
            if (callback) callback(result);
            return result;
          } else {
            // Return subcounty/city/town data
            const subcountyData = selectedData as import('../services/csvDataService').SubCountyData;
            console.error('*** Found subcounty data:', subcountyData.geo_display_label);
            console.error('*** Full subcounty data:', JSON.stringify(subcountyData));
            
            // Calculate percentages
            const alicePercentage = Math.round((subcountyData.alice_households / subcountyData.households) * 100);
            const povertyPercentage = Math.round((subcountyData.poverty_households / subcountyData.households) * 100);
            const combinedThreshold = Math.round(
              ((subcountyData.alice_households + subcountyData.poverty_households) / subcountyData.households) * 100
            );
            
            // Determine type description
            let typeDescription = '';
            let locationContext = '';
            if (subcountyData.type === 'Sub_County') {
              typeDescription = 'Subcounty/Township';
              locationContext = 'subcounty';
            } else if (subcountyData.type === 'Place') {
              // Extract city/town from the label
              if (subcountyData.geo_display_label.includes('city')) {
                typeDescription = 'City';
                locationContext = 'city';
              } else if (subcountyData.geo_display_label.includes('town')) {
                typeDescription = 'Town';
                locationContext = 'town';
              } else if (subcountyData.geo_display_label.includes('CDP')) {
                typeDescription = 'Census Designated Place (CDP)';
                locationContext = 'place';
              } else {
                typeDescription = 'Place';
                locationContext = 'place';
              }
            } else {
              typeDescription = subcountyData.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              locationContext = typeDescription.toLowerCase();
            }
            
            // Build response
            // Clean up display label by removing ' city' and ' town' suffixes
            const cleanLabel = subcountyData.geo_display_label.replace(/ city,/, ',').replace(/ town,/, ',');
            
            let response = `According to my data set, ${cleanLabel}:\n\n`;
            response += `Type: ${typeDescription}\n`;
            response += `County: ${subcountyData.county}\n`;
            response += `ALICE households: ${alicePercentage}% (${subcountyData.alice_households.toLocaleString()} households)\n`;
            response += `Households in poverty: ${povertyPercentage}% (${subcountyData.poverty_households.toLocaleString()} households)\n`;
            response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n`;
            response += `Above ALICE threshold: ${subcountyData.above_alice_households.toLocaleString()} households\n`;
            response += `Total households: ${subcountyData.households.toLocaleString()}\n`;
            response += `Year: ${subcountyData.year} (latest available for this location)\n\n`;
            response += `This means ${subcountyData.alice_households.toLocaleString()} households in this ${locationContext} are specifically ALICE (above poverty but below the cost of basic needs).`;
            
            // Add ambiguity note if applicable
            response += ambiguityNote;
            
            const result = {
              text: response,
              success: true
            };
            
            if (callback) {
              console.error('*** Calling callback with subcounty result ***');
              callback(result);
            }
            return result;
          }
          } // End of locationEntries.length > 0 check
        }
        
        // If no search term extracted, return error
        const errResult = {
          text: `I couldn't find a location name in your query. Please specify a city, town, county, subcounty, or zip code.`,
          success: false
        };
        if (callback) callback(errResult);
        return errResult;
      }
      
      // Otherwise, proceed with county search
      console.error('*** Processing as COUNTY query ***');
      
      // Extract county name with improved matching
      const extractCountyName = (text: string): string => {
        let countyName = '';
        
        console.error('*** Extracting county name from text:', text);
        
        // Try different extraction patterns - improved for multi-word counties
        // Pattern 1: "[County Name] County" - captures everything before " County"
        let countyMatch = text.match(/([A-Za-z\s]+?)\s+county/i);
        if (countyMatch) {
          countyName = countyMatch[1].trim();
          console.error('*** Pattern 1 match:', countyName);
        } else {
          // Pattern 2: "County [County Name]" - captures everything after "County "
          countyMatch = text.match(/county\s+([A-Za-z\s]+)/i);
          if (countyMatch) {
            countyName = countyMatch[1].trim();
            console.error('*** Pattern 2 match:', countyName);
          } else {
            // Pattern 3: Look for specific known county names
            const knownCounties = [
              'Little River', 'Hot Spring', 'St. Francis', 'Van Buren',
              'Randolph', 'Saline', 'Johnson', 'Lee', 'Pulaski', 'Washington',
              'Benton', 'Faulkner', 'Garland', 'Sebastian', 'Crawford'
            ];
            
            for (const county of knownCounties) {
              if (text.toLowerCase().includes(county.toLowerCase())) {
                countyName = county;
                console.error('*** Pattern 3 match (known county):', countyName);
                break;
              }
            }
            
            // Pattern 4: Fallback - extract first meaningful word
            if (!countyName) {
              const cleanText = text.replace(/data|alice|rate|households|information|about|what|tell|me|the|for|in/gi, '').trim();
              const words = cleanText.split(/\s+/).filter(word => word.length > 2);
              if (words.length > 0) {
                countyName = words[0];
                console.error('*** Pattern 4 match (fallback):', countyName);
              }
            }
          }
        }
        
        // Clean up the county name
        countyName = countyName.replace(/[^A-Za-z\s]/g, '').trim();
        console.error('*** Final extracted county name:', countyName);
        
        return countyName;
      };
      
      const countyName = extractCountyName(text);
      console.error('*** Extracted county name:', countyName);
        
      if (!countyName) {
        console.error('*** No county name found in query ***');
        const errResult = {
          text: "I need a county name to search for. Please specify which Arkansas county you'd like information about.",
          success: false
        };
        if (callback) callback(errResult);
        return errResult;
      }
      
      // Ensure we have data before proceeding with retry mechanism
      let countyData = null;
      let searchAttempts = 0;
      const maxSearchAttempts = 3;
      
      while (!countyData && searchAttempts < maxSearchAttempts) {
        try {
          console.error(`*** Searching for county: "${countyName}" (attempt ${searchAttempts + 1}) ***`);
          countyData = csvService.findCounty(countyName);
          
          if (countyData) {
            console.error(`*** FOUND COUNTY DATA: ***`);
            console.error(`*** County: ${countyData.county} ***`);
            console.error(`*** Households: ${countyData.households} ***`);
            console.error(`*** ALICE Rate: ${countyData.alice_percentage}% ***`);
            console.error(`*** Year: ${countyData.year} ***`);
            console.error(`*** Priority: ${countyData.priority} ***`);
            console.error(`*** Notes: ${countyData.notes || 'None'} ***`);
            break;
          }
          
          searchAttempts++;
          console.error(`*** County search attempt ${searchAttempts}/${maxSearchAttempts} for: ${countyName} - NOT FOUND ***`);
          
          if (searchAttempts < maxSearchAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (searchError) {
          console.error('*** Error during county search:', searchError);
          searchAttempts++;
          if (searchAttempts < maxSearchAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
      
      console.error('*** CSV search result:', countyData ? `Found: ${countyData.county}` : 'Not found');
      
      if (!countyData) {
        console.error('*** County not found in CSV after retries, returning error ***');
        const errResult = {
          text: `I couldn't find data for "${countyName}" county. Please check the spelling or try a different county name.`,
          success: false
        };
        if (callback) callback(errResult);
        return errResult;
      }
      
      // Add validation to ensure we're returning CSV data
      console.error('*** Validating CSV data for:', countyData.county);
      console.error('*** CSV households:', countyData.households);
      console.error('*** CSV ALICE rate:', countyData.alice_percentage + '%');
      console.error('*** CSV Poverty rate:', countyData.poverty + '%');
      console.error('*** CSV Below ALICE threshold:', countyData.below_alice_percentage + '%');
      console.error('*** CSV ALICE households (actual):', countyData.alice_housholds);
      
      // Use actual ALICE households from CSV data
      const aliceHouseholds = countyData.alice_housholds;
      // Use the exact-derived below-threshold rate; summing the two rounded
      // percentages can be off by a point.
      const combinedThreshold = countyData.below_alice_percentage;

      // County trend over time (2010-2024), from the county time series.
      const isCountyTrendQuery =
        /\b(trend|trends|over time|over the years|throughout the years|year over year|each year|history|historical|grown|grew|growth|declin\w*|increase[ds]?|decrease[ds]?|chang\w*|since \d{4})\b/i.test(text);
      const tsSeries =
        typeof csvService.getCountyTimeSeries === 'function' ? csvService.getCountyTimeSeries(countyData.county) : [];
      if (isCountyTrendQuery && tsSeries.length > 1) {
        let tr = `ALICE trend for ${countyData.county} — households below the ALICE threshold (ALICE + poverty combined):\n\n`;
        tsSeries.forEach((p: any) => {
          const below = p.poverty + p.alice;
          const pct = p.households > 0 ? Math.round((below / p.households) * 100) : 0;
          tr += `  ${p.year}: ${below.toLocaleString()} of ${p.households.toLocaleString()} households (${pct}%)\n`;
        });
        const first = tsSeries[0];
        const last = tsSeries[tsSeries.length - 1];
        const delta = (last.poverty + last.alice) - (first.poverty + first.alice);
        const dir = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change';
        tr += `\nNet change ${first.year}–${last.year}: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} households below the ALICE threshold (${dir}).`;
        const trResult = { text: tr, success: true };
        if (callback) { callback(trResult); return trResult; }
        return trResult;
      }

      let response = `According to my data set, ${countyData.county}:\n\n`;
      const countyTs =
        typeof csvService.findCountyTimeSeries === 'function'
          ? csvService.findCountyTimeSeries(countyData.county)
          : undefined;
      const showThresholdDollars = isCountyThresholdOrBudgetQuery && !!countyTs && /\bthreshold\b/i.test(text);

      if (showThresholdDollars && countyTs) {
        response += `ALICE Threshold for ${countyData.county} (${countyTs.year}) — the annual household income needed to afford basic necessities:\n`;
        response += `  Households under 65: $${countyTs.threshold_under_65.toLocaleString()}/year\n`;
        response += `  Households 65 and over: $${countyTs.threshold_65_plus.toLocaleString()}/year\n\n`;
        response += `In ${countyData.county} (${countyTs.year}), ${(countyTs.poverty + countyTs.alice).toLocaleString()} of ${countyTs.households.toLocaleString()} households are below the ALICE threshold ` +
          `(${Math.round(((countyTs.poverty + countyTs.alice) / countyTs.households) * 100)}%): ${countyTs.alice.toLocaleString()} ALICE + ${countyTs.poverty.toLocaleString()} in poverty.\n\n`;
        response += `Note: For county-level Household Survival/Stability Budget dollar breakdowns, ask e.g. "survival budget for a family of four in ${countyData.county}".`;
      } else if (isCountyThresholdOrBudgetQuery) {
        response += `I don't have county-level ALICE Threshold, Household Survival Budget, or Stability Budget dollar amounts in my dataset.\n\n`;
        response += `What I do have for ${countyData.county} is the below-ALICE-threshold rate:\n`;
        response += `Total below ALICE threshold: ${combinedThreshold}% (ALICE + poverty combined)\n`;
        response += `ALICE households: ${countyData.alice_percentage}% (${aliceHouseholds.toLocaleString()} households)\n`;
        response += `Households in poverty: ${countyData.poverty}%\n`;
        response += `Total households: ${countyData.households.toLocaleString()}\n`;
        response += `Year: ${countyData.year}`;
      } else {
        // Full latest-year breakdown (shared with the location-lookup path).
        response = buildCountyResponse(csvService, countyData);
      }
      
      console.error('*** Returning successful response:', response);
      
      // Always return the actual data immediately - no "looking up" messages
      const result = {
        text: response,
        success: true
      };
      
      console.error('*** Final result being returned:', JSON.stringify(result));
      
      // Signal completion to ElizaOS via callback
      if (callback) {
        console.error('*** DIAGNOSTIC: Calling callback with result ***');
        callback(result);
      }
      
      return result;
      
    } catch (error: any) {
      console.error('*** CSV Action Handler Error ***', error);
      console.error('*** Error stack:', error.stack);
      
      const errorResult = {
        success: false,
        text: "I cannot access my data systems right now. Please try again later."
      };

      console.error('*** Error result being returned:', JSON.stringify(errorResult));
      if (callback) callback(errorResult);
      return errorResult;
    }
  },
  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "What's the ALICE rate for Johnson County?" }
      },
      {
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        name: "Alice",
        content: { text: "According to my data set, [County] County has [households from CSV] households with [percent from CSV]% below the ALICE threshold in [year from CSV]." }
      }
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Tell me about Lee County households" }
      },
      {
        name: "Alice",
        content: { text: "According to my data set, [County] County has [households from CSV] households with [percent from CSV]% below the ALICE threshold in [year from CSV]." }
      }
    ]
  ]
};
