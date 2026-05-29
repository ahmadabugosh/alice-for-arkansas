import { describe, expect, it } from 'bun:test';
import { searchDemographicsAction } from '../plugins/csv-analysis/actions/searchDemographics';
import { searchStatewideAction } from '../plugins/csv-analysis/actions/searchStatewide';

const demographicData = [
  {
    category: 'Total Arkansas',
    total_households: 1212992,
    alice_households: 537094,
    alice_percentage: 28,
    poverty_percent: 16,
    year: 2023
  },
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

function createRuntime() {
  return {
    csvDataService: {
      getAllDemographics: () => demographicData
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

describe('searchDemographicsAction gender-related queries', () => {
  it('routes female-headed household questions to the available family-with-children breakdown', async () => {
    const result = await runDemographicsQuery('What percent of ALICE families are female-headed households?');

    expect(result.text).toContain('The only gender-related ALICE data I have for Arkansas');
    expect(result.text).toContain('Single-Female-Headed With Children');
    expect(result.text).toContain('ALICE households: 29% (64,120 households)');
    expect(result.text).toContain('Total below ALICE threshold: 77%');
    expect(result.text).toContain('not a full statewide gender breakdown');
    expect(result.text).not.toContain("here's Arkansas demographic data");
  });

  it('routes statewide gender breakdown questions to the same limited breakdown', async () => {
    const text = 'Can you give a statewide gender breakdown for ALICE in Arkansas?';
    const shouldDemographicsTrigger = await searchDemographicsAction.validate(createRuntime() as any, {
      content: { text }
    } as any);
    const shouldStatewideTrigger = await searchStatewideAction.validate({} as any, {
      content: { text }
    } as any);
    const result = await runDemographicsQuery(text);

    expect(shouldDemographicsTrigger).toBe(true);
    expect(shouldStatewideTrigger).toBe(false);
    expect(result.text).toContain('Couples Married With Children');
    expect(result.text).toContain('Single-Female-Headed With Children');
    expect(result.text).toContain('Single-Male-Headed With Children');
  });
});
