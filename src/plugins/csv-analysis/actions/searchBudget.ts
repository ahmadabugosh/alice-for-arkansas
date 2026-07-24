import { Action, IAgentRuntime, Memory, State } from '@elizaos/core';
import { CsvDataService, BudgetData, CountyBudgetData } from '../services/csvDataService';
import { AR_COUNTY_NAMES as AR_COUNTIES } from '../constants/arkansasCounties';


// Detect a county only in an explicit location context ("in X", "X County") so
// a word like "Union" or "White" isn't mistaken for a county name.
function detectCounty(text: string): string | undefined {
  const t = text.toLowerCase().replace(/[-–—]/g, ' ');
  for (const c of AR_COUNTIES) {
    const esc = c.replace(/\./g, '\\.');
    // "X County" always works.
    if (new RegExp(`\\b${esc}\\s+count(?:y|ies)\\b`, 'i').test(t)) return c;
    // "in/for/within X" works too — except bare "Arkansas", which almost always
    // means the state, so it requires the explicit "Arkansas County" form above.
    if (c !== 'arkansas' && new RegExp(`\\b(?:in|for|within)\\s+${esc}\\b`, 'i').test(t)) return c;
  }
  return undefined;
}

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

// "child care" inside a household description ("kids in child care") is part
// of the composition, not a request for the child-care line item — drop those
// phrases before line-item detection.
function stripHouseholdPhrases(text: string): string {
  return normalizeText(text).replace(/\b(?:in|with) (?:child ?care|day ?care)\b/g, ' ');
}

const money = (n: number): string => `$${n.toLocaleString('en-US')}`;

// United For ALICE budget conventions: "Children" household types assume
// school-age kids; "Childcare" types assume younger kids in full-time child
// care (the two-child version is an infant + a preschooler, per the 2026
// Arkansas report).
const HOUSEHOLD_COMPOSITIONS: Record<string, string> = {
  'One Adult One Child': 'one school-age child',
  'One Adult One Childcare': 'one young child in child care',
  'Two Adults Two Children': 'two school-age children',
  'Two Adults Two Childcare': 'an infant and a preschooler in child care'
};

function describeHousehold(type: string): string {
  const note = HOUSEHOLD_COMPOSITIONS[type];
  return note ? `${type} household (${note})` : type;
}

// Map a free-text question to one of the canonical budget household types.
// Order matters: the more specific compositions are checked first.
function detectHousehold(text: string): string | undefined {
  const t = normalizeText(text);
  // Age words that imply full-time child care rather than school-age children.
  const youngKids = /(infants?|bab(?:y|ies)|toddlers?|preschool(?:ers?)?|pre k\b|young (?:child|children|kids))/.test(t);
  if (/(two seniors|senior couple|elderly couple|two retirees|two retired)/.test(t)) return 'Two Seniors';
  if (/(single senior|one senior|a senior|elderly|retiree|retired)/.test(t)) return 'Single Senior';
  if (/(one adult one childcare|single parent one childcare|one parent one childcare|single adult one childcare)/.test(t)) return 'One Adult One Childcare';
  if (/(one adult one child|single parent|one parent|single mother|single father|single mom|single dad|one child)/.test(t)) {
    return youngKids ? 'One Adult One Childcare' : 'One Adult One Child';
  }
  if (/(two adults two childcare|two in childcare|both in childcare|children in childcare|kids in childcare|children in daycare|kids in daycare|two in daycare|both in daycare|two childcare|with childcare|infant and a preschooler|infant and preschooler)/.test(t)) {
    return 'Two Adults Two Childcare';
  }
  if (/(two adults two children|family of four|household of four|four person|two adults and two children|two parents two children|two kids|two children|with children|with kids|family)/.test(t)) {
    return youngKids ? 'Two Adults Two Childcare' : 'Two Adults Two Children';
  }
  if (/(two adults|two adult|two people|two person|a couple|couple)/.test(t)) {
    return 'Two Adults';
  }
  if (/(single adult|one adult|single person|one person|individual|live alone|living alone|by myself|just me|single)/.test(t)) {
    return 'Single Adult';
  }
  return undefined;
}

// "survival budget" (the ALICE threshold) vs "stability budget" (higher bar).
function detectBudgetType(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes('survival')) return 'Survival';
  if (t.includes('stability') || t.includes('stable')) return 'Stability';
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
  let response = `${budgetLabel(b)} for a ${describeHousehold(b.household_type)} in Arkansas (${b.year}):\n\n`;
  response += 'Monthly costs:\n';
  LINE_ITEMS.forEach((item) => {
    // The Survival budget has no savings line; skip it when it's zero.
    if (item.field === 'savings' && ((b.savings as number) ?? 0) === 0) return;
    response += `  ${item.label}: ${money(b[item.field] as number)}\n`;
  });
  response += `\nMonthly total: ${money(b.monthly_total)}\n`;
  response += `Annual total: ${money(b.annual_total)}\n`;
  response += `Hourly wage needed (full-time): $${b.hourly_wage.toFixed(2)}`;
  return response;
}

// Line items match the United Way dashboard presentation: Rent + Utilities are
// shown as one "Housing" figure, and tax credits are deducted from Taxes
// rather than listed separately.
interface CountyLineItem {
  label: string;
  value: (b: CountyBudgetData) => number;
  aliases: string[];
  hidden?: boolean; // answerable when asked, but not a display line
}
const COUNTY_LINE_ITEMS: CountyLineItem[] = [
  { label: 'Housing', value: (b) => b.rent + b.utilities, aliases: ['housing', 'rent', 'mortgage', 'shelter', 'utilities', 'utility', 'electric', 'water', 'power'] },
  { label: 'Child Care', value: (b) => b.childcare, aliases: ['child care', 'childcare', 'daycare', 'day care'] },
  { label: 'Food', value: (b) => b.food, aliases: ['food', 'groceries', 'grocery'] },
  { label: 'Transportation', value: (b) => b.transportation, aliases: ['transportation', 'transport', 'commute', 'transit', 'car', 'gas'] },
  { label: 'Health Care', value: (b) => b.healthcare, aliases: ['health care', 'healthcare', 'medical', 'health insurance'] },
  { label: 'Technology', value: (b) => b.tech, aliases: ['technology', 'tech', 'phone', 'internet'] },
  { label: 'Miscellaneous', value: (b) => b.misc, aliases: ['miscellaneous', 'misc'] },
  { label: 'Tax Credits', value: (b) => b.tax_credits, aliases: ['tax credit', 'tax credits', 'credits'], hidden: true },
  { label: 'Taxes', value: (b) => b.taxes + b.tax_credits, aliases: ['taxes', 'tax'] }
];

function detectCountyLineItem(text: string): CountyLineItem | undefined {
  return COUNTY_LINE_ITEMS.find((item) => item.aliases.some((alias) => includesPhrase(text, alias)));
}

function countyItemLabel(item: CountyLineItem, b: CountyBudgetData): string {
  if (item.label === 'Housing') return 'Housing (rent + utilities)';
  if (item.label === 'Taxes' && b.tax_credits !== 0) return 'Taxes (after tax credits)';
  return item.label;
}

const prettyCounty = (c: string) => c.replace(/\b\w/g, (ch) => ch.toUpperCase()) + ' County';

function formatCountyBudget(b: CountyBudgetData): string {
  let response = `ALICE Household Survival Budget for a ${describeHousehold(b.household_type)} in ${prettyCounty(b.county)}, Arkansas (${b.year}):\n\n`;
  response += 'Monthly costs:\n';
  COUNTY_LINE_ITEMS.forEach((item) => {
    if (item.hidden) return;
    const label = item.label === 'Taxes' && b.tax_credits !== 0 ? 'Taxes (after tax credits)' : item.label;
    response += `  ${label}: ${money(item.value(b))}\n`;
  });
  response += `\nMonthly total: ${money(b.monthly)}\n`;
  response += `Annual total: ${money(b.annual)}`;
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
      const availableTypes = typeof csvService.getBudgetTypes === 'function'
        ? csvService.getBudgetTypes()
        : [...new Set(budgets.map((b) => b.budget_type))];
      // Default to the Survival budget (the ALICE threshold); honor an explicit
      // "survival"/"stability" ask when that type is available.
      const requestedType = detectBudgetType(text);
      const budgetType = requestedType && availableTypes.includes(requestedType)
        ? requestedType
        : (availableTypes.includes('Survival') ? 'Survival' : (availableTypes[0] ?? 'Stability'));
      const labelPrefix = `ALICE Household ${budgetType} Budget`;

      const yearBudgets = budgets.filter((b) => b.year === latestYear && b.budget_type === budgetType);

      const otherType = availableTypes.find((t) => t !== budgetType);
      const otherNote = otherType
        ? `\n\nI also have the ALICE Household ${otherType} Budget${otherType === 'Stability' ? ' (a higher, more sustainable standard that adds savings)' : ' (the bare-minimum ALICE threshold)'} — ask for it by name.`
        : '';

      const household = detectHousehold(text);
      const lineItem = detectLineItem(stripHouseholdPhrases(text));
      const lower = text.toLowerCase();

      // County-specific budget: when the user names a county and a household
      // type we have county-level data for, answer from the county budget.
      const county = detectCounty(text);
      if (county && household && typeof csvService.hasCountyBudgets === 'function' && csvService.hasCountyBudgets()) {
        const cb = csvService.findCountyBudget(county, household);
        if (cb) {
          const cItem = detectCountyLineItem(stripHouseholdPhrases(text));
          let cResponse: string;
          if (cItem && cItem.label === 'Tax Credits') {
            const credit = cb.tax_credits;
            cResponse = credit === 0
              ? `According to the ALICE Household Survival Budget (${cb.year}), no tax credits apply for a ${describeHousehold(cb.household_type)} in ${prettyCounty(cb.county)}, Arkansas.`
              : `According to the ALICE Household Survival Budget (${cb.year}), a ${describeHousehold(cb.household_type)} in ${prettyCounty(cb.county)}, Arkansas receives ${money(Math.abs(credit))}/month in tax credits — already deducted from the Taxes line, which is ${money(cb.taxes + credit)}/month after credits.`;
          } else if (cItem) {
            cResponse = `According to the ALICE Household Survival Budget (${cb.year}), the monthly ${countyItemLabel(cItem, cb).toLowerCase()} cost for a ${describeHousehold(cb.household_type)} in ${prettyCounty(cb.county)}, Arkansas is ${money(cItem.value(cb))}.`;
          } else if (/\b(annual|annually|yearly|per year|a year|salary)\b/.test(lower)) {
            cResponse = `The ALICE Household Survival Budget (${cb.year}) for a ${describeHousehold(cb.household_type)} in ${prettyCounty(cb.county)}, Arkansas is ${money(cb.annual)} per year (${money(cb.monthly)} per month).`;
          } else {
            cResponse = formatCountyBudget(cb);
          }
          // A generic "family of four" resolves to the school-age variant;
          // point out the (pricier) young-children alternative on whole-budget
          // answers (not single line items).
          if (!cItem && cb.household_type === 'Two Adults Two Children' && !/school age/.test(normalizeText(text))) {
            const alt = csvService.findCountyBudget(county, 'Two Adults Two Childcare');
            if (alt) {
              cResponse += `\n\nNote: this assumes two school-age children. With an infant and a preschooler in child care instead, the Survival Budget is ${money(alt.monthly)}/month (${money(alt.annual)}/year) — ask about a "family of four with an infant and a preschooler".`;
            }
          }
          cResponse += '\n\nThese are county-specific Survival Budget figures. Ask about a different county or the statewide budget if you\'d like.';
          const cResult = { text: cResponse, success: true, action: 'BUDGET_DATA_RETRIEVED' };
          if (callback) { callback(cResult); return true; }
          return cResult;
        }
      }

      // County named but no specific household type: show that county's Survival
      // budget across all household types (instead of the statewide overview).
      if (county && typeof csvService.getCountyBudgets === 'function') {
        const countyRows = csvService.getCountyBudgets(county);
        if (countyRows.length > 0) {
          const cYear = countyRows[0].year;
          let cResponse = `ALICE Household Survival Budget for ${prettyCounty(county)}, Arkansas (${cYear}) — monthly / annual cost by household type:\n\n`;
          countyRows.forEach((b) => {
            cResponse += `${b.household_type}: ${money(b.monthly)}/month, ${money(b.annual)}/year\n`;
          });
          cResponse += `\nAsk about a specific household (e.g. "survival budget for a family of four in ${prettyCounty(county)}") for the full line-item breakdown.`;
          const cResult = { text: cResponse, success: true, action: 'BUDGET_DATA_RETRIEVED' };
          if (callback) { callback(cResult); return true; }
          return cResult;
        }
      }

      const wantsWage = /\b(hourly wage|wage|per hour|hourly|how much.*hour)\b/.test(lower);
      const wantsAnnual = /\b(annual|annually|yearly|per year|a year|salary)\b/.test(lower);

      let response = '';

      if (household) {
        const b = csvService.findBudget(household, budgetType, latestYear);
        if (!b) {
          response = `I don't have a budget for a ${household} in my data set.`;
        } else if (lineItem) {
          response = `According to the ${labelPrefix} (${b.year}), the monthly ${lineItem.label.toLowerCase()} cost for a ${describeHousehold(b.household_type)} in Arkansas is ${money(b[lineItem.field] as number)}.`;
        } else if (wantsWage) {
          response = `The ${labelPrefix} (${b.year}) for a ${describeHousehold(b.household_type)} in Arkansas requires an hourly wage of $${b.hourly_wage.toFixed(2)} (full-time), which is ${money(b.annual_total)} per year.`;
        } else if (wantsAnnual) {
          response = `The ${labelPrefix} (${b.year}) for a ${describeHousehold(b.household_type)} in Arkansas is ${money(b.annual_total)} per year (${money(b.monthly_total)} per month).`;
        } else {
          response = formatFullBudget(b);
        }
        if (b && !lineItem && b.household_type === 'Two Adults Two Children' && !/school age/.test(normalizeText(text))) {
          const alt = csvService.findBudget('Two Adults Two Childcare', budgetType, latestYear);
          if (alt) {
            response += `\n\nNote: this assumes two school-age children. With an infant and a preschooler in child care instead, the ${budgetType} Budget is ${money(alt.monthly_total)}/month (${money(alt.annual_total)}/year) — ask about a "family of four with an infant and a preschooler".`;
          }
        }
        if (b && !lineItem && !wantsWage && !wantsAnnual) {
          response += otherNote;
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
        response += otherNote;
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
          text: 'ALICE Household Survival Budget for a Single Adult in Arkansas (2024):\n\nMonthly total: $2,273\nAnnual total: $27,276\nHourly wage needed (full-time): $13.64'
        }
      }
    ]
  ]
};
