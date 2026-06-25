import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  { category: 'White', total_households: 868688, alice_households: 270247, alice_percentage: 31, poverty_percent: 9, year: 2023 },
  { category: 'Black', total_households: 177692, alice_households: 75806, alice_percentage: 43, poverty_percent: 21, year: 2023 }
];

const raceTrends = [
  { year: 2021, race: 'Black', below_alice_threshold: 118470 },
  { year: 2022, race: 'Black', below_alice_threshold: 113392 },
  { year: 2023, race: 'Black', below_alice_threshold: 113176 },
  { year: 2024, race: 'Black', below_alice_threshold: 109995 },
  { year: 2021, race: 'White', below_alice_threshold: 366099 },
  { year: 2022, race: 'White', below_alice_threshold: 371898 },
  { year: 2023, race: 'White', below_alice_threshold: 351446 },
  { year: 2024, race: 'White', below_alice_threshold: 343285 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllRaceTrends: () => raceTrends,
      getRaceTrend: (race: string) =>
        raceTrends.filter((r) => r.race === race).sort((a, b) => a.year - b.year),
      getRaceTrendYears: () => [2021, 2022, 2023, 2024],
      getLatestRaceTrendYear: () => 2024
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

describe('searchDemographicsAction race trends', () => {
  it('returns the below-threshold series for a race over time', async () => {
    const result: any = await runQuery('How have Black households changed over time by ALICE status?');
    expect(result.text).toContain('Black (below ALICE threshold)');
    expect(result.text).toContain('2021: 118,470 households');
    expect(result.text).toContain('2024: 109,995 households');
    expect(result.text).toContain('Net change 2021–2024: -8,475 (decrease)');
  });

  it('answers a specific race for a specific year', async () => {
    const result: any = await runQuery('How many White households were below the ALICE threshold in 2021?');
    expect(result.text).toContain('366,099 White households below the ALICE threshold');
    expect(result.text).toContain('For 2021');
  });

  it('lists all races for a year when none is named', async () => {
    const result: any = await runQuery('ALICE data by race in 2023');
    expect(result.text).toContain('For 2023');
    expect(result.text).toContain('Black: 113,176 households below the ALICE threshold');
    expect(result.text).toContain('White: 351,446 households below the ALICE threshold');
  });

  it('still uses the 2023 demographic breakdown for a plain race-rate question', async () => {
    const result: any = await runQuery('What is the ALICE rate for Black households?');
    expect(result.text).toContain('43%');
    expect(result.text).not.toContain('below ALICE threshold)');
  });
});
