import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, LaborSectorData, LaborJobData } from '../services/csvDataService';

// Occupation-style terms we genuinely have no data for. Sector-level data now
// covers every industry, so this list is only for specific jobs outside the
// 20 largest occupations in the Jobs data.
const SPECIFIC_UNAVAILABLE_CATEGORIES = [
  'landscaping',
  'security guards',
  'security',
  'maintenance',
  'mechanics',
  'plumbers',
  'electricians',
  'welders',
  'bartenders',
  'childcare workers'
];

// Phrases that map a question to an industry sector (Sectors tab of the
// labor force data). Keys must match the Sector values in labor-sectors.csv.
const SECTOR_ALIASES: Record<string, string[]> = {
  'Accommodation and Food Services': ['accommodation', 'food service', 'food services', 'restaurant', 'restaurants', 'hotel', 'hotels', 'hospitality', 'fast food'],
  'Administrative and Support and Waste Management and Remediation Services': ['administrative and support', 'waste management', 'remediation'],
  'Agriculture Forestry Fishing and Hunting': ['agriculture', 'agricultural', 'farming', 'farm', 'farms', 'forestry', 'fishing', 'hunting'],
  'Arts Entertainment and Recreation': ['arts', 'entertainment', 'recreation'],
  'Construction': ['construction', 'construction workers', 'building trades'],
  'Educational Services': ['education', 'educational services', 'schools'],
  'Finance and Insurance': ['finance', 'financial', 'insurance', 'banking'],
  'Health Care and Social Assistance': ['health care', 'healthcare', 'social assistance', 'hospitals', 'medical'],
  'Information': ['information sector', 'information industry'],
  'Management of Companies and Enterprises': ['management of companies'],
  'Manufacturing': ['manufacturing', 'factory', 'factories'],
  'Mining Quarrying and Oil and Gas Extraction': ['mining', 'quarrying', 'oil and gas'],
  'Other Services Except Public Administration': ['other services'],
  'Professional Scientific and Technical Services': ['professional services', 'scientific services', 'technical services'],
  'Public Administration': ['public administration', 'government workers', 'government employees'],
  'Real Estate and Rental and Leasing': ['real estate', 'rental and leasing'],
  'Retail Trade': ['retail', 'retail trade'],
  'Transportation and Warehousing': ['transportation', 'warehousing', 'warehouse', 'trucking'],
  'Utilities': ['utilities', 'utility'],
  'Wholesale Trade': ['wholesale'],
};

// Phrases that map a question to a specific occupation (Jobs tab). Keys must
// match the Occupation values in labor-jobs.csv.
const OCCUPATION_ALIASES: Record<string, string[]> = {
  'Driver/Sales Workers And Truck Drivers': ['truck driver', 'truck drivers', 'delivery driver', 'delivery drivers', 'drivers'],
  'Registered Nurses': ['registered nurse', 'registered nurses', 'nurse', 'nurses', 'nursing'],
  'First-Line Supervisors Of Retail Sales Workers': ['retail supervisors', 'retail sales supervisors'],
  'Elementary And Middle School Teachers': ['elementary teachers', 'middle school teachers', 'elementary and middle school teachers', 'teachers', 'teaching'],
  'Customer Service Representatives': ['customer service'],
  'Retail Salespersons': ['retail salespersons', 'retail sales', 'salespersons'],
  'Cooks': ['cook', 'cooks'],
  'Cashiers': ['cashier', 'cashiers'],
  'Construction Laborers': ['construction laborer', 'construction laborers'],
  'Janitors And Building Cleaners': ['janitor', 'janitors', 'building cleaners', 'cleaners'],
  'Laborers And Freight, Stock, And Material Movers, Hand': ['freight', 'material movers', 'movers', 'laborers'],
  'Nursing Assistants': ['nursing assistant', 'nursing assistants'],
  'Miscellaneous Production Workers, Including Equipment Operators and Tenders': ['production workers', 'equipment operators'],
  'Waiters And Waitresses': ['waiter', 'waiters', 'waitress', 'waitresses', 'server', 'servers'],
  'Stockers And Order Fillers': ['stockers', 'order fillers'],
  'Secretaries And Administrative Assistants, Except Legal, Medical, And Executive': ['secretary', 'secretaries', 'administrative assistant', 'administrative assistants'],
  'Secondary School Teachers': ['secondary teachers', 'secondary school teachers', 'high school teachers'],
  'Personal Care Aides': ['personal care', 'personal care aides', 'care aides'],
  'First-Line Supervisors Of Production And Operating Workers': ['production supervisors'],
  'First-Line Supervisors Of Office And Administrative Support Workers': ['office supervisors', 'administrative support supervisors'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesPhrase(text: string, phrase: string): boolean {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedPhrase = normalizeText(phrase);
  return normalizedPhrase.length > 0 && normalizedText.includes(` ${normalizedPhrase} `);
}

// Returns the entry whose longest alias appears in the text, so a more
// specific phrase ("construction laborers") beats a broader one
// ("construction") when both datasets could answer.
function bestAliasMatch(text: string, aliases: Record<string, string[]>): { key: string; length: number } | undefined {
  let best: { key: string; length: number } | undefined;
  for (const [key, phrases] of Object.entries(aliases)) {
    for (const phrase of [key, ...phrases]) {
      if (includesPhrase(text, phrase)) {
        const length = normalizeText(phrase).length;
        if (!best || length > best.length) {
          best = { key, length };
        }
      }
    }
  }
  return best;
}

// True when the text names an industry sector, an occupation, or generic
// employment vocabulary this action can answer. Earlier actions in the
// cascade (e.g. statewide) use this to stand down so "How many cashiers are
// below the ALICE threshold in Arkansas?" reaches the labor force data.
export function isEmploymentTopic(text: string): boolean {
  const lower = text.toLowerCase();
  const generic = [
    'employment', 'occupation', 'job', 'jobs', 'worker', 'workers', 'wage',
    'wages', 'salary', 'sector', 'industry', 'labor force', 'workforce'
  ];
  return generic.some(k => new RegExp(`\\b${k}\\b`).test(lower)) ||
    bestAliasMatch(lower, SECTOR_ALIASES) !== undefined ||
    bestAliasMatch(lower, OCCUPATION_ALIASES) !== undefined;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function buildSectorResponse(sector: LaborSectorData): string {
  const below = sector.alice + sector.poverty;
  let response = `According to my data set, Arkansas labor force data for the ${sector.sector} sector in ${sector.year} (latest available):\n\n`;
  response += `Total workers: ${sector.total.toLocaleString()}\n`;
  response += `Workers from ALICE households: ${sector.alice.toLocaleString()} (${pct(sector.alice, sector.total)}%)\n`;
  response += `Workers from households in poverty: ${sector.poverty.toLocaleString()} (${pct(sector.poverty, sector.total)}%)\n`;
  response += `Below the ALICE threshold combined: ${below.toLocaleString()} (${pct(below, sector.total)}%)\n`;
  response += `Workers from households above the threshold: ${sector.above.toLocaleString()} (${pct(sector.above, sector.total)}%)`;
  return response;
}

function buildJobResponse(job: LaborJobData): string {
  const belowCount = Math.round(job.total_employment * job.percent_below_alice / 100);
  let response = `According to my data set, Arkansas employment data for ${job.occupation} in ${job.year} (latest available):\n\n`;
  response += `Total employment: ${job.total_employment.toLocaleString()} workers\n`;
  response += `Below the ALICE threshold: ${job.percent_below_alice}% of these workers' households (about ${belowCount.toLocaleString()} workers)\n`;
  response += `Median wage: $${job.median_annual_wage.toLocaleString()} per year ($${job.median_hourly_wage.toFixed(2)} per hour)`;
  return response;
}

function formatSectorList(sectors: LaborSectorData[]): string {
  return sectors.map(s => `- ${s.sector}`).join('\n');
}

export const searchEmploymentAction: Action = {
  name: 'Searching employment data...',
  similes: [
    'employment sectors',
    'industry',
    'occupation',
    'job',
    'worker',
    'wage',
    'salary',
    'labor force',
    'workforce',
    'employment data',
    'construction',
    'manufacturing',
    'healthcare'
  ],
  description: 'Search Arkansas labor force data by industry sector and occupation, with ALICE breakdowns',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    // Check for employment-related keywords
    // Note: no bare 'work' - it substring-matches unrelated words and, more
    // importantly, hijacks "How does ALICE work?" (a concept question).
    const employmentKeywords = [
      'employment', 'occupation', 'job', 'worker', 'wage', 'salary',
      'sector', 'industry', 'career', 'profession', 'labor force', 'workforce'
    ];

    const hasEmploymentKeyword = employmentKeywords.some(keyword =>
      text.includes(keyword)
    );

    // Any sector or occupation we actually have data for (or explicitly know
    // we lack) also triggers, so "How many cashiers are ALICE?" works.
    const hasSectorOrJobMatch =
      bestAliasMatch(text, SECTOR_ALIASES) !== undefined ||
      bestAliasMatch(text, OCCUPATION_ALIASES) !== undefined ||
      SPECIFIC_UNAVAILABLE_CATEGORIES.some(category => includesPhrase(text, category));

    return hasEmploymentKeyword || hasSectorOrJobMatch;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      const csvService = (runtime as any).csvDataService as CsvDataService;
      const text = message.content.text || '';

      if (!csvService) {
        const errorResult = "I cannot access my employment data systems right now. Please try again later.";
        if (callback) callback(errorResult);
        return errorResult;
      }

      const sectors = csvService.getLaborSectors();
      const jobs = csvService.getLaborJobs();

      if (!sectors.length && !jobs.length) {
        const errorResult = "I don't have employment data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }

      const lowerText = text.toLowerCase();
      const sectorMatch = bestAliasMatch(text, SECTOR_ALIASES);
      const jobMatch = bestAliasMatch(text, OCCUPATION_ALIASES);
      const unavailableCategory = SPECIFIC_UNAVAILABLE_CATEGORIES.find(category => includesPhrase(text, category));

      const matchedSector = sectorMatch ? sectors.find(s => s.sector === sectorMatch.key) : undefined;
      const matchedJob = jobMatch ? jobs.find(j => j.occupation === jobMatch.key) : undefined;

      const isRankingQuery =
        (lowerText.includes('highest') || lowerText.includes('lowest')) &&
        (lowerText.includes('alice') || lowerText.includes('rate') || lowerText.includes('below'));
      const wantsOccupationRanking =
        lowerText.includes('occupation') || lowerText.includes(' job') || lowerText.startsWith('job');

      let response = "";

      if (matchedJob && (!matchedSector || jobMatch!.length > sectorMatch!.length)) {
        // A specific occupation phrase ("construction laborers") beats the
        // broader sector phrase ("construction") it contains.
        response = buildJobResponse(matchedJob);
      } else if (matchedSector) {
        response = buildSectorResponse(matchedSector);
      } else if (matchedJob) {
        response = buildJobResponse(matchedJob);
      } else if (unavailableCategory) {
        response = `I don't currently have occupation-level ALICE data for ${unavailableCategory}. `;
        response += `I do have labor force data for these industry sectors:\n\n`;
        response += formatSectorList(sectors);
        response += `\n\n...plus detailed data for Arkansas's 20 largest occupations. Would you like stats on any of them?`;
      } else if (isRankingQuery && wantsOccupationRanking && jobs.length) {
        const isLowest = lowerText.includes('lowest');
        const sorted = [...jobs].sort((a, b) =>
          isLowest
            ? a.percent_below_alice - b.percent_below_alice
            : b.percent_below_alice - a.percent_below_alice
        );
        const top5 = sorted.slice(0, 5);
        const year = top5[0].year;

        response = `According to my data set, occupations with the ${isLowest ? 'lowest' : 'highest'} share of workers below the ALICE threshold in ${year} (latest available):\n\n`;
        top5.forEach((job, index) => {
          response += `${index + 1}. ${job.occupation}: ${job.percent_below_alice}% (${job.total_employment.toLocaleString()} workers total, median wage $${job.median_hourly_wage.toFixed(2)}/hour)\n`;
        });
      } else if (isRankingQuery && sectors.length) {
        const isLowest = lowerText.includes('lowest');
        const ranked = [...sectors].sort((a, b) =>
          isLowest
            ? pct(a.alice, a.total) - pct(b.alice, b.total)
            : pct(b.alice, b.total) - pct(a.alice, a.total)
        );
        const top5 = ranked.slice(0, 5);
        const year = top5[0].year;

        response = `According to my data set, industry sectors with the ${isLowest ? 'lowest' : 'highest'} share of workers from ALICE households in ${year} (latest available):\n\n`;
        top5.forEach((sector, index) => {
          response += `${index + 1}. ${sector.sector}: ${pct(sector.alice, sector.total)}% (${sector.alice.toLocaleString()} of ${sector.total.toLocaleString()} workers)\n`;
        });
      } else {
        // General labor force overview, computed from the sector data (which
        // covers the entire labor force).
        const totalWorkers = sectors.reduce((sum, s) => sum + s.total, 0);
        const totalAlice = sectors.reduce((sum, s) => sum + s.alice, 0);
        const totalPoverty = sectors.reduce((sum, s) => sum + s.poverty, 0);
        const totalBelow = totalAlice + totalPoverty;
        const year = sectors[0]?.year ?? jobs[0]?.year;

        const highest = sectors.reduce((max, s) => (pct(s.alice, s.total) > pct(max.alice, max.total) ? s : max));
        const lowest = sectors.reduce((min, s) => (pct(s.alice, s.total) < pct(min.alice, min.total) ? s : min));

        response = `According to my data set, here's the Arkansas labor force picture for ${year} (latest available):\n\n`;
        response += `Across ${sectors.length} industry sectors: ${totalWorkers.toLocaleString()} workers total. `;
        response += `${totalAlice.toLocaleString()} (${pct(totalAlice, totalWorkers)}%) live in ALICE households and ${totalPoverty.toLocaleString()} (${pct(totalPoverty, totalWorkers)}%) in households below the poverty line — `;
        response += `${totalBelow.toLocaleString()} workers (${pct(totalBelow, totalWorkers)}%) below the ALICE threshold overall.\n\n`;
        response += `Highest ALICE share: ${highest.sector} at ${pct(highest.alice, highest.total)}%\n`;
        response += `Lowest ALICE share: ${lowest.sector} at ${pct(lowest.alice, lowest.total)}%\n\n`;
        response += `Ask me about any sector (like construction, manufacturing, or health care) or any of Arkansas's 20 largest occupations for details.`;
      }

      const result = {
        text: response,
        success: true,
        action: 'EMPLOYMENT_DATA_RETRIEVED'
      };

      // Signal completion to ElizaOS via callback
      if (callback) {
        callback(result);
        // Return early after callback to prevent double response
        return true;
      }

      return result;

    } catch (error: any) {
      const errorMessage = "I cannot access my employment data systems right now. Please try again later.";
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "How many ALICE households work in construction?" }
      },
      {
        name: "Alice",
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        content: { text: "According to my data set, Arkansas labor force data for the Construction sector in [year from CSV] (latest available):\n\nTotal workers: [total from CSV]\nWorkers from ALICE households: [count from CSV] ([percent from CSV]%)\nWorkers from households in poverty: [count from CSV] ([percent from CSV]%)\nBelow the ALICE threshold combined: [count from CSV] ([percent from CSV]%)" }
      }
    ]
  ]
};
