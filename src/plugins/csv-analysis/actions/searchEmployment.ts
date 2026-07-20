import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, EmploymentData } from '../services/csvDataService';

const SPECIFIC_UNAVAILABLE_CATEGORIES = [
  'construction',
  'construction trades',
  'warehouse',
  'landscaping',
  'hotel',
  'farm',
  'farm workers',
  'security',
  'truck driver',
  'truck drivers',
  'maintenance'
];

const OCCUPATION_ALIASES: Record<string, string[]> = {
  'Delivery Driver/Sales Workers': ['delivery driver', 'delivery drivers'],
  'Fast Food and Counter Workers': ['fast food', 'counter workers', 'food service'],
  'General and Operations Managers': ['operations managers', 'general managers'],
  'Cashiers': ['cashier'],
  'Retail Salespersons': ['retail', 'retail sales'],
  'Registered Nurses': ['registered nurse', 'nurses', 'nursing'],
  'Stockers and Order Fillers': ['stockers', 'order fillers'],
  'Office Clerks': ['office clerk'],
  'Laborers and Movers': ['laborers', 'movers'],
  'Janitors and Building Cleaners': ['janitor', 'janitors', 'building cleaners'],
  'Cooks': ['cook'],
  'Customer Service Representatives': ['customer service'],
  'Orderlies and Psychiatric Aides': ['orderlies', 'psychiatric aides'],
  'Elementary and Middle School Teachers': ['elementary teachers', 'middle school teachers', 'teaching'],
  'Nursing Assistants': ['nursing assistants', 'nursing assistant'],
  'Waiters and Waitresses': ['waiters', 'waitresses', 'server', 'servers'],
  'Personal Care Aides': ['personal care', 'personal care aides'],
  'Sales Representatives Wholesale and Manufacturing': ['sales representatives', 'wholesale', 'manufacturing sales'],
  'Administrative Support Supervisors': ['administrative support', 'support supervisors'],
  'Secondary School Teachers': ['secondary teachers', 'high school teachers']
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

function findEmploymentByQuestion(text: string, employmentData: EmploymentData[]): EmploymentData | undefined {
  return employmentData.find((emp) => {
    const aliases = [emp.occupation, ...(OCCUPATION_ALIASES[emp.occupation] || [])];
    return aliases.some((alias) => includesPhrase(text, alias));
  });
}

function findUnavailableCategory(text: string): string | undefined {
  return SPECIFIC_UNAVAILABLE_CATEGORIES.find((category) => includesPhrase(text, category));
}

function formatAvailableCategories(employmentData: EmploymentData[]): string {
  return employmentData
    .map((emp) => `- ${emp.occupation}`)
    .join('\n');
}

export const searchEmploymentAction: Action = {
  name: 'Searching employment data...',
  similes: [
    'employment sectors',
    'occupation',
    'job',
    'worker',
    'wage',
    'salary',
    'highest ALICE rates',
    'employment data',
    'food service',
    'retail',
    'healthcare',
    'construction'
  ],
  description: 'Search Arkansas employment data by occupation and ALICE rates',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    
    // Check for employment-related keywords
    // Note: no bare 'work' - it substring-matches unrelated words and, more
    // importantly, hijacks "How does ALICE work?" (a concept question).
    const employmentKeywords = [
      'employment', 'occupation', 'job', 'worker', 'wage', 'salary',
      'sector', 'industry', 'career', 'profession'
    ];
    
    const hasEmploymentKeyword = employmentKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // Check for specific occupations from our data
    const occupationKeywords = [
      'food service', 'retail', 'personal care', 'childcare', 'health aide',
      'cashier', 'office clerk', 'janitor', 'security', 'truck driver',
      'construction', 'warehouse', 'teaching', 'medical', 'customer service',
      'landscaping', 'hotel', 'farm', 'nursing', 'maintenance', 'delivery'
    ];
    
    const hasOccupationKeyword = occupationKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // Check for ALICE rate queries about employment
    const hasAliceEmploymentQuery = text.includes('alice') && 
      (text.includes('rate') || text.includes('percentage')) &&
      (hasEmploymentKeyword || hasOccupationKeyword);
    
    return hasEmploymentKeyword || hasOccupationKeyword || hasAliceEmploymentQuery;
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
      
      // Get all employment data
      const employmentData = csvService.getAllEmployment();
      
      if (!employmentData || employmentData.length === 0) {
        const errorResult = "I don't have employment data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }
      
      let response = "";
      
      const matchedEmployment = findEmploymentByQuestion(text, employmentData);
      const unavailableCategory = findUnavailableCategory(text);

      if (matchedEmployment) {
        response = `According to my data set, Arkansas employment data for ${matchedEmployment.occupation} in ${matchedEmployment.year}:\n\n`;
        response += `ALICE workers: ${matchedEmployment.alice_workers.toLocaleString()} of ${matchedEmployment.total_workers.toLocaleString()} workers (${matchedEmployment.alice_percentage}%)\n`;
        response += `Median wage: $${matchedEmployment.median_wage.toFixed(2)} per hour`;
      } else if (unavailableCategory) {
        response = `I don't currently have ALICE employment data for ${unavailableCategory}. `;
        response += `I do have employment data for these categories:\n\n`;
        response += formatAvailableCategories(employmentData);
        response += `\n\nWould you like more stats on any of them?`;
      } else if (text.includes('highest') && (text.includes('alice') || text.includes('rate'))) {
        const sortedByAlice = [...employmentData].sort((a, b) => b.alice_percentage - a.alice_percentage);
        const top5 = sortedByAlice.slice(0, 5);
        
        response = "According to my data set, here are the employment sectors with the highest ALICE rates:\n\n";
        top5.forEach((emp, index) => {
          response += `${index + 1}. ${emp.occupation}: ${emp.alice_percentage}% (${emp.alice_workers.toLocaleString()} of ${emp.total_workers.toLocaleString()} workers)\n`;
        });
        
      } else if (text.includes('lowest') && (text.includes('alice') || text.includes('rate'))) {
        const sortedByAlice = [...employmentData].sort((a, b) => a.alice_percentage - b.alice_percentage);
        const bottom5 = sortedByAlice.slice(0, 5);
        
        response = "According to my data set, here are the employment sectors with the lowest ALICE rates:\n\n";
        bottom5.forEach((emp, index) => {
          response += `${index + 1}. ${emp.occupation}: ${emp.alice_percentage}% (${emp.alice_workers.toLocaleString()} of ${emp.total_workers.toLocaleString()} workers)\n`;
        });
        
      } else {
        // General employment overview
        const totalWorkers = employmentData.reduce((sum, emp) => sum + emp.total_workers, 0);
        const totalAliceWorkers = employmentData.reduce((sum, emp) => sum + emp.alice_workers, 0);
        const overallRate = Math.round((totalAliceWorkers / totalWorkers) * 100);
        
        const highest = employmentData.reduce((max, emp) => 
          emp.alice_percentage > max.alice_percentage ? emp : max
        );
        
        const lowest = employmentData.reduce((min, emp) => 
          emp.alice_percentage < min.alice_percentage ? emp : min
        );
        
        response = `According to my data set, here's Arkansas employment data:\n\n`;
        response += `Overall: ${totalAliceWorkers.toLocaleString()} of ${totalWorkers.toLocaleString()} workers (${overallRate}%) are below the ALICE threshold.\n\n`;
        response += `Highest ALICE rate: ${highest.occupation} at ${highest.alice_percentage}%\n`;
        response += `Lowest ALICE rate: ${lowest.occupation} at ${lowest.alice_percentage}%\n\n`;
        response += `This data shows significant variation across employment sectors in Arkansas.`;
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
        content: { text: "What employment sectors have highest ALICE rates?" }
      },
      {
        name: "Alice",
        // Placeholders only - real figures must always come from the CSV data
        // at answer time, never from a memorized example.
        content: { text: "According to my data set, here are the employment sectors with the highest ALICE rates:\n\n1. [Occupation]: [percent from CSV]% ([count from CSV] of [total from CSV] workers)\n2. [Occupation]: [percent from CSV]% ([count from CSV] of [total from CSV] workers)\n3. [Occupation]: [percent from CSV]% ([count from CSV] of [total from CSV] workers)" }
      }
    ]
  ]
};
