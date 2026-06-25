import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  {
    category: 'Couples Married With Children',
    total_households: 208877,
    alice_households: 41666,
    alice_percentage: 11,
    poverty_percent: 9,
    year: 2023
  },
  {
    category: 'Single-Female-Headed\nWith Children',
    total_households: 83690,
    alice_households: 64120,
    alice_percentage: 29,
    poverty_percent: 48,
    year: 2023
  },
  {
    category: 'Single-Male-Headed\nWith Children',
    total_households: 27324,
    alice_households: 16278,
    alice_percentage: 31,
    poverty_percent: 29,
    year: 2023
  }
];

const householdTypes = [
  { year: 2024, name: 'Married', above: 169412, alice: 23155, poverty: 17821, households: 210388 },
  { year: 2024, name: 'Single-Female-Headed', above: 20536, alice: 24748, poverty: 37384, households: 82668 },
  { year: 2024, name: 'Single-Male-Headed', above: 11780, alice: 9364, poverty: 7026, households: 28170 }
];

const householdTypeTrends = [
  { year: 2010, name: 'Married', below_alice_threshold: 46600 },
  { year: 2010, name: 'Single-Female-Headed', below_alice_threshold: 74694 },
  { year: 2010, name: 'Single-Male-Headed', below_alice_threshold: 13533 },
  { year: 2018, name: 'Married', below_alice_threshold: 46241 },
  { year: 2018, name: 'Single-Female-Headed', below_alice_threshold: 68780 },
  { year: 2018, name: 'Single-Male-Headed', below_alice_threshold: 17061 },
  { year: 2024, name: 'Married', below_alice_threshold: 40976 },
  { year: 2024, name: 'Single-Female-Headed', below_alice_threshold: 62132 },
  { year: 2024, name: 'Single-Male-Headed', below_alice_threshold: 16390 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllHouseholdTypes: () => householdTypes,
      getHouseholdTypes: (year: number) => householdTypes.filter((h) => h.year === year),
      getHouseholdTypeYears: () => [2024],
      getLatestHouseholdTypeYear: () => 2024,
      getAllHouseholdTypeTrends: () => householdTypeTrends,
      getHouseholdTypeTrend: (name: string) =>
        householdTypeTrends.filter((h) => h.name === name).sort((a, b) => a.year - b.year),
      getHouseholdTypeTrendYears: () => [2010, 2018, 2024],
      getLatestHouseholdTypeTrendYear: () => 2024
    }
  };
}

async function runDemographicsQuery(text: string) {
  delete (global as any).processedMessages;
  return searchDemographicsAction.handler(
    createRuntime() as any,
    { id: text, content: { text } } as any,
    {} as any,
    {},
    undefined
  );
}

describe('searchDemographicsAction household-type trends', () => {
  it('returns the full below-threshold series for "over time" questions', async () => {
    const result = await runDemographicsQuery('How have female-headed households changed over time?');

    expect(result.text).toContain('Single-Female-Headed (below ALICE threshold)');
    expect(result.text).toContain('2010: 74,694 households');
    expect(result.text).toContain('2024: 62,132 households');
    expect(result.text).toContain('Net change 2010–2024: -12,562 (decrease)');
    // Should NOT default to the single-year band breakdown
    expect(result.text).not.toContain('latest available data');
  });

  it('shows all three types for a general trend question', async () => {
    const result = await runDemographicsQuery('Show me the trend in household types below the ALICE threshold');
    expect(result.text).toContain('Married (below ALICE threshold)');
    expect(result.text).toContain('Single-Female-Headed (below ALICE threshold)');
    expect(result.text).toContain('Single-Male-Headed (below ALICE threshold)');
  });

  it('answers a historical year from the trend when the full split is unavailable', async () => {
    const result = await runDemographicsQuery('What was the female-headed household ALICE figure in 2018?');

    expect(result.text).toContain('For 2018');
    expect(result.text).toContain('Single-Female-Headed: 68,780 households below the ALICE threshold');
    expect(result.text).toContain('not the full Above/ALICE/Poverty split');
  });

  it('still defaults a plain question to the latest full breakdown (2024)', async () => {
    const result = await runDemographicsQuery('female-headed household breakdown');
    expect(result.text).toContain('latest available data (2024)');
    expect(result.text).toContain('ALICE households: 30% (24,748 households)');
  });
});
