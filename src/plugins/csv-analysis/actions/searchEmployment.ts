import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService } from '../services/csvDataService';

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
      
      // Check if asking for highest/lowest ALICE rates
      if (text.includes('highest') && (text.includes('alice') || text.includes('rate'))) {
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
        content: { text: "According to my data set, here are the employment sectors with the highest ALICE rates:\n\n1. Hotel Housekeepers: 80% (9,877 of 12,345 workers)\n2. Farm Workers: 80% (12,542 of 15,678 workers)\n3. Food Service Workers: 70% (62,386 of 89,123 workers)" }
      }
    ]
  ]
};
