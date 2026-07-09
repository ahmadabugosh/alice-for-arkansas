import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';

const demographicData = [
  { category: 'White', total_households: 868688, alice_households: 270247, alice_percentage: 31, poverty_percent: 9, year: 2023 },
  { category: 'Single or Cohabiting\nUnder 65 with no Children', total_households: 553578, alice_households: 233838, alice_percentage: 28, poverty_percent: 14, year: 2023 }
];

const householdTypes = [
  { year: 2024, name: 'Married', above: 169412, alice: 23155, poverty: 17821, households: 210388 },
  { year: 2024, name: 'Single-Female-Headed', above: 20536, alice: 24748, poverty: 37384, households: 82668 },
  { year: 2024, name: 'Single-Male-Headed', above: 11780, alice: 9364, poverty: 7026, households: 28170 }
];

const ageBreakdown = [
  { year: 2024, age_group: 'Under 25', above: 22763, alice: 22519, poverty: 19593, households: 64875 },
  { year: 2024, age_group: 'Age 25 to 44', above: 245746, alice: 84903, poverty: 61589, households: 392238 },
  { year: 2024, age_group: 'Age 45 to 64', above: 259199, alice: 98810, poverty: 66102, households: 424111 },
  { year: 2024, age_group: 'Age 65 and Over', above: 173042, alice: 128862, poverty: 49482, households: 351386 }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData,
      getHouseholdTypes: (y: number) => householdTypes.filter((h) => h.year === y),
      getLatestHouseholdTypeYear: () => 2024,
      getAgeBreakdown: (y: number) => ageBreakdown.filter((a) => a.year === y),
      getLatestAgeBreakdownYear: () => 2024
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

describe('searchDemographicsAction combined group ranking', () => {
  it('validates a generic group-ranking question', async () => {
    expect(await searchDemographicsAction.validate(createRuntime() as any, { content: { text: 'Which groups are most below the ALICE threshold?' } } as any)).toBe(true);
  });

  it('ranks household + age groups by % below threshold, highest first', async () => {
    const r: any = await runQuery('Which demographic groups are most below the ALICE threshold?');
    expect(r.text).toContain('ranked by the share of households below the ALICE threshold');
    expect(r.text).toContain('1. Single-Female-Headed (with children): 75%');
    expect(r.text).toContain('2. Under 25 Years: 65%');
    expect(r.text).toContain('Single or Cohabiting (no children): 42%');
    expect(r.text).toContain('8. Married (with children): 19%');
  });

  it('does NOT hijack a race-specific ranking question', async () => {
    const r: any = await runQuery('Which race has the highest ALICE rate?');
    expect(r.text).not.toContain('ranked by the share of households');
  });
});
