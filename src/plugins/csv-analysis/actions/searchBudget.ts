import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, BudgetData } from '../services/csvDataService';

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

const money = (n: number): string => `$${n.toLocaleString('en-US')}`;

// Map a free-text question to one of the canonical budget household types.
// Order matters: the more specific compositions are checked first.
function detectHousehold(text: string): string | undefined {
  const t = normalizeText(text);
  if (/(two adults two childcare|two in childcare|both in childcare|children in childcare|kids in childcare|two childcare|with childcare)/.test(t)) {
    return 'Two Adults Two Childcare';
  }
  if (/(two adults two children|family of four|household of four|four person|two adults and two children|two parents two children|two kids|two children|with children|with kids|family)/.test(t)) {
    return 'Two Adults Two Children';
  }
  if (/(two adults|two adult|two people|two person|a couple|couple)/.test(t)) {
    return 'Two Adults';
  }
  if (/(single adult|one adult|single person|one person|individual|live alone|living alone|by myself|just me|single)/.test(t)) {
    return 'Single Adult';
  }
  return undefined;
}

interface LineItem {
  label: string;
  field: keyof BudgetData;
  aliases: string[];
}

const LINE_ITEMS: LineItem[] = [
  { label: 'Housing', field: 'housing', aliases: ['housing', 'rent', 'mortgage', 'shelter'] },
  { label: 'Child Care', field: 'child_care', aliases: ['child care', 'childcare', 'daycare', 'day care'] },
  { label: 'Food', field: 'food', aliases: ['food', 'groceries', 'grocery'] },
  { label: 'Transportation', field: 'transportation', aliases: ['transportation', 'transport', 'commute', 'transit', 'car'] },
  { label: 'Health Care', field: 'health_care', aliases: ['health care', 'healthcare', 'medical', 'health insurance'] },
  { label: 'Technology', field: 'technology', aliases: ['technology', 'tech', 'phone', 'internet'] },
  { label: 'Miscellaneous', field: 'miscellaneous', aliases: ['miscellaneous', 'misc'] },
  { label: 'Savings', field: 'savings', aliases: ['savings'] },
  { label: 'Taxes', field: 'taxes', aliases: ['taxes', 'tax'] }
];

function detectLineItem(text: string): LineItem | undefined {
  return LINE_ITEMS.find((item) => item.aliases.some((alias) => includesPhrase(text, alias)));
}

function budgetLabel(b: BudgetData): string {
  return `ALICE Household ${b.budget_type} Budget`;
}

function formatFullBudget(b: BudgetData): string {
  let response = `${budgetLabel(b)} for a ${b.household_type} in Arkansas (${b.year}):\n\n`;
  response += 'Monthly costs:\n';
  LINE_ITEMS.forEach((item) => {
    response += `  ${item.label}: ${money(b[item.field] as number)}\n`;
  });
  response += `\nMonthly total: ${money(b.monthly_total)}\n`;
  response += `Annual total: ${money(b.annual_total)}\n`;
  response += `Hourly wage needed (full-time): $${b.hourly_wage.toFixed(2)}`;
  return response;
}

export const searchBudgetAction: Action = {
  name: 'Searching ALICE budget data...',
  similes: [
    'survival budget',
    'stability budget',
    'household budget',
    'cost of living',
    'basic needs',
    'living wage',
    'how much to live',
    'budget breakdown'
  ],
  description: 'Search the ALICE Household Survival/Stability Budget — cost of basic needs by household type',
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';

    const budgetKeywords = [
      'survival budget', 'stability budget', 'household budget', 'budget',
      'cost of living', 'basic needs', 'living wage', 'survival wage', 'cost to live'
    ];
    const hasBudgetKeyword = budgetKeywords.some((k) => text.includes(k));

    const livingVerb = /(live|survive|get by|make ends meet|making ends meet)/.test(text);
    const costWord = /(how much|cost|needs?|wage|income|budget|earn|salary|afford|expenses)/.test(text);
    const costToLive = livingVerb && costWord;

    const householdBudget =
      detectHousehold(text) !== undefined &&
      /(budget|cost|expenses|need|afford|spend|survive|make ends meet)/.test(text);

    return hasBudgetKeyword || costToLive || householdBudget;
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state: State, options: any, callback?: any): Promise<any> => {
    try {
      const csvService = (runtime as any).csvDataService as CsvDataService;
      const text = message.content.text || '';

      if (!csvService) {
        const errorResult = 'I cannot access my budget data systems right now. Please try again later.';
        if (callback) callback(errorResult);
        return errorResult;
      }

      const budgets = csvService.getAllBudgets();
      if (!budgets || budgets.length === 0) {
        const errorResult = "I don't have ALICE budget data available right now.";
        if (callback) callback(errorResult);
        return errorResult;
      }

      const latestYear = csvService.getLatestBudgetYear();
      const yearBudgets = budgets.filter((b) => b.year === latestYear);
      const budgetType = yearBudgets[0]?.budget_type ?? 'Stability';
      const labelPrefix = `ALICE Household ${budgetType} Budget`;

      const household = detectHousehold(text);
      const lineItem = detectLineItem(text);
      const lower = text.toLowerCase();
      const wantsWage = /\b(hourly wage|wage|per hour|hourly|how much.*hour)\b/.test(lower);
      const wantsAnnual = /\b(annual|annually|yearly|per year|a year|salary)\b/.test(lower);

      let response = '';

      if (household) {
        const b = csvService.findBudget(household, undefined, latestYear);
        if (!b) {
          response = `I don't have a budget for a ${household} in my data set.`;
        } else if (lineItem) {
          response = `According to the ${labelPrefix} (${b.year}), the monthly ${lineItem.label.toLowerCase()} cost for a ${b.household_type} in Arkansas is ${money(b[lineItem.field] as number)}.`;
        } else if (wantsWage) {
          response = `The ${labelPrefix} (${b.year}) for a ${b.household_type} in Arkansas requires an hourly wage of $${b.hourly_wage.toFixed(2)} (full-time), which is ${money(b.annual_total)} per year.`;
        } else if (wantsAnnual) {
          response = `The ${labelPrefix} (${b.year}) for a ${b.household_type} in Arkansas is ${money(b.annual_total)} per year (${money(b.monthly_total)} per month).`;
        } else {
          response = formatFullBudget(b);
        }
      } else if (lineItem) {
        response = `According to the ${labelPrefix} (${latestYear}), here is the monthly ${lineItem.label.toLowerCase()} cost in Arkansas by household type:\n\n`;
        yearBudgets.forEach((b) => {
          response += `${b.household_type}: ${money(b[lineItem.field] as number)}\n`;
        });
      } else {
        response = `The ${labelPrefix} shows what it costs to afford basic necessities in Arkansas (${latestYear}). Here is the bottom line by household type:\n\n`;
        yearBudgets.forEach((b) => {
          response += `${b.household_type}: ${money(b.monthly_total)}/month, ${money(b.annual_total)}/year ($${b.hourly_wage.toFixed(2)}/hr full-time)\n`;
        });
        response += `\nAsk about a specific household (e.g. "budget for a single adult") or a line item (e.g. "housing cost for a family of four") for the full breakdown.`;
      }

      const result = {
        text: response,
        success: true,
        action: 'BUDGET_DATA_RETRIEVED'
      };

      if (callback) {
        callback(result);
        return true;
      }
      return result;
    } catch (error: any) {
      const errorMessage = 'I cannot access my budget data systems right now. Please try again later.';
      if (callback) callback(errorMessage);
      return errorMessage;
    }
  },

  examples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'How much does a single adult need to live in Arkansas?' }
      },
      {
        name: 'Alice',
        content: {
          text: 'ALICE Household Stability Budget for a Single Adult in Arkansas (2024):\n\nMonthly total: $3,954\nAnnual total: $47,448\nHourly wage needed (full-time): $23.72'
        }
      }
    ]
  ]
};
