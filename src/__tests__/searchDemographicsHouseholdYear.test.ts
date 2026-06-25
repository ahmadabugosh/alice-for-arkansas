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

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getAllHouseholdTypes: () => householdTypes,
      getHouseholdTypes: (year: number) => householdTypes.filter((h) => h.year === year),
      getHouseholdTypeYears: () => [2024],
      getLatestHouseholdTypeYear: () => 2024
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

describe('searchDemographicsAction year-aware household breakdown', () => {
  it('defaults to the latest year (2024) and names it', async () => {
    const result = await runDemographicsQuery('What percent of ALICE families are female-headed households?');

    expect(result.text).toContain('latest available data (2024)');
    // 2024 counts, with computed percentages
    expect(result.text).toContain('ALICE households: 30% (24,748 households)');
    expect(result.text).toContain('Above ALICE threshold: 25% (20,536 households)');
    // Should NOT silently serve 2023 figures by default
    expect(result.text).not.toContain('64,120 households');
  });

  it('mentions that earlier years are available', async () => {
    const result = await runDemographicsQuery('Give me the gender household breakdown');
    expect(result.text).toContain('2023');
    expect(result.text).toContain('ask for a specific year');
  });

  it('serves 2023 when explicitly asked for that year', async () => {
    const result = await runDemographicsQuery('What was the female-headed household breakdown in 2023?');

    expect(result.text).toContain('breakdown for 2023');
    expect(result.text).toContain('Single-Female-Headed With Children');
    expect(result.text).toContain('ALICE households: 29% (64,120 households)');
    expect(result.text).not.toContain('latest available data');
  });

  it('serves the previous year when asked for relative phrasing', async () => {
    const result = await runDemographicsQuery('Show me the previous year gender household breakdown');
    expect(result.text).toContain('breakdown for 2023');
    expect(result.text).toContain('64,120 households');
  });
});
