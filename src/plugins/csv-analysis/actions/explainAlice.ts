import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, BudgetData } from '../services/csvDataService';

const money = (n: number): string => `$${n.toLocaleString('en-US')}`;

// Words that indicate the user wants figures for a SPECIFIC household type —
// those queries belong to the budget action (real per-household data), not the
// concept explanation.
function namesHouseholdType(text: string): boolean {
  return /\b(single adult|one adult|two adults?|family of|four person|children|child|childcare|senior|seniors|couple)\b/i.test(text);
}

// Render real statewide budget figures for one budget type, pulled live from
// the CSV data so this can never go stale. Returns '' when data is missing.
function budgetFigures(csvService: CsvDataService | undefined, budgetType: string): string {
  if (!csvService || typeof csvService.getAllBudgets !== 'function') return '';
  const rows = csvService
    .getAllBudgets()
    .filter((b: BudgetData) => b.budget_type.toLowerCase() === budgetType.toLowerCase());
  if (rows.length === 0) return '';
  const year = rows[0].year;
  let out = `\n\nArkansas ${budgetType} Budget (${year}), by household type:\n`;
  rows.forEach((b) => {
    out += `• ${b.household_type}: ${money(b.monthly_total)}/month — ${money(b.annual_total)}/year ($${b.hourly_wage.toFixed(2)}/hr full-time)\n`;
  });
  return out.trimEnd();
}

export const explainAliceAction: Action = {
  name: 'Explaining ALICE concept...',
  similes: [
    'what is alice',
    'tell me about alice',
    'define alice',
    'explain alice',
    'alice definition',
    'alice threshold',
    'poverty line',
    'how is alice calculated'
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

    // Budget CONCEPT questions ("what is the survival budget?"). When the user
    // names a household type ("...for a single adult"), the budget action
    // answers with the real per-household figures instead.
    const isBudgetConceptQuery =
      /\b(?:alice\s+)?(?:stability budget|survival budget|household stability budget|household survival budget)\b/i.test(text) &&
      !namesHouseholdType(text);

    // Threshold concept ("what is the ALICE threshold?"); county-specific
    // threshold questions are excluded via hasLocationContext. The bare form
    // must be the ENTIRE message — data questions that merely end with
    // "...below the ALICE threshold?" ("How many cashiers are below the ALICE
    // threshold?") belong to the data actions, not the explainer.
    const isThresholdConceptQuery =
      (/\b(?:what\s+is|what'?s|explain|define|tell\s+me\s+about)\b.*\bthreshold\b/i.test(text) ||
       /^\s*(?:the\s+)?alice\s+threshold\s*\??\s*$/i.test(text)) &&
      !/\bhow\s+(?:many|much)\b/i.test(text);

    // "How is ALICE calculated/measured/determined?"
    const isCalculationQuery =
      /\bhow\b.*\balice\b.*\b(calculated|measured|determined|defined|classified)\b/i.test(text) ||
      /\bhow\s+(?:do|does|is)\b.*\b(qualify|count)\b.*\balice\b/i.test(text);

    // Poverty line / FPL vs ALICE concept questions.
    const isPovertyLineQuery =
      /\b(poverty line|poverty level|federal poverty|fpl)\b/i.test(text) &&
      !/\b(rate|percent|how many|households)\b.*\b(county|city|zip)\b/i.test(text);

    // Check if asking about ALICE concept itself
    const isAskingAboutAliceConcept =
      /(?:what\s+is|tell\s+me\s+about|define|explain|about)\s+alice(?:\s|\?|$)/i.test(text) ||
      /(?:what\s+does|tell\s+me\s+what)\s+alice\s+(?:mean|stand\s+for)/i.test(text) ||
      /alice\s+(?:definition|concept|acronym)/i.test(text) ||
      isBudgetConceptQuery ||
      isCalculationQuery;

    const result = (isAskingAboutAliceConcept || isThresholdConceptQuery || isPovertyLineQuery) && !hasLocationContext;

    console.error('*** Is asking about ALICE concept:', isAskingAboutAliceConcept);
    console.error('*** Threshold concept:', isThresholdConceptQuery, '| Calculation:', isCalculationQuery, '| Poverty line:', isPovertyLineQuery);
    console.error('*** Has location context (excluded):', hasLocationContext);
    console.error('*** VALIDATION RESULT:', result ? 'WILL TRIGGER' : 'WILL NOT TRIGGER');
    console.error('*** END EXPLAIN ALICE VALIDATION ***\n');

    return result;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    console.error('*** EXPLAIN ALICE HANDLER TRIGGERED ***');
    const text = message.content.text?.toLowerCase() || '';
    const csvService = (runtime as any)?.csvDataService as CsvDataService | undefined;

    const isStabilityBudgetQuery = text.includes('stability budget');
    const isSurvivalBudgetQuery = text.includes('survival budget');
    const isThresholdQuery = /\bthreshold\b/.test(text) && !isStabilityBudgetQuery && !isSurvivalBudgetQuery;
    const isCalculationQuery = /\b(calculated|measured|determined|classified|qualify)\b/.test(text);
    const isPovertyLineQuery = /\b(poverty line|poverty level|federal poverty|fpl)\b/.test(text);

    let response = '';

    if (isStabilityBudgetQuery) {
      response = `The ALICE Household Stability Budget is a higher standard than the bare-minimum Survival Budget. It reflects what a household needs not just to get by, but to build financial stability — including room for savings and emergencies.`;
      const figures = budgetFigures(csvService, 'Stability');
      response += figures
        ? figures + `\n\nAsk about a specific household type (e.g. "stability budget for a single adult") for the full line-item breakdown.`
        : `\n\nI don't currently have Stability Budget dollar amounts loaded.`;
    } else if (isSurvivalBudgetQuery) {
      response = `The ALICE Household Survival Budget estimates the minimum income a household needs to cover basic necessities — housing, child care, food, transportation, health care, technology, and taxes — without assistance. It is the basis for the ALICE Threshold.`;
      const figures = budgetFigures(csvService, 'Survival');
      response += figures
        ? figures + `\n\nCosts vary by county — ask e.g. "survival budget for a family of four in Benton County" for county-specific figures.`
        : `\n\nI don't currently have Survival Budget dollar amounts loaded.`;
    } else if (isPovertyLineQuery) {
      // FPL dollar figures come from data/fpl.csv so a new year's numbers are
      // a data update; the sentence is omitted if the file is missing.
      const fpl = typeof csvService?.getLatestFpl === 'function' ? csvService.getLatestFpl() : undefined;
      const single = fpl?.byCategory.get('Single Adult');
      const family = fpl?.byCategory.get('Family of Four');
      const fplSentence = fpl && single && family
        ? ` For ${fpl.year}, the FPL was $${single.toLocaleString()} for a single adult and $${family.toLocaleString()} for a family of four.`
        : '';
      response = `The Federal Poverty Level (FPL) is the government's official poverty measure. It is a single national number that does not account for geographic cost differences, child care, health care, or the actual local cost of living.${fplSentence}

The ALICE Threshold is different: it is built from the real cost of basic necessities in each county (the Household Survival Budget). Many working households earn above the FPL but below the ALICE Threshold — those households are ALICE: Asset Limited, Income Constrained, Employed.`;
      const figures = budgetFigures(csvService, 'Survival');
      if (figures) {
        response += `\n\nFor comparison, the Arkansas Survival Budget:` + figures.replace(/^\n+Arkansas Survival Budget \(\d+\), by household type:/, '');
      }
      response += `\n\nWant the ALICE rate for a specific Arkansas county?`;
    } else if (isThresholdQuery || isCalculationQuery) {
      response = `A household is classified as ALICE when its income is above the Federal Poverty Level but below the ALICE Threshold for its county.

The ALICE Threshold is derived from the Household Survival Budget — the actual local cost of housing, child care, food, transportation, health care, technology, taxes, and miscellaneous essentials. It varies by county and by household composition (number of adults, seniors, and children).`;
      const figures = budgetFigures(csvService, 'Survival');
      if (figures) {
        response += figures;
      }
      response += `\n\nI also have county-specific ALICE Threshold dollar amounts — ask e.g. "What is the ALICE threshold for Benton County?"`;
    } else {
      response = `ALICE stands for Asset Limited, Income Constrained, Employed.

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
    }

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
