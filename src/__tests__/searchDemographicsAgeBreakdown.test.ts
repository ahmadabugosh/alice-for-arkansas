import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  { category: 'Age 25 to 44 Years', total_households: 394165, alice_households: 156785, alice_percentage: 23, poverty_percent: 17, year: 2023 },
  { category: 'Age 65 Years and Over', total_households: 339523, alice_households: 181192, alice_percentage: 39, poverty_percent: 14, year: 2023 }
];

const ageBreakdown = [
  { year: 2024, age_group: 'Under 25', above: 22763, alice: 22519, poverty: 19593, households: 64875 },
  { year: 2024, age_group: 'Age 65 and Over', above: 173042, alice: 128862, poverty: 49482, households: 351386 }
];

const ageTrends = [
  { year: 2010, age_group: 'Age 65 and Over', below_alice_threshold: 138026 },
  { year: 2024, age_group: 'Age 65 and Over', below_alice_threshold: 178344 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllAgeBreakdown: () => ageBreakdown,
      getAgeBreakdown: (year: number) => ageBreakdown.filter((a) => a.year === year),
      getAgeBreakdownYears: () => [2024],
      getLatestAgeBreakdownYear: () => 2024,
      getAllAgeTrends: () => ageTrends,
      getAgeTrend: (g: string) => ageTrends.filter((a) => a.age_group === g).sort((a, b) => a.year - b.year),
      getAgeTrendYears: () => [2010, 2024],
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

describe('searchDemographicsAction age band breakdown (latest-year default)', () => {
  it('defaults a specific age-group rate question to the latest band (2024)', async () => {
    const result: any = await runQuery('What is the ALICE rate for age 65 and over?');
    expect(result.text).toContain('Age 65 and Over households in Arkansas (latest available data, 2024)');
    expect(result.text).toContain('ALICE households: 37% (128,862 households)');
    expect(result.text).toContain('Above ALICE threshold: 49% (173,042 households)');
  });

  it('defaults an all-age question to the latest band and notes other years', async () => {
    const result: any = await runQuery('ALICE breakdown by age');
    expect(result.text).toContain('latest available data, 2024');
    expect(result.text).toContain('Age 65 and Over:');
    expect(result.text).toContain('ask for a specific year');
  });

  it('serves a prior year from the trend data when the band lacks it', async () => {
    const result: any = await runQuery('ALICE by age in 2010');
    expect(result.text).toContain('For 2010');
    expect(result.text).toContain('Age 65 and Over: 138,026 households below the ALICE threshold');
  });
});
