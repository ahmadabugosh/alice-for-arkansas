import { describe, expect, it } from 'bun:test';
import { CsvDataService } from '../plugins/csv-analysis/services/csvDataService';
import { searchCountyAction } from '../plugins/csv-analysis/actions/searchCounty';
import { analyzeTrendsAction } from '../plugins/csv-analysis/actions/analyzeTrends';

const svc = new CsvDataService();
svc.initialize();
const runtime: any = { csvDataService: svc };

async function ask(text: string) {
  return searchCountyAction.handler(runtime, { id: text, content: { text } } as any, {} as any, {}, undefined);
}

describe('county time-series + subcounty 2024', () => {
  it('loads the county time series (75 counties x 2010-2024)', () => {
    expect(svc.getCountyTimeSeriesYears()).toEqual([2010, 2012, 2014, 2016, 2018, 2019, 2021, 2022, 2023, 2024]);
    expect(svc.getCountyTimeSeries('Pulaski').length).toBe(10);
    const latest = svc.findCountyTimeSeries('Pulaski County');
    expect(latest?.year).toBe(2024);
    expect(latest?.households).toBe(178578);
  });

  it('answers county ALICE Threshold dollar amounts (previously unavailable)', async () => {
    const r: any = await ask('What is the ALICE threshold for Benton County?');
    expect(r.text).toContain('ALICE Threshold for Benton County (2024)');
    expect(r.text).toContain('Households under 65: $58,857/year');
    expect(r.text).toContain('Households 65 and over: $51,708/year');
    expect(r.text).not.toContain("I don't have county-level ALICE Threshold");
  });

  it('prefers 2024 subcounty data, keeping older-only places available', () => {
    const fay = svc.findSubCounty('Fayetteville');
    expect(fay?.year).toBe(2024);
    expect(fay?.alice_households).toBe(11697);
  });

  it('still leads a plain county lookup with the 2024 headline', async () => {
    const r: any = await ask('ALICE data for Pulaski County');
    expect(r.text).toContain('Latest available data (2024)');
    expect(r.text).toContain('Detailed 2023 breakdown');
  });

  it('routes county-named trend queries to the county (not statewide)', async () => {
    // Statewide trends action stands down when a county is named...
    expect(await analyzeTrendsAction.validate({ csvDataService: svc } as any, { content: { text: 'How has ALICE in Pulaski County changed over time?' } } as any)).toBe(false);
    // ...but still handles the statewide question.
    expect(await analyzeTrendsAction.validate({ csvDataService: svc } as any, { content: { text: 'How has ALICE in Arkansas changed over time?' } } as any)).toBe(true);
  });

  it('answers a county trend with that county 2010-2024 series', async () => {
    const r: any = await ask('How has ALICE in Pulaski County changed over time?');
    expect(r.text).toContain('ALICE trend for Pulaski County');
    expect(r.text).toContain('2010:');
    expect(r.text).toContain('2024:');
    expect(r.text).toContain('Net change 2010–2024');
  });
});
