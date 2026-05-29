import { describe, expect, it } from 'bun:test';
import { searchEmploymentAction } from '../plugins/csv-analysis/actions/searchEmployment';

const employmentData = [
  {
    occupation: 'Cashiers',
    total_workers: 32090,
    alice_workers: 17008,
    alice_percentage: 53,
    median_wage: 12.86,
    year: 2023
  },
  {
    occupation: 'Registered Nurses',
    total_workers: 29690,
    alice_workers: 2672,
    alice_percentage: 9,
    median_wage: 35.06,
    year: 2023
  }
];

function createRuntime() {
  return {
    csvDataService: {
      getAllEmployment: () => employmentData
    }
  };
}

describe('searchEmploymentAction', () => {
  it('explains when a requested employment category is not in the dataset', async () => {
    const result = await searchEmploymentAction.handler(
      createRuntime() as any,
      { content: { text: 'How many ALICE Arkansans are employed in construction trades?' } } as any,
      {} as any,
      {},
      undefined
    );

    expect(result.text).toContain("I don't currently have ALICE employment data for construction");
    expect(result.text).toContain('- Cashiers');
    expect(result.text).toContain('- Registered Nurses');
    expect(result.text).toContain('Would you like more stats on any of them?');
    expect(result.text).not.toContain('Overall:');
  });

  it('returns the specific employment row when the category is in the dataset', async () => {
    const result = await searchEmploymentAction.handler(
      createRuntime() as any,
      { content: { text: 'How many ALICE cashiers are in Arkansas?' } } as any,
      {} as any,
      {},
      undefined
    );

    expect(result.text).toContain('Arkansas employment data for Cashiers in 2023');
    expect(result.text).toContain('ALICE workers: 17,008 of 32,090 workers (53%)');
    expect(result.text).toContain('Median wage: $12.86 per hour');
  });
});
