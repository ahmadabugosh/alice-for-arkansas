import { describe, expect, it } from 'bun:test';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';
import { searchCountyAction } from '../plugins/csv-analysis/actions/searchCounty';

const svc = new CsvDataService();
svc.initialize();
const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  return searchCountyAction.handler(
    runtime,
    { id: text, content: { text } } as any,
    {} as any,
    {},
    undefined
  );
}

describe('county latest-year (2024) data', () => {
  it('exposes county-trend accessors and normalizes the name suffix', () => {
    expect(svc.getCountyTrendYears()).toEqual([2024]);
    expect(svc.getAllCountyTrends().length).toBe(75);
    expect(svc.findCountyTrend('Benton County')?.households).toBe(122269);
    expect(svc.findCountyTrend('Pulaski')?.below_alice_threshold).toBe(40);
    expect(svc.findCountyTrend('St. Francis')?.below_alice_threshold).toBe(62);
  });

  it('answers a county lookup with the full latest-year (2024) breakdown', async () => {
    const r: any = await ask('ALICE data for Pulaski County');
    expect(r.text).toContain('ALICE households: 24% (42,754 households)');
    expect(r.text).toContain('Households in poverty: 16% (28,863 households)');
    expect(r.text).toContain('Total below ALICE threshold: 40% (71,617 households, ALICE + poverty combined)');
    expect(r.text).toContain('Total households: 178,578');
    expect(r.text).toContain('Year: 2024 (latest available)');
  });
});
