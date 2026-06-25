import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  { category: 'White', total_households: 868688, alice_households: 270247, alice_percentage: 31, poverty_percent: 9, year: 2023 },
  { category: 'Black', total_households: 177692, alice_households: 75806, alice_percentage: 43, poverty_percent: 21, year: 2023 }
];

const raceBreakdown = [
  { year: 2024, race: 'Asian', above: 12168, alice: 3898, poverty: 1151, households: 17217 },
  { year: 2024, race: 'Black', above: 73651, alice: 74953, poverty: 35042, households: 183646 },
  { year: 2024, race: 'White', above: 527986, alice: 261732, poverty: 81553, households: 871271 }
];

const raceTrends = [
  { year: 2021, race: 'Black', below_alice_threshold: 118470 },
  { year: 2023, race: 'Black', below_alice_threshold: 113176 },
  { year: 2024, race: 'Black', below_alice_threshold: 109995 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllRaceBreakdown: () => raceBreakdown,
      getRaceBreakdown: (year: number) => raceBreakdown.filter((r) => r.year === year),
      getRaceBreakdownYears: () => [2024],
      getLatestRaceBreakdownYear: () => 2024,
      getAllRaceTrends: () => raceTrends,
      getRaceTrend: (race: string) => raceTrends.filter((r) => r.race === race).sort((a, b) => a.year - b.year),
      getRaceTrendYears: () => [2021, 2023, 2024],
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

describe('searchDemographicsAction race band breakdown (latest-year default)', () => {
  it('defaults a specific-race rate question to the latest band (2024)', async () => {
    const result: any = await runQuery('What is the ALICE rate for Black households?');
    // Black 2024: ALICE 74,953 / 183,646 = 41%
    expect(result.text).toContain('Black households in Arkansas (latest available data, 2024)');
    expect(result.text).toContain('ALICE households: 41% (74,953 households)');
    expect(result.text).toContain('Above ALICE threshold: 40% (73,651 households)');
  });

  it('defaults an all-race question to the latest band and notes other years', async () => {
    const result: any = await runQuery('ALICE breakdown by race');
    expect(result.text).toContain('latest available data, 2024');
    expect(result.text).toContain('White:');
    expect(result.text).toContain('ask for a specific year');
  });

  it('serves a prior year from the trend data when the band lacks it', async () => {
    const result: any = await runQuery('How many Black households were below the ALICE threshold in 2021?');
    expect(result.text).toContain('118,470 Black households below the ALICE threshold');
    expect(result.text).toContain('For 2021');
  });

  it('still returns the over-time series for trend questions', async () => {
    const result: any = await runQuery('How has ALICE among Black households changed over time?');
    expect(result.text).toContain('Black (below ALICE threshold)');
    expect(result.text).toContain('2021: 118,470 households');
  });
});
