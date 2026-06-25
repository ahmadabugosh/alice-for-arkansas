import { describe, expect, it } from 'bun:test';
import { searchBudgetAction } from '../plugins/csv-analysis/actions/searchBudget';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const budgets = [
  { year: 2024, budget_type: 'Stability', household_type: 'Single Adult', housing: 960, child_care: 0, food: 673, transportation: 899, health_care: 204, technology: 114, miscellaneous: 285, savings: 285, taxes: 534, monthly_total: 3954, annual_total: 47448, hourly_wage: 23.72 },
  { year: 2024, budget_type: 'Stability', household_type: 'Two Adults', housing: 1207, child_care: 0, food: 1255, transportation: 1098, health_care: 562, technology: 148, miscellaneous: 427, savings: 427, taxes: 767, monthly_total: 5891, annual_total: 70692, hourly_wage: 35.35 },
  { year: 2024, budget_type: 'Stability', household_type: 'Two Adults Two Children', housing: 1232, child_care: 438, food: 2278, transportation: 1434, health_care: 774, technology: 148, miscellaneous: 630, savings: 630, taxes: 863, monthly_total: 8427, annual_total: 101124, hourly_wage: 50.56 },
  { year: 2024, budget_type: 'Stability', household_type: 'Two Adults Two Childcare', housing: 1232, child_care: 1253, food: 1942, transportation: 1434, health_care: 774, technology: 148, miscellaneous: 678, savings: 678, taxes: 974, monthly_total: 9113, annual_total: 109356, hourly_wage: 54.68 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllBudgets: () => budgets,
      getBudgetYears: () => [2024],
      getLatestBudgetYear: () => 2024,
      getBudgetTypes: () => ['Stability'],
      getHouseholdTypesForBudget: () => budgets.map((b) => b.household_type),
      findBudget: (household: string, _bt?: string, year?: number) =>
        budgets.find((b) => b.household_type.toLowerCase() === household.toLowerCase() && (year === undefined || b.year === year))
    }
  };
}

async function runBudgetQuery(text: string) {
  return searchBudgetAction.handler(
    createRuntime() as any,
    { id: text, content: { text } } as any,
    {} as any,
    {},
    undefined
  );
}

const validateBudget = (text: string) =>
  searchBudgetAction.validate(createRuntime() as any, { content: { text } } as any);

describe('searchBudgetAction', () => {
  it('validates clear budget / cost-of-living questions', async () => {
    expect(await validateBudget('How much does a single adult need to live in Arkansas?')).toBe(true);
    expect(await validateBudget('What is the ALICE survival budget?')).toBe(true);
    expect(await validateBudget('cost of living for a family of four')).toBe(true);
  });

  it('does NOT hijack demographic household questions', async () => {
    expect(await validateBudget('What is the single-female-headed household ALICE rate?')).toBe(false);
    expect(await validateBudget('ALICE rates by household type')).toBe(false);
  });

  it('returns the full budget for a named household', async () => {
    const result: any = await runBudgetQuery('What is the budget for a single adult?');
    expect(result.text).toContain('ALICE Household Stability Budget for a Single Adult');
    expect(result.text).toContain('Housing: $960');
    expect(result.text).toContain('Monthly total: $3,954');
    expect(result.text).toContain('Annual total: $47,448');
    expect(result.text).toContain('Hourly wage needed (full-time): $23.72');
  });

  it('answers a single line item for a household', async () => {
    const result: any = await runBudgetQuery('How much is housing in the budget for a family of four?');
    expect(result.text).toContain('housing cost for a Two Adults Two Children');
    expect(result.text).toContain('$1,232');
  });

  it('answers an hourly wage question for a household', async () => {
    const result: any = await runBudgetQuery('What hourly wage does a single adult need to make ends meet?');
    expect(result.text).toContain('hourly wage of $23.72');
    expect(result.text).toContain('$47,448 per year');
  });

  it('shows a line item across households when no household is named', async () => {
    const result: any = await runBudgetQuery('What does child care cost in the ALICE budget?');
    expect(result.text).toContain('child care cost in Arkansas by household type');
    expect(result.text).toContain('Single Adult: $0');
    expect(result.text).toContain('Two Adults Two Childcare: $1,253');
  });

  it('gives an overview for a general budget question', async () => {
    const result: any = await runBudgetQuery('What is the ALICE stability budget?');
    expect(result.text).toContain('bottom line by household type');
    expect(result.text).toContain('Single Adult: $3,954/month');
    expect(result.text).toContain('$54.68/hr');
  });
});
