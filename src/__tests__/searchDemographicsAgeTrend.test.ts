import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  { category: 'Age 25 to 44 Years', total_households: 394165, alice_households: 156785, alice_percentage: 23, poverty_percent: 17, year: 2023 },
  { category: 'Age 65 Years and Over', total_households: 339523, alice_households: 181192, alice_percentage: 39, poverty_percent: 14, year: 2023 }
];

const ageTrends = [
  { year: 2010, age_group: 'Age 65 and Over', below_alice_threshold: 138026 },
  { year: 2023, age_group: 'Age 65 and Over', below_alice_threshold: 181192 },
  { year: 2024, age_group: 'Age 65 and Over', below_alice_threshold: 178344 },
  { year: 2010, age_group: 'Under 25', below_alice_threshold: 46143 },
  { year: 2023, age_group: 'Under 25', below_alice_threshold: 37565 },
  { year: 2024, age_group: 'Under 25', below_alice_threshold: 42112 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllAgeTrends: () => ageTrends,
      getAgeTrend: (g: string) => ageTrends.filter((a) => a.age_group === g).sort((a, b) => a.year - b.year),
      getAgeTrendYears: () => [2010, 2023, 2024],
      getLatestAgeTrendYear: () => 2024
    }
  };
}

async function runQuery(text: string) {
  delete (global as any).processedMessages;
  return searchDemographicsAction.handler(
    createRuntime() as any,
    { id: text, content: { text } } as any,
    {} as any,
    {},
    undefined
  );
}

describe('searchDemographicsAction age trends', () => {
  it('returns the below-threshold series for an age group over time', async () => {
    const result: any = await runQuery('How has ALICE among seniors changed over time by age?');
    expect(result.text).toContain('Age 65 and Over (below ALICE threshold)');
    expect(result.text).toContain('2010: 138,026 households');
    expect(result.text).toContain('2024: 178,344 households');
    expect(result.text).toContain('Net change 2010–2024: +40,318 (increase)');
  });

  it('lists all age groups for a specific year', async () => {
    const result: any = await runQuery('ALICE data by age in 2010');
    expect(result.text).toContain('For 2010');
    expect(result.text).toContain('Under 25: 46,143 households below the ALICE threshold');
    expect(result.text).toContain('Age 65 and Over: 138,026 households below the ALICE threshold');
  });

  it('keeps the plain "ALICE rates by age" on the 2023 demographic percentages', async () => {
    const result: any = await runQuery('What are the ALICE rates by age group?');
    expect(result.text).toContain('ALICE rates by age group in Arkansas');
    expect(result.text).toContain('Age 65 Years and Over');
    expect(result.text).not.toContain('below ALICE threshold)');
  });
});
