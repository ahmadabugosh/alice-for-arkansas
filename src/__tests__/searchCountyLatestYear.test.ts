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

  it('leads a county lookup with the latest (2024) figures, keeping the 2023 detail', async () => {
    const r: any = await ask('ALICE data for Pulaski County');
    expect(r.text).toContain('Latest available data (2024): 178,578 households, 40% below the ALICE threshold');
    expect(r.text).toContain('Detailed 2023 breakdown');
    expect(r.text).toContain('ALICE households: 27% (46,080 households)');
  });
});
