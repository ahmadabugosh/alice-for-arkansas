import { describe, expect, it } from 'bun:test';
import { searchCountyAction } from '../plugins/csv-analysis/actions/searchCounty';

const pulaskiCounty = {
  county: 'Pulaski County',
  households: 169230,
  below_alice_percentage: 42,
  poverty: 15,
  alice_percentage: 27,
  alice_housholds: 46080,
  year: 2023,
  priority: false,
  notes: 'Little Rock metro'
};

function createRuntime() {
  return {
    csvDataService: {
      findCounty: () => pulaskiCounty
    }
  };
}

describe('searchCountyAction county notes', () => {
  it('does not append county notes to county data answers', async () => {
    const result = await searchCountyAction.handler(
      createRuntime() as any,
      { content: { text: 'What is the ALICE rate in Pulaski county?' } } as any,
      {} as any,
      {},
      undefined
    );

    expect(result.text).toContain('According to my data set, Pulaski County');
    expect(result.text).toContain('ALICE households: 27% (46,080 households)');
    expect(result.text).toContain('Total below ALICE threshold: 42%');
    expect(result.text).not.toContain('📝 Note');
    expect(result.text).not.toContain('Little Rock metro');
    expect(result.text).not.toContain('priority tracking county');
  });
});
