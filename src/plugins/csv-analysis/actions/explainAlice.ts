import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';

export const explainAliceAction: Action = {
  name: 'Explaining ALICE concept...',
  similes: [
    'what is alice',
    'tell me about alice',
    'define alice',
    'explain alice',
    'alice definition'
  ],
  description: 'Explain what ALICE (Asset Limited, Income Constrained, Employed) means',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    
    console.error('\n*** EXPLAIN ALICE ACTION VALIDATION ***');
    console.error('*** Input text:', text);
    
    // Exclude queries that are asking about ALICE in a specific location
    const hasLocationContext = /alice\s+in\s+[a-z]/i.test(text) || 
                               text.includes('county') || 
                               text.includes('arkansas');
    
    // Check if asking about ALICE concept itself
    const isAskingAboutAliceConcept = 
      /(?:what\s+is|tell\s+me\s+about|define|explain|about)\s+alice(?:\s|\?|$)/i.test(text) ||
      /(?:what\s+does|tell\s+me\s+what)\s+alice\s+(?:mean|stand\s+for)/i.test(text) ||
      /alice\s+(?:definition|concept|acronym)/i.test(text);
    
    const result = isAskingAboutAliceConcept && !hasLocationContext;
    
    console.error('*** Is asking about ALICE concept:', isAskingAboutAliceConcept);
    console.error('*** Has location context (excluded):', hasLocationContext);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END EXPLAIN ALICE VALIDATION ***\n');
    
    return result;
  },
  
  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    console.error('*** EXPLAIN ALICE HANDLER TRIGGERED ***');
    
    const response = `ALICE stands for Asset Limited, Income Constrained, Employed.

ALICE represents individuals and families who work hard but still struggle to afford basic necessities. They earn more than the Federal Poverty Level, but less than what it costs to live and work in their community.

The ALICE population includes:
Early education workers
Laborers
Home health aides
Truck drivers
Store clerks
Office assistants

These are essential workers who are often among the most financially vulnerable in our communities. ALICE families make tough choices between paying for rent, food, healthcare, childcare, and transportation.

The ALICE threshold measures the true cost of living - what it actually costs for a household to achieve financial stability in a specific location. When we talk about ALICE households or the ALICE rate, we're referring to the percentage of households that fall into this category: working, but struggling to make ends meet.

Understanding ALICE helps us see the true economic challenges in Arkansas communities and work towards creating financial stability for all residents.`;

    const result = {
      text: response,
      success: true
    };
    
    if (callback) {
      console.error('*** Calling callback with ALICE explanation ***');
      callback(result);
    }
    
    return result;
  }
};
